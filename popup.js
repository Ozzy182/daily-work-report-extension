const STORAGE_KEY = 'dailyWorkReportState';
const BACKLOG_BASE = 'https://maruori.backlog.com/view/WUNDOU-';
const ASSIGNEES = ['Bibek', 'Nurbu'];

const DEFAULT_TASK = (assignee = 'Bibek') => ({
  id: '',
  name: '',
  assignee,
  statusPercent: '',
  note: ''
});

let state = {
  tab: 'tasks',
  tasks: []
};

const els = {
  tasksTabBtn: document.getElementById('tasksTabBtn'),
  reportTabBtn: document.getElementById('reportTabBtn'),
  tasksView: document.getElementById('tasksView'),
  reportView: document.getElementById('reportView'),
  taskList: document.getElementById('taskList'),
  addTaskBtn: document.getElementById('addTaskBtn'),
  taskTemplate: document.getElementById('taskTemplate'),
  combinedPreview: document.getElementById('combinedPreview'),
  copyAllBtn: document.getElementById('copyAllBtn'),
  toast: document.getElementById('toast')
};

function normalizeTask(task = {}) {
  // Migration from earlier versions:
  // End % -> Status %. If End % is missing, fall back to older Target/Current values.
  const legacyStatus = task.endPercent ?? task.targetPercent ?? task.currentPercent ?? task.percent ?? '';

  return {
    id: task.id === null || task.id === undefined ? '' : String(task.id),
    name: task.name || '',
    assignee: ASSIGNEES.includes(task.assignee) ? task.assignee : 'Bibek',
    statusPercent: task.statusPercent === null || task.statusPercent === undefined
      ? String(legacyStatus)
      : String(task.statusPercent),
    note: task.note === null || task.note === undefined ? '' : String(task.note)
  };
}

async function loadState() {
  const saved = await chrome.storage.local.get(STORAGE_KEY);
  const data = saved[STORAGE_KEY];

  if (data && Array.isArray(data.tasks)) {
    state.tasks = data.tasks.map(normalizeTask);
    state.tab = data.tab === 'report' ? 'report' : 'tasks';
  }

  saveState();
  render();
}

function saveState() {
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function changed({ rerenderTasks = false } = {}) {
  saveState();
  if (rerenderTasks) renderTasks();
  updatePreviews();
}

function setTab(tab) {
  if (!['tasks', 'report'].includes(tab)) return;
  state.tab = tab;
  saveState();
  renderTabs();
  updatePreviews();
}

function renderTabs() {
  const tasksActive = state.tab === 'tasks';
  els.tasksTabBtn.classList.toggle('active', tasksActive);
  els.tasksTabBtn.setAttribute('aria-selected', tasksActive ? 'true' : 'false');
  els.reportTabBtn.classList.toggle('active', !tasksActive);
  els.reportTabBtn.setAttribute('aria-selected', tasksActive ? 'false' : 'true');
  els.tasksView.classList.toggle('active', tasksActive);
  els.reportView.classList.toggle('active', !tasksActive);
}

function renderTasks() {
  els.taskList.innerHTML = '';

  if (state.tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No tasks yet.';
    els.taskList.appendChild(empty);
    return;
  }

  state.tasks.forEach((task, index) => {
    const node = els.taskTemplate.content.cloneNode(true);
    const card = node.querySelector('.task-card');
    const dragHandle = node.querySelector('.drag-handle');
    const assigneeSelect = node.querySelector('.task-assignee');
    const idInput = node.querySelector('.task-id');
    const nameInput = node.querySelector('.task-name');
    const statusPercentInput = node.querySelector('.task-status-percent');
    const noteInput = node.querySelector('.task-note');
    const remove = node.querySelector('.remove-btn');

    card.dataset.index = String(index);
    assigneeSelect.value = task.assignee;
    idInput.value = task.id;
    nameInput.value = task.name;
    statusPercentInput.value = task.statusPercent;
    noteInput.value = task.note;

    assigneeSelect.addEventListener('change', () => {
      state.tasks[index].assignee = assigneeSelect.value;
      changed();
    });

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

    bindPercentInput(statusPercentInput, index);

    noteInput.addEventListener('input', () => {
      state.tasks[index].note = noteInput.value;
      changed();
    });

    remove.addEventListener('click', () => {
      state.tasks.splice(index, 1);
      changed({ rerenderTasks: true });
    });

    dragHandle.addEventListener('dragstart', event => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      card.classList.add('dragging');
    });

    dragHandle.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.task-card').forEach(el => el.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', event => {
      const from = Number(event.dataTransfer.getData('text/plain'));
      if (!Number.isInteger(from) || !state.tasks[from]) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));

    card.addEventListener('drop', event => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const from = Number(event.dataTransfer.getData('text/plain'));
      const to = index;
      if (!Number.isInteger(from) || from === to || !state.tasks[from] || !state.tasks[to]) return;

      const [moved] = state.tasks.splice(from, 1);
      state.tasks.splice(to, 0, moved);
      changed({ rerenderTasks: true });
    });

    els.taskList.appendChild(node);
  });
}

function bindPercentInput(input, index) {
  input.addEventListener('input', () => {
    if (input.value === '') {
      state.tasks[index].statusPercent = '';
    } else {
      const value = Math.min(100, Math.max(0, Number(input.value)));
      input.value = Number.isFinite(value) ? String(value) : '';
      state.tasks[index].statusPercent = input.value;
    }
    changed();
  });
}

function addTask() {
  state.tasks.push(DEFAULT_TASK('Bibek'));
  changed({ rerenderTasks: true });

  requestAnimationFrame(() => {
    const cards = els.taskList.querySelectorAll('.task-card');
    const last = cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      last.querySelector('.task-id')?.focus();
    }
  });
}

function taskDisplayName(task) {
  const id = task.id.trim();
  return task.name.trim() || (id ? `WUNDOU-${id}` : '(Untitled task)');
}

function percentText(value) {
  return value === '' ? '' : `${value}%`;
}

function taskLine(task) {
  const id = task.id.trim();
  const prefix = id ? `WUNDOU-${id} ` : '';
  const percent = percentText(task.statusPercent);
  return `${prefix}${taskDisplayName(task)}${percent ? ` ${percent}` : ''}`;
}

function reportTasks(assignee) {
  return state.tasks.filter(task => task.assignee === assignee);
}

function japanDateParts(offsetDays = 0) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  const shifted = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offsetDays));
  return {
    month: String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    day: String(shifted.getUTCDate()).padStart(2, '0')
  };
}

function reportDateText(offsetDays = 0) {
  const { month, day } = japanDateParts(offsetDays);
  return `${month}月${day}日`;
}

function pushTaskBlocks(lines) {
  ASSIGNEES.forEach((assignee, assigneeIndex) => {
    lines.push(`------------------${assignee.toUpperCase()}----------------------`);
    reportTasks(assignee).forEach(task => lines.push(taskLine(task)));
    if (assigneeIndex < ASSIGNEES.length - 1) lines.push('');
  });
}

function generateReportPlainText(type, includeTitle = true) {
  const isMorning = type === 'morning';
  const lines = [];

  if (includeTitle) lines.push(isMorning ? 'Morning Report' : 'Evening Report');
  lines.push(isMorning ? 'おはようございます。' : 'お疲れさまです.');
  lines[lines.length - 1] = isMorning ? 'おはようございます。' : 'お疲れさまです。';
  lines.push(
    isMorning
      ? `本日（${reportDateText(1)}）の業務を開始いたします。`
      : `本日（${reportDateText(0)}）の業務を終了いたします。`
  );
  lines.push('');

  pushTaskBlocks(lines);
  lines.push('');
  lines.push(isMorning ? '本日もよろしくお願いいたします。' : '本日もありがとうございました。');
  return lines.join('\n');
}

function generateCombinedPlainText() {
  return `${generateReportPlainText('evening')}\n\n\n${generateReportPlainText('morning')}`;
}

function appendTextLine(parent, text, className = 'message-line') {
  const line = document.createElement('div');
  line.className = className;
  line.textContent = text;
  parent.appendChild(line);
  return line;
}

function appendTaskPreviewLine(parent, task) {
  const line = document.createElement('div');
  line.className = 'message-line';
  const id = task.id.trim();

  if (id) {
    line.append(document.createTextNode(`WUNDOU-${id} `));
    const link = document.createElement('a');
    link.href = `${BACKLOG_BASE}${encodeURIComponent(id)}`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = taskDisplayName(task);
    line.append(link);
  } else {
    line.append(document.createTextNode(taskDisplayName(task)));
  }

  const percent = percentText(task.statusPercent);
  if (percent) line.append(document.createTextNode(` ${percent}`));
  parent.appendChild(line);
}

function appendReportPreview(parent, type) {
  const isMorning = type === 'morning';
  appendTextLine(parent, isMorning ? 'Morning Report' : 'Evening Report', 'message-title');
  appendTextLine(parent, isMorning ? 'おはようございます。' : 'お疲れさまです。');
  appendTextLine(
    parent,
    isMorning
      ? `本日（${reportDateText(1)}）の業務を開始いたします。`
      : `本日（${reportDateText(0)}）の業務を終了いたします。`
  );
  appendTextLine(parent, '', 'message-spacer');

  ASSIGNEES.forEach((assignee, assigneeIndex) => {
    appendTextLine(parent, `------------------${assignee.toUpperCase()}----------------------`, 'message-divider');
    reportTasks(assignee).forEach(task => appendTaskPreviewLine(parent, task));
    if (assigneeIndex < ASSIGNEES.length - 1) appendTextLine(parent, '', 'message-spacer');
  });

  appendTextLine(parent, '', 'message-spacer');
  appendTextLine(parent, isMorning ? '本日もよろしくお願いいたします。' : '本日もありがとうございました。');
}

function buildCombinedPreview() {
  els.combinedPreview.innerHTML = '';
  appendReportPreview(els.combinedPreview, 'evening');
  appendTextLine(els.combinedPreview, '', 'message-report-gap');
  appendTextLine(els.combinedPreview, '', 'message-report-gap');
  appendReportPreview(els.combinedPreview, 'morning');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function taskClipboardHtml(task) {
  const id = task.id.trim();
  const name = escapeHtml(taskDisplayName(task));
  const percent = percentText(task.statusPercent);
  const percentHtml = percent ? ` ${escapeHtml(percent)}` : '';

  if (id) {
    const url = `${BACKLOG_BASE}${encodeURIComponent(id)}`;
    return `<div>WUNDOU-${escapeHtml(id)} <a href="${url}">${name}</a>${percentHtml}</div>`;
  }

  return `<div>${name}${percentHtml}</div>`;
}

function generateReportClipboardHtml(type) {
  const isMorning = type === 'morning';
  const html = ['<div>'];
  html.push(`<div><strong>${isMorning ? 'Morning Report' : 'Evening Report'}</strong></div>`);
  html.push(`<div>${isMorning ? 'おはようございます。' : 'お疲れさまです。'}</div>`);
  html.push(`<div>${isMorning
    ? `本日（${reportDateText(1)}）の業務を開始いたします。`
    : `本日（${reportDateText(0)}）の業務を終了いたします。`}</div>`);
  html.push('<div><br></div>');

  ASSIGNEES.forEach((assignee, assigneeIndex) => {
    html.push(`<div>------------------${escapeHtml(assignee.toUpperCase())}----------------------</div>`);
    reportTasks(assignee).forEach(task => html.push(taskClipboardHtml(task)));
    if (assigneeIndex < ASSIGNEES.length - 1) html.push('<div><br></div>');
  });

  html.push('<div><br></div>');
  html.push(`<div>${isMorning ? '本日もよろしくお願いいたします。' : '本日もありがとうございました。'}</div>`);
  html.push('</div>');
  return html.join('');
}

function generateCombinedClipboardHtml() {
  return `<div>${generateReportClipboardHtml('evening')}<div><br></div><div><br></div>${generateReportClipboardHtml('morning')}</div>`;
}

function updatePreviews() {
  if (state.tab !== 'report') return;
  buildCombinedPreview();
}

async function copyAllReports() {
  const plainText = generateCombinedPlainText();
  const html = generateCombinedClipboardHtml();

  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' })
      });
      await navigator.clipboard.write([clipboardItem]);
      showToast('Evening + Morning reports copied with Backlog links');
      return;
    }

    await navigator.clipboard.writeText(plainText);
    showToast('Both reports copied (plain text fallback)');
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
      showToast('Both reports copied (plain text fallback)');
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
  updatePreviews();
}

els.tasksTabBtn.addEventListener('click', () => setTab('tasks'));
els.reportTabBtn.addEventListener('click', () => setTab('report'));
els.addTaskBtn.addEventListener('click', addTask);
els.copyAllBtn.addEventListener('click', copyAllReports);

loadState();
