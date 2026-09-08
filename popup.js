const STORAGE_KEY = 'dailyWorkReportState';
const BACKLOG_BASE = 'https://maruori.backlog.com/view/CBOX-';
const DEFAULT_TASK = () => ({ id: '', name: '', status: '進行中', currentPercent: '', targetPercent: '' });

let state = {
  tab: 'tasks',
  mode: 'morning',
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
  taskList: document.getElementById('taskList'),
  taskTemplate: document.getElementById('taskTemplate'),
  preview: document.getElementById('preview'),
  copyBtn: document.getElementById('copyBtn'),
  dateLabel: document.getElementById('dateLabel'),
  toast: document.getElementById('toast')
};

function getJapanDateParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { year: map.year, month: map.month, day: map.day };
}

function reportDateText() {
  const { month, day } = getJapanDateParts();
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
    status: ['未着手', '進行中', '完了', '保留'].includes(task.status) ? task.status : '進行中',
    currentPercent: task.currentPercent === null || task.currentPercent === undefined
      ? legacyPercent
      : String(task.currentPercent),
    targetPercent: task.targetPercent === null || task.targetPercent === undefined
      ? ''
      : String(task.targetPercent)
  };
}

async function loadState() {
  const saved = await chrome.storage.local.get(STORAGE_KEY);
  const data = saved[STORAGE_KEY];

  if (data && Array.isArray(data.tasks)) {
    state.mode = data.mode === 'evening' ? 'evening' : 'morning';
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
    const remove = node.querySelector('.remove-btn');

    idInput.value = task.id;
    nameInput.value = task.name;
    statusSelect.value = task.status;
    currentPercentInput.value = task.currentPercent;
    targetPercentInput.value = task.targetPercent;
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

function percentDetailText(task) {
  const current = task.currentPercent === '' ? '' : `${task.currentPercent}％`;
  const target = task.targetPercent === '' ? '' : `${task.targetPercent}％`;
  return `（現状：${current}／目標：${target}）`;
}

function formatTaskPlain(task, index) {
  const id = task.id.trim();
  const name = task.name.trim() || (id ? `CBOX-${id}` : '(Untitled task)');
  const progress = progressText(task);
  const percentDetail = percentDetailText(task);

  if (id !== '') {
    return `${index + 1}. CBOX-${id} : ${name} ${progress} ${percentDetail}`;
  }

  return `${index + 1}. ${name} ${progress} ${percentDetail}`;
}

function generatePlainText() {
  const date = reportDateText();
  const isMorning = state.mode === 'morning';

  const opening = isMorning
    ? `おはようございます。\n本日（${date}）の業務を開始いたします。`
    : `お疲れさまです。\n本日（${date}）の業務を終了いたします。`;

  const closing = isMorning
    ? '本日もよろしくお願いいたします。'
    : '本日もありがとうございました。';

  const taskLines = state.tasks.map(formatTaskPlain).join('\n');
  const taskBlock = taskLines ? `${taskLines}\n\n` : '';

  return `${opening}\n■ 本日のタスク\n◉ BtoB\n\n${taskBlock}${closing}`;
}

function appendTextLine(parent, text, className = 'message-line') {
  const line = document.createElement('div');
  line.className = className;
  line.textContent = text;
  parent.appendChild(line);
  return line;
}

function buildPreviewDom() {
  els.preview.innerHTML = '';

  const date = reportDateText();
  const isMorning = state.mode === 'morning';

  appendTextLine(els.preview, isMorning ? 'おはようございます。' : 'お疲れさまです。');
  appendTextLine(
    els.preview,
    isMorning
      ? `本日（${date}）の業務を開始いたします。`
      : `本日（${date}）の業務を終了いたします。`
  );
  appendTextLine(els.preview, '■ 本日のタスク');
  appendTextLine(els.preview, '◉ BtoB');
  appendTextLine(els.preview, '', 'message-spacer');

  state.tasks.forEach((task, index) => {
    const id = task.id.trim();
    const name = task.name.trim() || (id ? `CBOX-${id}` : '(Untitled task)');
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

    line.append(document.createTextNode(` ${progressText(task)} ${percentDetailText(task)}`));
    els.preview.appendChild(line);
  });

  appendTextLine(els.preview, '', 'message-spacer');
  appendTextLine(
    els.preview,
    isMorning ? '本日もよろしくお願いいたします。' : '本日もありがとうございました。'
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function generateClipboardHtml() {
  const date = reportDateText();
  const isMorning = state.mode === 'morning';
  const opening1 = isMorning ? 'おはようございます。' : 'お疲れさまです。';
  const opening2 = isMorning
    ? `本日（${date}）の業務を開始いたします。`
    : `本日（${date}）の業務を終了いたします。`;
  const closing = isMorning
    ? '本日もよろしくお願いいたします。'
    : '本日もありがとうございました。';

  const taskHtml = state.tasks.map((task, index) => {
    const id = task.id.trim();
    const fallbackName = id ? `CBOX-${id}` : '(Untitled task)';
    const name = escapeHtml(task.name.trim() || fallbackName);
    const progress = escapeHtml(progressText(task));
    const percentDetail = escapeHtml(percentDetailText(task));

    if (id) {
      const url = `${BACKLOG_BASE}${encodeURIComponent(id)}`;
      return `<div>${index + 1}. CBOX-${escapeHtml(id)} : <a href="${url}">${name}</a> ${progress} ${percentDetail}</div>`;
    }

    return `<div>${index + 1}. ${name} ${progress} ${percentDetail}</div>`;
  }).join('');

  return [
    '<div>',
    `<div>${escapeHtml(opening1)}</div>`,
    `<div>${escapeHtml(opening2)}</div>`,
    '<div>■ 本日のタスク</div>',
    '<div>◉ BtoB</div>',
    '<div><br></div>',
    taskHtml,
    '<div><br></div>',
    `<div>${escapeHtml(closing)}</div>`,
    '</div>'
  ].join('');
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
els.copyBtn.addEventListener('click', copyMessage);

loadState();
