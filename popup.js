const STORAGE_KEY = 'dailyWorkReportState';
const BACKLOG_BASE = 'https://maruori.backlog.com/view/CBOX-';
const DEFAULT_TASK = () => ({ id: '', name: '', status: '進行中', currentPercent: '', targetPercent: '', deadline: '', note: '' });

let state = {
  tab: 'tasks',
  mode: 'morning',
  requestMoreTasks: false,
  tasks: [DEFAULT_TASK()]
};

const els = {
  tasksTabBtn: document.getElementById('tasksTabBtn'),
  morningBtn: document.getElementById('morningBtn'),
  eveningBtn: document.getElementById('eveningBtn'),
  tasksView: document.getElementById('tasksView'),
  reportView: document.getElementById('reportView'),
  reportHeading: document.getElementById('reportHeading'),
  addTaskBtn: document.getElementById('addTaskBtn'),
  requestMoreTasks: document.getElementById('requestMoreTasks'),
  taskList: document.getElementById('taskList'),
  taskTemplate: document.getElementById('taskTemplate'),
  preview: document.getElementById('preview'),
  copyBtn: document.getElementById('copyBtn'),
  dateLabel: document.getElementById('dateLabel'),
  toast: document.getElementById('toast')
};

function getJapanDateParts(dayOffset = 0) {
  const date = new Date(Date.now() + (dayOffset * 24 * 60 * 60 * 1000));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { year: map.year, month: map.month, day: map.day };
}

function reportDateText(dayOffset = 0) {
  const { month, day } = getJapanDateParts(dayOffset);
  return `${month}月${day}日`;
}


function humanDateText() {
  const { year, month, day } = getJapanDateParts();
  return `Japan date: ${year}/${month}/${day}`;
}

function normalizeTask(task = {}) {
  // Backward compatibility: the old single `percent` value becomes Current %.
  const legacyPercent = task.percent === null || task.percent === undefined ? '' : String(task.percent);

  return {
    id: task.id === null || task.id === undefined ? '' : String(task.id),
    name: task.name || '',
    status: ['未着手', '進行中', '保留', '返答待ち', '完了'].includes(task.status) ? task.status : '進行中',
    currentPercent: task.currentPercent === null || task.currentPercent === undefined
      ? legacyPercent
      : String(task.currentPercent),
    targetPercent: task.targetPercent === null || task.targetPercent === undefined
      ? ''
      : String(task.targetPercent),
    deadline: task.deadline === null || task.deadline === undefined ? '' : String(task.deadline),
    note: task.note === null || task.note === undefined ? '' : String(task.note)
  };
}

async function loadState() {
  const saved = await chrome.storage.local.get(STORAGE_KEY);
  const data = saved[STORAGE_KEY];

  if (data && Array.isArray(data.tasks)) {
    state.mode = data.mode === 'evening' ? 'evening' : 'morning';
    state.requestMoreTasks = Boolean(data.requestMoreTasks);
    state.tasks = data.tasks.map(normalizeTask);
    state.tab = ['tasks', 'morning', 'evening'].includes(data.tab) ? data.tab : 'tasks';
  }

  render();
}

function saveState() {
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function setTab(tab) {
  if (!['tasks', 'morning', 'evening'].includes(tab)) return;

  state.tab = tab;
  if (tab === 'morning' || tab === 'evening') {
    state.mode = tab;
  }

  saveState();
  renderTabs();
  updatePreview();
}

function renderTabs() {
  const buttons = {
    tasks: els.tasksTabBtn,
    morning: els.morningBtn,
    evening: els.eveningBtn
  };

  Object.entries(buttons).forEach(([tab, button]) => {
    const active = state.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const tasksActive = state.tab === 'tasks';
  els.tasksView.classList.toggle('active', tasksActive);
  els.reportView.classList.toggle('active', !tasksActive);

  if (!tasksActive) {
    els.reportHeading.textContent = state.mode === 'morning' ? 'Morning message' : 'Evening message';
  }
}

function renderTasks() {
  els.requestMoreTasks.checked = state.requestMoreTasks;
  els.taskList.innerHTML = '';

  if (state.tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No tasks yet. Click “+ Add task”.';
    els.taskList.appendChild(empty);
    return;
  }

  state.tasks.forEach((task, index) => {
    const node = els.taskTemplate.content.cloneNode(true);
    const card = node.querySelector('.task-card');
    const dragHandle = node.querySelector('.drag-handle');
    const idInput = node.querySelector('.task-id');
    const nameInput = node.querySelector('.task-name');
    const statusSelect = node.querySelector('.task-status');
    const currentPercentInput = node.querySelector('.task-current-percent');
    const targetPercentInput = node.querySelector('.task-target-percent');
    const deadlineInput = node.querySelector('.task-deadline');
    const noteInput = node.querySelector('.task-note');
    const remove = node.querySelector('.remove-btn');

    idInput.value = task.id;
    nameInput.value = task.name;
    statusSelect.value = task.status;
    currentPercentInput.value = task.currentPercent;
    targetPercentInput.value = task.targetPercent;
    deadlineInput.value = task.deadline;
    noteInput.value = task.note;
    card.dataset.index = index;

    idInput.addEventListener('input', () => {
      const clean = idInput.value.replace(/[^0-9]/g, '');
      if (idInput.value !== clean) idInput.value = clean;
      state.tasks[index].id = clean;
      changed();
    });

    nameInput.addEventListener('input', () => {
      state.tasks[index].name = nameInput.value;
      changed();
    });

    statusSelect.addEventListener('change', () => {
      state.tasks[index].status = statusSelect.value;
      changed();
    });

    bindPercentInput(currentPercentInput, 'currentPercent', index);
    bindPercentInput(targetPercentInput, 'targetPercent', index);

    deadlineInput.addEventListener('change', () => {
      state.tasks[index].deadline = deadlineInput.value;
      changed();
    });

    noteInput.addEventListener('input', () => {
      state.tasks[index].note = noteInput.value;
      changed();
    });

    remove.addEventListener('click', () => removeTask(index));

    dragHandle.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      card.classList.add('dragging');
    });

    dragHandle.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      els.taskList.querySelectorAll('.task-card').forEach(el => el.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const from = Number(event.dataTransfer.getData('text/plain'));
      const to = index;
      if (!Number.isInteger(from) || from === to || from < 0 || from >= state.tasks.length) return;
      const [moved] = state.tasks.splice(from, 1);
      state.tasks.splice(to, 0, moved);
      saveState();
      renderTasks();
      updatePreview();
    });

    els.taskList.appendChild(node);
  });
}

function addTask() {
  state.tasks.push(DEFAULT_TASK());
  saveState();
  renderTasks();
  updatePreview();

  requestAnimationFrame(() => {
    const cards = els.taskList.querySelectorAll('.task-card');
    const last = cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      last.querySelector('.task-id')?.focus();
    }
  });
}

function removeTask(index) {
  state.tasks.splice(index, 1);
  saveState();
  renderTasks();
  updatePreview();
}


function changed() {
  saveState();
  updatePreview();
}

function bindPercentInput(input, key, index) {
  input.addEventListener('input', () => {
    if (input.value === '') {
      state.tasks[index][key] = '';
    } else {
      const value = Math.min(100, Math.max(0, Number(input.value)));
      input.value = Number.isFinite(value) ? String(value) : '';
      state.tasks[index][key] = input.value;
    }
    changed();
  });
}

function progressText(task) {
  return `[${task.status}]`;
}

function morningPercentDetailText(task) {
  const current = task.currentPercent === '' ? '' : `${task.currentPercent}％`;
  const target = task.targetPercent === '' ? '' : `${task.targetPercent}％`;
  return `（現状：${current}／目標：${target}）`;
}

function eveningCurrentDetailText(task) {
  const current = task.currentPercent === '' ? '' : `${task.currentPercent}％`;
  return `（現状：${current}）`;
}

function eveningTargetDetailText(task) {
  const target = task.targetPercent === '' ? '' : `${task.targetPercent}％`;
  return `（目標：${target}）`;
}

function deadlineDetailText(task) {
  const value = (task.deadline || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!month || !day) return '';

  return `（完了予定日：${month}月${day}日）`;
}

function taskDisplayName(task) {
  const id = task.id.trim();
  return task.name.trim() || (id ? `CBOX-${id}` : '(Untitled task)');
}

function formatTaskPlain(task, index, detailText, includeDeadline = true) {
  const id = task.id.trim();
  const name = taskDisplayName(task);
  const progress = progressText(task);
  const deadline = includeDeadline ? deadlineDetailText(task) : '';

  if (id !== '') {
    return `${index + 1}. CBOX-${id} : ${name} ${progress} ${detailText}${deadline}`;
  }

  return `${index + 1}. ${name} ${progress} ${detailText}${deadline}`;
}

function generateMorningPlainText() {
  // Morning reports are prepared the previous evening, so use tomorrow's Japan date.
  const date = reportDateText(1);
  const morningTasks = state.tasks.filter(task => task.status !== '完了');
  const taskLines = morningTasks
    .map((task, index) => formatTaskPlain(task, index, morningPercentDetailText(task)))
    .join('\n');

  const lines = [
    'おはようございます。',
    `本日（${date}）の業務を開始いたします。`,
    '',
    '◉ BtoB',
    '',
    '■ 本日のタスク',
    taskLines,
    ''
  ];

  if (state.requestMoreTasks) {
    lines.push('もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。', '');
  }

  lines.push('本日もよろしくお願いいたします。');
  return lines.join('\n');
}

function generateEveningPlainText() {
  const date = reportDateText();
  const todayLines = state.tasks
    .map((task, index) => formatTaskPlain(task, index, eveningCurrentDetailText(task), false))
    .join('\n');

  const nextDayTasks = state.tasks.filter(task => task.status !== '完了');
  const nextDayLines = nextDayTasks
    .map((task, index) => formatTaskPlain(task, index, eveningTargetDetailText(task)))
    .join('\n');

  const lines = [
    'お疲れさまです。',
    `本日（${date}）の業務を終了いたします。`,
    '',
    '◉ BtoB',
    '',
    '■ 今日の作業',
    todayLines,
    '',
    '■ 次の日の作業',
    nextDayLines,
    ''
  ];

  if (state.requestMoreTasks) {
    lines.push(
      '本日に現在のタスクがすべて完了する予定です。',
      'もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。',
      ''
    );
  }

  lines.push('本日もありがとうございました。');
  return lines.join('\n');
}

function generatePlainText() {
  return state.mode === 'morning' ? generateMorningPlainText() : generateEveningPlainText();
}

function appendTextLine(parent, text, className = 'message-line') {
  const line = document.createElement('div');
  line.className = className;
  line.textContent = text;
  parent.appendChild(line);
  return line;
}

function appendTaskPreviewLine(parent, task, index, detailText, includeDeadline = true) {
  const id = task.id.trim();
  const name = taskDisplayName(task);
  const line = document.createElement('div');
  line.className = 'message-line';

  line.append(document.createTextNode(`${index + 1}. `));

  if (id) {
    line.append(document.createTextNode(`CBOX-${id} : `));
    const link = document.createElement('a');
    link.href = `${BACKLOG_BASE}${id}`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = name;
    line.append(link);
  } else {
    line.append(document.createTextNode(name));
  }

  const deadline = includeDeadline ? deadlineDetailText(task) : '';
  line.append(document.createTextNode(` ${progressText(task)} ${detailText}${deadline}`));
  parent.appendChild(line);
}

function buildMorningPreviewDom() {
  // Morning reports are prepared the previous evening, so use tomorrow's Japan date.
  const date = reportDateText(1);

  appendTextLine(els.preview, 'おはようございます。');
  appendTextLine(els.preview, `本日（${date}）の業務を開始いたします。`);
  appendTextLine(els.preview, '', 'message-spacer');
  appendTextLine(els.preview, '◉ BtoB');
  appendTextLine(els.preview, '', 'message-spacer');
  appendTextLine(els.preview, '■ 本日のタスク');

  state.tasks
    .filter(task => task.status !== '完了')
    .forEach((task, index) => {
      appendTaskPreviewLine(els.preview, task, index, morningPercentDetailText(task));
    });

  appendTextLine(els.preview, '', 'message-spacer');
  if (state.requestMoreTasks) {
    appendTextLine(els.preview, 'もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。');
    appendTextLine(els.preview, '', 'message-spacer');
  }
  appendTextLine(els.preview, '本日もよろしくお願いいたします。');
}

function buildEveningPreviewDom() {
  const date = reportDateText();

  appendTextLine(els.preview, 'お疲れさまです。');
  appendTextLine(els.preview, `本日（${date}）の業務を終了いたします。`);
  appendTextLine(els.preview, '', 'message-spacer');
  appendTextLine(els.preview, '◉ BtoB');
  appendTextLine(els.preview, '', 'message-spacer');
  appendTextLine(els.preview, '■ 今日の作業');

  state.tasks.forEach((task, index) => {
    appendTaskPreviewLine(els.preview, task, index, eveningCurrentDetailText(task), false);
  });

  appendTextLine(els.preview, '', 'message-spacer');
  appendTextLine(els.preview, '■ 次の日の作業');

  state.tasks
    .filter(task => task.status !== '完了')
    .forEach((task, index) => {
      appendTaskPreviewLine(els.preview, task, index, eveningTargetDetailText(task));
    });

  appendTextLine(els.preview, '', 'message-spacer');
  if (state.requestMoreTasks) {
    appendTextLine(els.preview, '本日に現在のタスクがすべて完了する予定です。');
    appendTextLine(els.preview, 'もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。');
    appendTextLine(els.preview, '', 'message-spacer');
  }
  appendTextLine(els.preview, '本日もありがとうございました。');
}

function buildPreviewDom() {
  els.preview.innerHTML = '';
  if (state.mode === 'morning') {
    buildMorningPreviewDom();
  } else {
    buildEveningPreviewDom();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function taskClipboardHtml(task, index, detailText, includeDeadline = true) {
  const id = task.id.trim();
  const name = escapeHtml(taskDisplayName(task));
  const progress = escapeHtml(progressText(task));
  const detail = escapeHtml(detailText);
  const deadline = includeDeadline ? escapeHtml(deadlineDetailText(task)) : '';

  if (id) {
    const url = `${BACKLOG_BASE}${encodeURIComponent(id)}`;
    return `<div>${index + 1}. CBOX-${escapeHtml(id)} : <a href="${url}">${name}</a> ${progress} ${detail}${deadline}</div>`;
  }

  return `<div>${index + 1}. ${name} ${progress} ${detail}${deadline}</div>`;
}

function generateMorningClipboardHtml() {
  // Morning reports are prepared the previous evening, so use tomorrow's Japan date.
  const date = reportDateText(1);
  const taskHtml = state.tasks
    .filter(task => task.status !== '完了')
    .map((task, index) => taskClipboardHtml(task, index, morningPercentDetailText(task)))
    .join('');

  const html = [
    '<div>',
    '<div>おはようございます。</div>',
    `<div>本日（${escapeHtml(date)}）の業務を開始いたします。</div>`,
    '<div><br></div>',
    '<div>◉ BtoB</div>',
    '<div><br></div>',
    '<div>■ 本日のタスク</div>',
    taskHtml,
    '<div><br></div>'
  ];

  if (state.requestMoreTasks) {
    html.push(
      '<div>もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。</div>',
      '<div><br></div>'
    );
  }

  html.push('<div>本日もよろしくお願いいたします。</div>', '</div>');
  return html.join('');
}

function generateEveningClipboardHtml() {
  const date = reportDateText();
  const todayHtml = state.tasks
    .map((task, index) => taskClipboardHtml(task, index, eveningCurrentDetailText(task), false))
    .join('');

  const nextDayHtml = state.tasks
    .filter(task => task.status !== '完了')
    .map((task, index) => taskClipboardHtml(task, index, eveningTargetDetailText(task)))
    .join('');

  const html = [
    '<div>',
    '<div>お疲れさまです。</div>',
    `<div>本日（${escapeHtml(date)}）の業務を終了いたします。</div>`,
    '<div><br></div>',
    '<div>◉ BtoB</div>',
    '<div><br></div>',
    '<div>■ 今日の作業</div>',
    todayHtml,
    '<div><br></div>',
    '<div>■ 次の日の作業</div>',
    nextDayHtml,
    '<div><br></div>'
  ];

  if (state.requestMoreTasks) {
    html.push(
      '<div>本日に現在のタスクがすべて完了する予定です。</div>',
      '<div>もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。</div>',
      '<div><br></div>'
    );
  }

  html.push('<div>本日もありがとうございました。</div>', '</div>');
  return html.join('');
}

function generateClipboardHtml() {
  return state.mode === 'morning' ? generateMorningClipboardHtml() : generateEveningClipboardHtml();
}

function updatePreview() {
  els.dateLabel.textContent = humanDateText();
  if (state.tab !== 'tasks') {
    els.reportHeading.textContent = state.mode === 'morning' ? 'Morning message' : 'Evening message';
    buildPreviewDom();
  }
}

async function copyMessage() {
  const plainText = generatePlainText();
  const html = generateClipboardHtml();

  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' })
      });
      await navigator.clipboard.write([clipboardItem]);
      showToast('Copied with Slack links');
      return;
    }

    await navigator.clipboard.writeText(plainText);
    showToast('Copied (plain text fallback)');
  } catch (error) {
    try {
      const temp = document.createElement('textarea');
      temp.value = plainText;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.focus();
      temp.select();
      document.execCommand('copy');
      temp.remove();
      showToast('Copied (plain text fallback)');
    } catch (fallbackError) {
      showToast('Copy failed');
    }
  }
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1700);
}

function render() {
  renderTabs();
  renderTasks();
  updatePreview();
}

els.tasksTabBtn.addEventListener('click', () => setTab('tasks'));
els.morningBtn.addEventListener('click', () => setTab('morning'));
els.eveningBtn.addEventListener('click', () => setTab('evening'));
els.addTaskBtn.addEventListener('click', addTask);
els.requestMoreTasks.addEventListener('change', () => {
  state.requestMoreTasks = els.requestMoreTasks.checked;
  changed();
});
els.copyBtn.addEventListener('click', copyMessage);

loadState();
