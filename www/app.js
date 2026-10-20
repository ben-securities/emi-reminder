// ================= DATA & STATE =================
const DEFAULT_LISTS = ['Default', 'Personal', 'Shopping', 'Wishlist', 'Work'];

const INITIAL_TASKS = [];

// Clear existing sample tasks on user request
if (!localStorage.getItem('ios_reminders_tasks_cleared_v2')) {
  localStorage.setItem('ios_reminders_tasks_v2', '[]');
  localStorage.setItem('ios_reminders_history', '[]');
  localStorage.setItem('ios_reminders_notified_v1', '[]');
  localStorage.setItem('ios_reminders_tasks_cleared_v2', 'true');
}

let appState = {
  tasks: JSON.parse(localStorage.getItem('ios_reminders_tasks_v2')) || [],
  lists: JSON.parse(localStorage.getItem('ios_reminders_lists_v2')) || DEFAULT_LISTS,
  finishedHistory: JSON.parse(localStorage.getItem('ios_reminders_history')) || [],
  currentList: 'All Lists',
  searchQuery: '',
  colorTheme: localStorage.getItem('ios_reminders_palette') || 'theme-indigo',
  audioEnabled: true
};

function saveState() {
  localStorage.setItem('ios_reminders_tasks_v2', JSON.stringify(appState.tasks));
  localStorage.setItem('ios_reminders_lists_v2', JSON.stringify(appState.lists));
  localStorage.setItem('ios_reminders_history', JSON.stringify(appState.finishedHistory));
  localStorage.setItem('ios_reminders_palette', appState.colorTheme);
  if (typeof syncScheduledNotifications === 'function') {
    syncScheduledNotifications();
  }
}

// ================= AUDIO SYNTHESIS & NOTIFICATION SOUNDS =================
let sharedAudioCtx = null;
function getSharedAudioContext() {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    return null;
  }
}

// Ensure audio context is ready on first user touch/tap
function unlockAudio() {
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}
window.addEventListener('touchstart', unlockAudio, { passive: true });
window.addEventListener('click', unlockAudio, { passive: true });

function playSound(type = 'check') {
  if (appState && appState.audioEnabled === false && type !== 'check' && type !== 'pop') return;
  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      if (type === 'check') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'reschedule') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'reminder') {
        // Crisp 3-note ascending chime: A5 (880Hz) -> C#6 (1108Hz) -> E6 (1318Hz)
        const playTone = (freq, offset, dur, vol) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + offset);
          gain.gain.setValueAtTime(vol, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + dur);
        };
        playTone(880.0, 0.00, 0.45, 0.6);
        playTone(1108.7, 0.16, 0.45, 0.65);
        playTone(1318.5, 0.32, 0.85, 0.75);
      }
    }
  } catch (e) {
    console.warn('playSound audio context error:', e);
  }

  // Dual playback: also trigger HTML5 audio for reminder chimes
  if (type === 'reminder') {
    try {
      const audio = new Audio('reminder_sound.wav');
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch (_) {}
  }
}

// ================= DOM ELEMENTS & EDIT STATE =================
let editingTaskId = null;
let currentTaskDate = null;
let currentTaskTime = null;
let currentTaskRepeat = 'monthly';

const tasksScreen = document.getElementById('tasksScreen');
const newTaskScreen = document.getElementById('newTaskScreen');
const taskFormTitle = document.getElementById('taskFormTitle');
const editHeaderActions = document.getElementById('editHeaderActions');
const shareTaskBtn = document.getElementById('shareTaskBtn');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');
const batchModeRow = document.getElementById('batchModeRow');
const batchModeToggle = document.getElementById('batchModeToggle');
const taskFinishedRow = document.getElementById('taskFinishedRow');
const taskFinishedCheckbox = document.getElementById('taskFinishedCheckbox');
const tasksListArea = document.getElementById('tasksListArea');
const currentListSubtitle = document.getElementById('currentListSubtitle');
const openDrawerBtn = document.getElementById('openDrawerBtn');
const navDrawer = document.getElementById('navDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerListsContainer = document.getElementById('drawerListsContainer');
const openNewTaskBtn = document.getElementById('openNewTaskBtn');
const closeNewTaskBtn = document.getElementById('closeNewTaskBtn');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const taskTitleInput = document.getElementById('taskTitleInput');
const voiceInputBtn = document.getElementById('voiceInputBtn');
const hiddenDateInput = document.getElementById('hiddenDateInput');
const hiddenTimeInput = document.getElementById('hiddenTimeInput');
const dateLabelCol = document.getElementById('dateLabelCol');
const dateDisplayText = document.getElementById('dateDisplayText');
const calendarPickerBtn = document.getElementById('calendarPickerBtn');
const clearDateBtn = document.getElementById('clearDateBtn');
const timeLabelCol = document.getElementById('timeLabelCol');
const timeDisplayText = document.getElementById('timeDisplayText');
const timePickerBtn = document.getElementById('timePickerBtn');
const clearTimeBtn = document.getElementById('clearTimeBtn');
const repeatToggle = document.getElementById('repeatToggle');
const repeatPillBtn = document.getElementById('repeatPillBtn');
const repeatModal = document.getElementById('repeatModal');
const cancelRepeatModalBtn = document.getElementById('cancelRepeatModalBtn');
const taskListSelect = document.getElementById('taskListSelect');
const addListInlineBtn = document.getElementById('addListInlineBtn');
const toggleSearchBtn = document.getElementById('toggleSearchBtn');
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const listModalBackdrop = document.getElementById('listModalBackdrop');
const editListsModalBtn = document.getElementById('editListsModalBtn');
const closeListModalBtn = document.getElementById('closeListModalBtn');
const newListNameInput = document.getElementById('newListNameInput');
const createNewListSubmitBtn = document.getElementById('createNewListSubmitBtn');
const modalListsItemList = document.getElementById('modalListsItemList');
const liveClock = document.getElementById('liveClock');
const viewToggleBtn = document.getElementById('viewToggleBtn');
const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
const toastContainer = document.getElementById('toastContainer');

// ================= CLOCK =================
function updateClock() {
  if (!liveClock) return;
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  hours = hours % 12 || 12;
  liveClock.textContent = `${hours}:${minutes}`;
}
if (liveClock) {
  setInterval(updateClock, 1000);
  updateClock();
}

// ================= THEME & PALETTES =================
const PALETTES = ['theme-indigo', 'theme-emerald', 'theme-sunset', 'theme-light'];
function applyTheme(palette) {
  PALETTES.forEach(p => document.body.classList.remove(p));
  document.body.classList.add(palette);
  appState.colorTheme = palette;
  themeIcon.className = palette === 'theme-light' ? 'fa-solid fa-moon' : 'fa-regular fa-sun';
  saveState();
}

themeToggleBtn.addEventListener('click', () => {
  playSound('pop');
  const currentIdx = PALETTES.indexOf(appState.colorTheme);
  const nextIdx = (currentIdx + 1) % PALETTES.length;
  applyTheme(PALETTES[nextIdx]);
  const names = {
    'theme-indigo': 'Electric Indigo',
    'theme-emerald': 'Cyber Emerald',
    'theme-sunset': 'Sunset Rose',
    'theme-light': 'Titanium Light'
  };
  showToast(`Theme: ${names[PALETTES[nextIdx]]}`, 'fa-palette');
});
applyTheme(appState.colorTheme);

// ================= TOASTS =================
function showToast(message, icon = 'fa-check') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2400);
}

// ================= ADVANCING RECURRING TASKS =================
function getNextDueDate(dateString, repeatFrequency = 'monthly') {
  const curDate = new Date(dateString);
  const nextDate = new Date(curDate);

  if (repeatFrequency === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (repeatFrequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (repeatFrequency === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (repeatFrequency === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }
  return nextDate.toISOString();
}

// ================= TASK COMPLETION LOGIC =================
function toggleTaskCompletion(taskId, cardElement) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (cardElement) {
    cardElement.classList.add('completing');
  }

  if (task.repeat && task.repeat !== 'none') {
    playSound('reschedule');
    const oldDueDate = new Date(task.dueDate);
    const oldMonthName = oldDueDate.toLocaleString('default', { month: 'short' });
    
    const nextDateISO = getNextDueDate(task.dueDate, task.repeat);
    const nextDueDate = new Date(nextDateISO);
    const nextMonthName = nextDueDate.toLocaleString('default', { month: 'long' });

    appState.finishedHistory.unshift({
      title: task.title,
      list: task.list,
      completedAt: new Date().toISOString(),
      previousPeriod: `${oldMonthName} ${oldDueDate.getDate()}`
    });

    task.dueDate = nextDateISO;
    task.completed = false;

    saveState();

    setTimeout(() => {
      renderTasks();
      showToast(`✓ Paid! Rescheduled for ${nextMonthName}`, 'fa-calendar-plus');
    }, 320);

  } else {
    task.completed = !task.completed;
    playSound(task.completed ? 'check' : 'pop');
    saveState();

    setTimeout(() => {
      renderTasks();
      showToast(task.completed ? 'Task completed!' : 'Task restored');
    }, 280);
  }
}

function isTaskTimeCrossed(task) {
  if (!task || !task.dueDate || task.completed) return false;
  const due = new Date(task.dueDate).getTime();
  return !isNaN(due) && due < Date.now();
}

// ================= FORMATTERS =================
function formatDisplayGroup(task) {
  if (task.completed) return 'Finished';
  if (!task.dueDate) return 'No Date';

  const date = new Date(task.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round((taskDateOnly - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || date.getTime() < now.getTime()) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';

  return date.toLocaleString('default', { month: 'long' });
}

function formatTaskMeta(task) {
  if (!task.dueDate) return 'Not set';
  const d = new Date(task.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((taskDateOnly - today) / (1000 * 60 * 60 * 24));

  const is24h = appState.settings && appState.settings.timeFormat === '24-hour';
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: is24h ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !is24h
  });

  if (diffDays === 1) return `Tomorrow, ${timeStr}`;
  if (diffDays === 0) return `Today, ${timeStr}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeStr}`;
}

// ================= RENDER TASKS =================
function renderTasks() {
  tasksListArea.innerHTML = '';
  currentListSubtitle.textContent = appState.currentList;

  let filtered = appState.tasks.filter(t => {
    if (appState.currentList === 'Finished') {
      return t.completed;
    } else if (appState.currentList !== 'All Lists') {
      if (t.list !== appState.currentList) return false;
      if (t.completed) return false;
    } else {
      if (t.completed) return false;
    }

    if (appState.searchQuery.trim()) {
      const q = appState.searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.list.toLowerCase().includes(q);
    }
    return true;
  });

  if (appState.currentList === 'Finished') {
    renderFinishedTab();
    renderDrawerLists();
    return;
  }

  if (filtered.length === 0) {
    tasksListArea.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-calendar-check"></i>
        <p>No active tasks in <strong>${appState.currentList}</strong></p>
      </div>
    `;
    renderDrawerLists();
    return;
  }

  const groups = {};
  const groupOrder = ['Overdue', 'Today', 'Tomorrow', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'Finished', 'No Date'];

  filtered.forEach(task => {
    const group = formatDisplayGroup(task);
    if (!groups[group]) groups[group] = [];
    groups[group].push(task);
  });

  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    const idxA = groupOrder.indexOf(a);
    const idxB = groupOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  sortedGroupKeys.forEach(groupName => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'task-group';

    const header = document.createElement('h3');
    header.className = `group-header group-${groupName.toLowerCase()}`;
    header.textContent = groupName;
    groupDiv.appendChild(header);

    const sortOrder = (appState.settings && appState.settings.sortOrder) || 'Due date + Alphabetically';
    groups[groupName].sort((a, b) => {
      if (sortOrder === 'Alphabetically') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'Creation order') {
        return (a.id || '').localeCompare(b.id || '');
      }
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.title.localeCompare(b.title);
    });

    groups[groupName].forEach(task => {
      const card = document.createElement('div');
      const isCrossed = isTaskTimeCrossed(task);
      card.className = `task-card ${task.completed ? 'completed' : ''} ${isCrossed ? 'is-overdue' : ''}`;
      card.dataset.id = task.id;

      card.innerHTML = `
        <div class="task-checkbox-col">
          <div class="custom-checkbox" title="Click to pay / complete">
            <i class="fa-solid fa-check"></i>
          </div>
        </div>
        <div class="task-details-col">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta-line">
            <span class="${isCrossed ? 'meta-time-overdue' : ''}">${isCrossed ? '<i class="fa-solid fa-clock-rotate-left"></i> ' : ''}${formatTaskMeta(task)}</span>
            ${task.repeat && task.repeat !== 'none' ? `<span class="repeat-tag"><i class="fa-solid fa-arrows-rotate"></i> ${task.repeat}</span>` : ''}
          </div>
        </div>
        <span class="task-tag-badge">${escapeHtml(task.list)}</span>
      `;

      // Checkbox click to complete/reschedule
      const checkbox = card.querySelector('.custom-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTaskCompletion(task.id, card);
      });

      // Card click to open and edit task
      card.addEventListener('click', (e) => {
        if (e.target.closest('.custom-checkbox')) return;
        openEditTaskView(task.id);
      });

      groupDiv.appendChild(card);
    });

    tasksListArea.appendChild(groupDiv);
  });

  renderDrawerLists();
}

function renderFinishedTab() {
  if (appState.finishedHistory.length === 0) {
    tasksListArea.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <p>No completed bill payments yet</p>
      </div>
    `;
    return;
  }

  const groupDiv = document.createElement('div');
  groupDiv.className = 'task-group';

  const header = document.createElement('h3');
  header.className = 'group-header group-finished';
  header.textContent = 'Payment & Completion Log';
  groupDiv.appendChild(header);

  appState.finishedHistory.forEach(item => {
    const card = document.createElement('div');
    card.className = 'task-card completed';
    card.innerHTML = `
      <div class="task-checkbox-col">
        <div class="custom-checkbox checked-static">
          <i class="fa-solid fa-check" style="display:block"></i>
        </div>
      </div>
      <div class="task-details-col">
        <div class="task-title">${escapeHtml(item.title)}</div>
        <div class="task-meta-line">
          <span>Paid for ${item.previousPeriod || 'Previous period'}</span>
        </div>
      </div>
      <span class="task-tag-badge">${escapeHtml(item.list)}</span>
    `;
    groupDiv.appendChild(card);
  });

  tasksListArea.appendChild(groupDiv);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ================= DRAWER NAVIGATION =================
function renderDrawerLists() {
  drawerListsContainer.innerHTML = '';

  const activeTasks = appState.tasks.filter(t => !t.completed);
  const finishedCount = appState.finishedHistory.length;

  // All Lists
  const allItem = createDrawerItem('All Lists', 'fa-house', activeTasks.length, appState.currentList === 'All Lists');
  drawerListsContainer.appendChild(allItem);

  // Custom User Lists
  appState.lists.forEach(listName => {
    const count = activeTasks.filter(t => t.list === listName).length;
    const item = createDrawerItem(listName, 'fa-list-ul', count, appState.currentList === listName);
    drawerListsContainer.appendChild(item);
  });

  // Finished list
  const finishedItem = createDrawerItem('Finished', 'fa-list-check', finishedCount, appState.currentList === 'Finished');
  drawerListsContainer.appendChild(finishedItem);
}

function createDrawerItem(name, icon, count, isActive) {
  const div = document.createElement('div');
  div.className = `drawer-item ${isActive ? 'active' : ''}`;
  div.innerHTML = `
    <div class="item-left">
      <i class="fa-solid ${icon}"></i>
      <span>${escapeHtml(name)}</span>
    </div>
    ${count > 0 ? `<span class="badge-count">${count}</span>` : ''}
  `;
  div.addEventListener('click', () => {
    playSound('pop');
    appState.currentList = name;
    closeDrawer();
    renderTasks();
  });
  return div;
}

function openDrawer() {
  playSound('pop');
  navDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
}

function closeDrawer() {
  navDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

openDrawerBtn.addEventListener('click', openDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// ================= NEW & EDIT TASK VIEWS =================
function populateListSelect() {
  taskListSelect.innerHTML = '';
  appState.lists.forEach(list => {
    const opt = document.createElement('option');
    opt.value = list;
    opt.textContent = list;
    if (appState.currentList === list) opt.selected = true;
    taskListSelect.appendChild(opt);
  });
}

function formatRepeatLabel(repeat) {
  switch (repeat) {
    case 'daily': return 'Once a Day';
    case 'weekdays': return 'Once a Day (Mon-Fri)';
    case 'weekly': return 'Once a Week';
    case 'monthly': return 'Once a Month';
    case 'yearly': return 'Once a Year';
    default: return 'No Repeat';
  }
}

function updateNotificationDisplay() {
  if (currentTaskDate) {
    const today = new Date();
    const isToday = currentTaskDate.toDateString() === today.toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = currentTaskDate.toDateString() === tomorrow.toDateString();

    if (isToday) {
      dateDisplayText.textContent = 'Today';
    } else if (isTomorrow) {
      dateDisplayText.textContent = 'Tomorrow';
    } else {
      dateDisplayText.textContent = currentTaskDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    clearDateBtn.style.display = 'inline-flex';

    const y = currentTaskDate.getFullYear();
    const m = String(currentTaskDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentTaskDate.getDate()).padStart(2, '0');
    hiddenDateInput.value = `${y}-${m}-${d}`;
  } else {
    dateDisplayText.textContent = 'Date not set';
    clearDateBtn.style.display = 'none';
    hiddenDateInput.value = '';
  }

  if (currentTaskTime) {
    const [h, m] = currentTaskTime.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    timeDisplayText.textContent = `${displayH}:${String(m).padStart(2, '0')} ${period}`;
    clearTimeBtn.style.display = 'inline-flex';
    hiddenTimeInput.value = currentTaskTime;
  } else {
    timeDisplayText.textContent = 'Time not set (all day)';
    clearTimeBtn.style.display = 'none';
    hiddenTimeInput.value = '';
  }
}

function openNewTaskView() {
  playSound('pop');
  editingTaskId = null;
  if (taskFormTitle) taskFormTitle.textContent = 'New Task';
  if (editHeaderActions) editHeaderActions.style.display = 'none';
  if (batchModeRow) batchModeRow.style.display = 'flex';
  if (taskFinishedRow) taskFinishedRow.style.display = 'none';

  taskTitleInput.value = '';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  currentTaskDate = tomorrow;
  currentTaskTime = '10:00';
  updateNotificationDisplay();

  currentTaskRepeat = 'monthly';
  repeatToggle.checked = true;
  repeatPillBtn.style.display = 'inline-block';
  repeatPillBtn.textContent = 'Once a Month';

  populateListSelect();
  if (appState.currentList && appState.currentList !== 'All Lists' && appState.currentList !== 'Finished') {
    taskListSelect.value = appState.currentList;
  }

  tasksScreen.classList.remove('active');
  newTaskScreen.classList.add('active');
  newTaskScreen.scrollTop = 0;
  setTimeout(() => taskTitleInput.focus(), 200);
}

function openEditTaskView(taskId) {
  const task = appState.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;
  playSound('pop');
  editingTaskId = taskId;

  if (taskFormTitle) taskFormTitle.textContent = 'Edit Task';
  if (editHeaderActions) editHeaderActions.style.display = 'flex';
  if (batchModeRow) batchModeRow.style.display = 'none';

  if (taskFinishedRow) {
    taskFinishedRow.style.display = 'flex';
    taskFinishedCheckbox.checked = !!task.completed;
  }

  taskTitleInput.value = task.title || '';

  currentTaskDate = null;
  currentTaskTime = null;
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    if (!isNaN(d.getTime())) {
      currentTaskDate = d;
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      currentTaskTime = `${hours}:${mins}`;
    }
  }
  updateNotificationDisplay();

  currentTaskRepeat = task.repeat || 'none';
  if (currentTaskRepeat && currentTaskRepeat !== 'none') {
    repeatToggle.checked = true;
    repeatPillBtn.style.display = 'inline-block';
    repeatPillBtn.textContent = formatRepeatLabel(currentTaskRepeat);
  } else {
    repeatToggle.checked = false;
    repeatPillBtn.style.display = 'none';
    repeatPillBtn.textContent = 'Once a Month';
  }

  populateListSelect();
  taskListSelect.value = task.list || 'Default';

  tasksScreen.classList.remove('active');
  newTaskScreen.classList.add('active');
  newTaskScreen.scrollTop = 0;
  setTimeout(() => taskTitleInput.focus(), 200);
}

function closeNewTaskView() {
  playSound('pop');
  editingTaskId = null;
  newTaskScreen.classList.remove('active');
  tasksScreen.classList.add('active');
}

openNewTaskBtn.addEventListener('click', openNewTaskView);
closeNewTaskBtn.addEventListener('click', closeNewTaskView);

// Date Picker Handlers
function triggerDatePicker() {
  if (hiddenDateInput.showPicker) {
    try { hiddenDateInput.showPicker(); } catch (e) { hiddenDateInput.focus(); }
  } else {
    hiddenDateInput.focus();
    hiddenDateInput.click();
  }
}
calendarPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  triggerDatePicker();
});
dateLabelCol.addEventListener('click', triggerDatePicker);

hiddenDateInput.addEventListener('change', () => {
  if (hiddenDateInput.value) {
    const [y, m, d] = hiddenDateInput.value.split('-').map(Number);
    currentTaskDate = new Date(y, m - 1, d);
    updateNotificationDisplay();
  }
});
clearDateBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  currentTaskDate = null;
  hiddenDateInput.value = '';
  updateNotificationDisplay();
});

// Time Picker Handlers
function triggerTimePicker() {
  if (hiddenTimeInput.showPicker) {
    try { hiddenTimeInput.showPicker(); } catch (e) { hiddenTimeInput.focus(); }
  } else {
    hiddenTimeInput.focus();
    hiddenTimeInput.click();
  }
}
timePickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  triggerTimePicker();
});
timeLabelCol.addEventListener('click', triggerTimePicker);

hiddenTimeInput.addEventListener('change', () => {
  if (hiddenTimeInput.value) {
    currentTaskTime = hiddenTimeInput.value;
    updateNotificationDisplay();
  }
});
clearTimeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  currentTaskTime = null;
  hiddenTimeInput.value = '';
  updateNotificationDisplay();
});

// Repeat Handlers
repeatToggle.addEventListener('change', () => {
  if (repeatToggle.checked) {
    repeatPillBtn.style.display = 'inline-block';
    if (!currentTaskRepeat || currentTaskRepeat === 'none') {
      currentTaskRepeat = 'monthly';
    }
    repeatPillBtn.textContent = formatRepeatLabel(currentTaskRepeat);
  } else {
    repeatPillBtn.style.display = 'none';
  }
});

repeatPillBtn.addEventListener('click', () => {
  repeatModal.style.display = 'flex';
});

cancelRepeatModalBtn.addEventListener('click', () => {
  repeatModal.style.display = 'none';
});

repeatModal.addEventListener('click', (e) => {
  if (e.target === repeatModal) repeatModal.style.display = 'none';
});

document.querySelectorAll('.repeat-dialog-item').forEach(item => {
  item.addEventListener('click', () => {
    const repeatVal = item.dataset.repeat;
    currentTaskRepeat = repeatVal;
    if (repeatVal === 'none') {
      repeatToggle.checked = false;
      repeatPillBtn.style.display = 'none';
    } else {
      repeatToggle.checked = true;
      repeatPillBtn.style.display = 'inline-block';
      repeatPillBtn.textContent = formatRepeatLabel(repeatVal);
    }
    repeatModal.style.display = 'none';
  });
});

// Save Task (Create or Update)
if (saveTaskBtn) {
  saveTaskBtn.addEventListener('click', () => {
    const title = taskTitleInput.value.trim();
    if (!title) {
      showToast('Please enter a task title', 'fa-triangle-exclamation');
      taskTitleInput.focus();
      return;
    }

    let dueDateISO = null;
    if (currentTaskDate) {
      const d = new Date(currentTaskDate);
      if (currentTaskTime) {
        const [h, m] = currentTaskTime.split(':').map(Number);
        d.setHours(h, m, 0, 0);
      } else {
        d.setHours(12, 0, 0, 0);
      }
      dueDateISO = d.toISOString();
    }

    const repeatVal = repeatToggle.checked ? (currentTaskRepeat || 'monthly') : 'none';
    const selectedList = taskListSelect.value || 'Default';

    if (editingTaskId) {
      const task = appState.tasks.find(t => String(t.id) === String(editingTaskId));
      if (task) {
        task.title = title;
        task.dueDate = dueDateISO;
        task.list = selectedList;
        task.repeat = repeatVal;
        if (taskFinishedCheckbox) {
          task.completed = taskFinishedCheckbox.checked;
        }
        saveState();
        playSound('check');
        showToast('Task updated!', 'fa-pen-to-square');
      }
      closeNewTaskView();
      renderTasks();
    } else {
      const newTask = {
        id: 't-' + Date.now(),
        title: title,
        dueDate: dueDateISO,
        list: selectedList,
        repeat: repeatVal,
        completed: false
      };

      appState.tasks.unshift(newTask);
      saveState();
      playSound('check');
      showToast('Reminder added!');

      if (batchModeToggle && batchModeToggle.checked) {
        taskTitleInput.value = '';
        taskTitleInput.focus();
      } else {
        closeNewTaskView();
        renderTasks();
      }
    }
  });
}

// Delete Task in Edit Mode
if (deleteTaskBtn) {
  deleteTaskBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const taskIndex = appState.tasks.findIndex(t => String(t.id) === String(editingTaskId));
    if (taskIndex !== -1) {
      const removed = appState.tasks.splice(taskIndex, 1)[0];
      saveState();
      playSound('pop');
      showToast(`Deleted "${removed.title}"`, 'fa-trash');
      closeNewTaskView();
      renderTasks();
    }
  });
}

// Share Task
if (shareTaskBtn) {
  shareTaskBtn.addEventListener('click', () => {
    const title = taskTitleInput.value.trim();
    const dateStr = dateDisplayText ? dateDisplayText.textContent : '';
    const shareText = `Reminder: ${title} (${dateStr})`;
    if (navigator.share) {
      navigator.share({ title: title, text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        showToast('Task copied to clipboard!', 'fa-copy');
      }).catch(() => {
        showToast(shareText, 'fa-share-nodes');
      });
    }
  });
}

// ================= SPEECH TO TEXT =================
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    voiceInputBtn.classList.add('listening');
    showToast('Listening...', 'fa-microphone');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    taskTitleInput.value = (taskTitleInput.value ? taskTitleInput.value + ' ' : '') + transcript;
    voiceInputBtn.classList.remove('listening');
  };

  recognition.onerror = () => voiceInputBtn.classList.remove('listening');
  recognition.onend = () => voiceInputBtn.classList.remove('listening');
}

voiceInputBtn.addEventListener('click', () => {
  if (!recognition) {
    showToast('Voice input not supported in this browser', 'fa-triangle-exclamation');
    return;
  }
  try { recognition.start(); } catch (e) { recognition.stop(); }
});

// ================= SEARCH =================
toggleSearchBtn.addEventListener('click', () => {
  playSound('pop');
  searchContainer.classList.toggle('open');
  if (searchContainer.classList.contains('open')) {
    searchInput.focus();
  } else {
    searchInput.value = '';
    appState.searchQuery = '';
    renderTasks();
  }
});

searchInput.addEventListener('input', () => {
  appState.searchQuery = searchInput.value;
  renderTasks();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  appState.searchQuery = '';
  renderTasks();
  searchInput.focus();
});

// ================= LIST MODAL =================
function renderModalLists() {
  modalListsItemList.innerHTML = '';
  appState.lists.forEach((list, index) => {
    const li = document.createElement('li');
    li.className = 'modal-list-item';
    li.innerHTML = `
      <span>${escapeHtml(list)}</span>
      ${list !== 'Default' ? `<button class="modal-delete-btn" data-index="${index}"><i class="fa-solid fa-trash"></i></button>` : ''}
    `;
    modalListsItemList.appendChild(li);
  });

  modalListsItemList.querySelectorAll('.modal-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const removed = appState.lists.splice(idx, 1)[0];
      if (appState.currentList === removed) appState.currentList = 'All Lists';
      saveState();
      renderModalLists();
      renderDrawerLists();
      populateListSelect();
      renderTasks();
      showToast(`Removed "${removed}"`);
    });
  });
}

function openListModal() {
  renderModalLists();
  listModalBackdrop.classList.add('open');
  newListNameInput.value = '';
  setTimeout(() => newListNameInput.focus(), 200);
}

function closeListModal() {
  listModalBackdrop.classList.remove('open');
}

editListsModalBtn.addEventListener('click', () => {
  closeDrawer();
  openListModal();
});
addListInlineBtn.addEventListener('click', openListModal);
closeListModalBtn.addEventListener('click', closeListModal);
listModalBackdrop.addEventListener('click', (e) => {
  if (e.target === listModalBackdrop) closeListModal();
});

createNewListSubmitBtn.addEventListener('click', () => {
  const name = newListNameInput.value.trim();
  if (!name) return;
  if (appState.lists.includes(name)) {
    showToast('List already exists');
    return;
  }
  appState.lists.push(name);
  saveState();
  renderModalLists();
  renderDrawerLists();
  populateListSelect();
  taskListSelect.value = name;
  newListNameInput.value = '';
  showToast(`Created "${name}"!`);
});

// ================= DESKTOP VIEW TOGGLES =================
viewToggleBtn.addEventListener('click', () => {
  document.body.classList.remove('mode-fullscreen');
  viewToggleBtn.classList.add('active');
  fullscreenToggleBtn.classList.remove('active');
});

fullscreenToggleBtn.addEventListener('click', () => {
  document.body.classList.add('mode-fullscreen');
  fullscreenToggleBtn.classList.add('active');
  viewToggleBtn.classList.remove('active');
});

// ================= INITIAL RENDER =================
renderTasks();

// Register Service Worker for offline capability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// ================= SETTINGS SCREEN LOGIC (matching user screenshot 2) =================
const settingsBtn = document.getElementById('settingsBtn');
const settingsScreen = document.getElementById('settingsScreen');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

// Subtitle elements
const settingThemeSubtitle = document.getElementById('settingThemeSubtitle');
const settingTimeFormatSubtitle = document.getElementById('settingTimeFormatSubtitle');
const settingFirstDaySubtitle = document.getElementById('settingFirstDaySubtitle');
const settingSortOrderSubtitle = document.getElementById('settingSortOrderSubtitle');
const settingSoundSubtitle = document.getElementById('settingSoundSubtitle');

// Toggles & Controls
const voiceToggle = document.getElementById('voiceToggle');
const vibrationToggle = document.getElementById('vibrationToggle');
const vibrationLevelsRow = document.getElementById('vibrationLevelsRow');
const daySummaryToggle = document.getElementById('daySummaryToggle');
const summaryTimePill = document.getElementById('summaryTimePill');
const hiddenSummaryTimeInput = document.getElementById('hiddenSummaryTimeInput');

// Choice Selection Modal
const settingChoiceModal = document.getElementById('settingChoiceModal');
const settingChoiceTitle = document.getElementById('settingChoiceTitle');
const settingChoiceList = document.getElementById('settingChoiceList');
const cancelSettingChoiceBtn = document.getElementById('cancelSettingChoiceBtn');

// Backup Rows
const settingExportRow = document.getElementById('settingExportRow');
const settingImportFileInput = document.getElementById('settingImportFileInput');
const settingClearLogRow = document.getElementById('settingClearLogRow');
const settingClearAllTasksRow = document.getElementById('settingClearAllTasksRow');

// Load settings preferences from storage or defaults
if (!appState.settings) {
  appState.settings = JSON.parse(localStorage.getItem('ios_reminders_settings')) || {
    timeFormat: '12-hour',
    firstDayOfWeek: 'Sunday',
    sortOrder: 'Due date + Alphabetically',
    soundRingtone: 'Default ringtone (Bubble)',
    voiceEnabled: false,
    vibrationEnabled: true,
    vibrationLevel: 1,
    daySummaryEnabled: false,
    daySummaryTime: '8:00 AM'
  };
}

function saveSettings() {
  localStorage.setItem('ios_reminders_settings', JSON.stringify(appState.settings));
}

const THEME_NAMES = {
  'theme-indigo': 'Electric Indigo',
  'theme-emerald': 'Cyber Emerald',
  'theme-sunset': 'Sunset Rose',
  'theme-light': 'Titanium Light'
};

function updateSettingsUI() {
  if (settingThemeSubtitle) {
    settingThemeSubtitle.textContent = THEME_NAMES[appState.colorTheme] || 'Electric Indigo';
  }
  if (settingTimeFormatSubtitle) {
    settingTimeFormatSubtitle.textContent = appState.settings.timeFormat;
  }
  if (settingFirstDaySubtitle) {
    settingFirstDaySubtitle.textContent = appState.settings.firstDayOfWeek;
  }
  if (settingSortOrderSubtitle) {
    settingSortOrderSubtitle.textContent = appState.settings.sortOrder;
  }
  if (settingSoundSubtitle) {
    settingSoundSubtitle.textContent = appState.settings.soundRingtone;
  }
  if (voiceToggle) {
    voiceToggle.checked = !!appState.settings.voiceEnabled;
  }
  if (vibrationToggle) {
    vibrationToggle.checked = !!appState.settings.vibrationEnabled;
  }
  if (vibrationLevelsRow) {
    vibrationLevelsRow.querySelectorAll('.vibe-num-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vibe == appState.settings.vibrationLevel);
    });
  }
  if (daySummaryToggle) {
    daySummaryToggle.checked = !!appState.settings.daySummaryEnabled;
  }
  if (summaryTimePill) {
    summaryTimePill.textContent = appState.settings.daySummaryTime || '8:00 AM';
  }
}

// Open / Close Settings View Screen
function openSettingsView() {
  playSound('pop');
  closeDrawer();
  updateSettingsUI();
  tasksScreen.classList.remove('active');
  newTaskScreen.classList.remove('active');
  if (settingsScreen) {
    settingsScreen.classList.add('active');
    settingsScreen.scrollTop = 0;
  }
}

function closeSettingsView() {
  playSound('pop');
  if (settingsScreen) {
    settingsScreen.classList.remove('active');
  }
  tasksScreen.classList.add('active');
}

if (settingsBtn) settingsBtn.addEventListener('click', openSettingsView);
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsView);

// Generic Choice Picker Modal
function openChoiceModal(title, options, currentValue, onSelect) {
  if (!settingChoiceModal) return;
  settingChoiceTitle.textContent = title;
  settingChoiceList.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'repeat-dialog-item';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'space-between';
    btn.innerHTML = `
      <span>${opt.label || opt}</span>
      ${(opt.value || opt) === currentValue ? '<i class="fa-solid fa-check" style="color: var(--accent-cyan);"></i>' : ''}
    `;
    btn.addEventListener('click', () => {
      onSelect(opt.value || opt, opt.label || opt);
      settingChoiceModal.style.display = 'none';
      playSound('pop');
    });
    settingChoiceList.appendChild(btn);
  });

  settingChoiceModal.style.display = 'flex';
}

if (cancelSettingChoiceBtn) {
  cancelSettingChoiceBtn.addEventListener('click', () => {
    settingChoiceModal.style.display = 'none';
  });
}

if (settingChoiceModal) {
  settingChoiceModal.addEventListener('click', (e) => {
    if (e.target === settingChoiceModal) settingChoiceModal.style.display = 'none';
  });
}

// 0. Remove Ads Action
const settingRemoveAdsRow = document.getElementById('settingRemoveAdsRow');
if (settingRemoveAdsRow) {
  settingRemoveAdsRow.addEventListener('click', () => {
    playSound('check');
    showToast('Pro version active — 100% ad-free forever!', 'fa-circle-check');
  });
}

// 1. Theme Selection
const settingThemeRow = document.getElementById('settingThemeRow');
if (settingThemeRow) {
  settingThemeRow.addEventListener('click', () => {
    const themeOptions = [
      { value: 'theme-indigo', label: 'Electric Indigo' },
      { value: 'theme-emerald', label: 'Cyber Emerald' },
      { value: 'theme-sunset', label: 'Sunset Rose' },
      { value: 'theme-light', label: 'Titanium Light' }
    ];
    openChoiceModal('Theme', themeOptions, appState.colorTheme, (val, label) => {
      applyTheme(val);
      settingThemeSubtitle.textContent = label;
      showToast(`Theme: ${label}`, 'fa-palette');
    });
  });
}

// 2. Time Format Selection
const settingTimeFormatRow = document.getElementById('settingTimeFormatRow');
if (settingTimeFormatRow) {
  settingTimeFormatRow.addEventListener('click', () => {
    const timeOptions = ['12-hour', '24-hour'];
    openChoiceModal('Time format', timeOptions, appState.settings.timeFormat, (val) => {
      appState.settings.timeFormat = val;
      saveSettings();
      settingTimeFormatSubtitle.textContent = val;
      renderTasks();
      showToast(`Time format: ${val}`, 'fa-clock');
    });
  });
}

// 3. First Day of Week Selection
const settingFirstDayRow = document.getElementById('settingFirstDayRow');
if (settingFirstDayRow) {
  settingFirstDayRow.addEventListener('click', () => {
    const dayOptions = ['Sunday', 'Monday', 'Saturday'];
    openChoiceModal('First day of week', dayOptions, appState.settings.firstDayOfWeek, (val) => {
      appState.settings.firstDayOfWeek = val;
      saveSettings();
      settingFirstDaySubtitle.textContent = val;
      showToast(`First day: ${val}`, 'fa-calendar-days');
    });
  });
}

// 4. Sort Order Selection
const settingSortOrderRow = document.getElementById('settingSortOrderRow');
if (settingSortOrderRow) {
  settingSortOrderRow.addEventListener('click', () => {
    const sortOptions = [
      'Due date + Alphabetically',
      'Due date only',
      'Alphabetically',
      'Creation order'
    ];
    openChoiceModal('Sort order', sortOptions, appState.settings.sortOrder, (val) => {
      appState.settings.sortOrder = val;
      saveSettings();
      settingSortOrderSubtitle.textContent = val;
      renderTasks();
      showToast(`Sort order: ${val}`, 'fa-bars-staggered');
    });
  });
}

// 5. Sound Selection
const settingSoundRow = document.getElementById('settingSoundRow');
if (settingSoundRow) {
  settingSoundRow.addEventListener('click', () => {
    const soundOptions = [
      'Default ringtone (Bubble)',
      'Chime',
      'Pop',
      'Silent'
    ];
    openChoiceModal('Sound', soundOptions, appState.settings.soundRingtone, (val) => {
      appState.settings.soundRingtone = val;
      appState.audioEnabled = val !== 'Silent';
      saveSettings();
      saveState();
      settingSoundSubtitle.textContent = val;
      if (val !== 'Silent') playSound('check');
      showToast(`Sound: ${val}`, 'fa-music');
    });
  });
}

// 6. Voice Toggle
if (voiceToggle) {
  voiceToggle.addEventListener('change', () => {
    appState.settings.voiceEnabled = voiceToggle.checked;
    saveSettings();
    showToast(voiceToggle.checked ? 'TTS Voice enabled' : 'TTS Voice disabled', 'fa-head-side-cough');
  });
}

// 7. Vibration Toggle & Levels
if (vibrationToggle) {
  vibrationToggle.addEventListener('change', () => {
    appState.settings.vibrationEnabled = vibrationToggle.checked;
    saveSettings();
    if (vibrationToggle.checked && navigator.vibrate) {
      navigator.vibrate(100);
    }
    showToast(vibrationToggle.checked ? 'Vibration enabled' : 'Vibration disabled', 'fa-mobile-screen-button');
  });
}

if (vibrationLevelsRow) {
  vibrationLevelsRow.querySelectorAll('.vibe-num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = Number(btn.dataset.vibe);
      appState.settings.vibrationLevel = level;
      saveSettings();
      vibrationLevelsRow.querySelectorAll('.vibe-num-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (appState.settings.vibrationEnabled && navigator.vibrate) {
        navigator.vibrate(level * 40);
      }
      playSound('pop');
    });
  });
}

// 8. Day Summary Toggle & Time
if (daySummaryToggle) {
  daySummaryToggle.addEventListener('change', () => {
    appState.settings.daySummaryEnabled = daySummaryToggle.checked;
    saveSettings();
    showToast(daySummaryToggle.checked ? 'Day summary active' : 'Day summary disabled', 'fa-calendar-check');
  });
}

if (summaryTimePill && hiddenSummaryTimeInput) {
  summaryTimePill.addEventListener('click', () => {
    if (hiddenSummaryTimeInput.showPicker) {
      try { hiddenSummaryTimeInput.showPicker(); } catch (e) { hiddenSummaryTimeInput.focus(); }
    } else {
      hiddenSummaryTimeInput.focus();
      hiddenSummaryTimeInput.click();
    }
  });

  hiddenSummaryTimeInput.addEventListener('change', () => {
    if (hiddenSummaryTimeInput.value) {
      const [h, m] = hiddenSummaryTimeInput.value.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const formatted = `${displayH}:${String(m).padStart(2, '0')} ${period}`;
      appState.settings.daySummaryTime = formatted;
      summaryTimePill.textContent = formatted;
      saveSettings();
      showToast(`Summary set to ${formatted}`, 'fa-clock');
    }
  });
}

// 9. Data & Backup Actions
if (settingExportRow) {
  settingExportRow.addEventListener('click', () => {
    const exportObj = {
      version: '2.4.0',
      exportedAt: new Date().toISOString(),
      tasks: appState.tasks,
      lists: appState.lists,
      finishedHistory: appState.finishedHistory,
      colorTheme: appState.colorTheme,
      settings: appState.settings
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `reminders_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    playSound('pop');
    showToast('Backup downloaded!', 'fa-file-export');
  });
}

if (settingImportFileInput) {
  settingImportFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported.tasks)) {
          appState.tasks = imported.tasks;
          if (Array.isArray(imported.lists)) appState.lists = imported.lists;
          if (Array.isArray(imported.finishedHistory)) appState.finishedHistory = imported.finishedHistory;
          if (imported.colorTheme) applyTheme(imported.colorTheme);
          if (imported.settings) {
            appState.settings = imported.settings;
            saveSettings();
          }

          saveState();
          renderTasks();
          renderDrawerLists();
          populateListSelect();
          updateSettingsUI();
          playSound('check');
          showToast('Backup restored successfully!', 'fa-circle-check');
        } else {
          showToast('Invalid backup file format', 'fa-triangle-exclamation');
        }
      } catch (err) {
        showToast('Error reading backup file', 'fa-triangle-exclamation');
      }
      settingImportFileInput.value = '';
    };
    reader.readAsText(file);
  });
}

if (settingClearLogRow) {
  settingClearLogRow.addEventListener('click', () => {
    if (confirm('Clear completed payment log history?')) {
      appState.finishedHistory = [];
      saveState();
      playSound('pop');
      showToast('Payment log cleared', 'fa-clock-rotate-left');
      if (appState.currentList === 'Finished') renderTasks();
    }
  });
}

if (settingClearAllTasksRow) {
  settingClearAllTasksRow.addEventListener('click', () => {
    if (confirm('Delete all tasks and reminders?')) {
      appState.tasks = [];
      appState.finishedHistory = [];
      saveState();
      renderTasks();
      renderDrawerLists();
      playSound('pop');
      showToast('All tasks cleared!', 'fa-trash-can');
    }
  });
}

// Initialize settings on page load
updateSettingsUI();

// ================= REMINDER NOTIFICATION SYSTEM =================
const REMINDER_CHANNEL_ID = 'emi_reminders_v2';
const notifiedTaskIds = new Set(JSON.parse(localStorage.getItem('ios_reminders_notified_v1') || '[]'));

function saveNotifiedTaskIds() {
  localStorage.setItem('ios_reminders_notified_v1', JSON.stringify([...notifiedTaskIds]));
}

function getLocalNotificationsPlugin() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    return window.Capacitor.Plugins.LocalNotifications;
  }
  return null;
}

async function initNotificationChannel() {
  const ln = getLocalNotificationsPlugin();
  if (!ln) return;
  try {
    // Delete older silent/cached channel
    try {
      await ln.deleteChannel({ id: 'emi_reminders_channel_v1' });
    } catch (_) {}

    // High-importance channel ensures sound, vibration, and heads-up banner on Android 8 - 16
    await ln.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'EMI Task Reminders',
      description: 'Alerts when EMI bill and task time is reached',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1, // VISIBILITY_PUBLIC
      sound: 'reminder_sound.wav', // In android/app/src/main/res/raw/reminder_sound.wav
      vibration: true,
      lights: true,
      lightColor: '#ff334b'
    });
  } catch (e) {
    console.warn('Channel creation error:', e);
  }
}

async function requestNotificationPermissions() {
  const ln = getLocalNotificationsPlugin();
  if (ln) {
    try {
      await initNotificationChannel();
      const status = await ln.requestPermissions();
      if (status.display === 'granted') {
        return true;
      }
    } catch (e) {
      console.warn('Capacitor notification permission error:', e);
    }
  }

  if ('Notification' in window) {
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch (e) {}
  }
  return false;
}

// Generate stable positive integer hash for task ID
function getNotificationId(idStr) {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

async function syncScheduledNotifications() {
  const ln = getLocalNotificationsPlugin();
  if (!ln) return;

  try {
    await initNotificationChannel();
    const pending = await ln.getPending();
    if (pending && pending.notifications && pending.notifications.length > 0) {
      await ln.cancel({ notifications: pending.notifications });
    }

    const futureTasks = appState.tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const due = new Date(t.dueDate).getTime();
      return due > Date.now();
    });

    if (futureTasks.length === 0) return;

    const notificationsToSchedule = futureTasks.slice(0, 50).map(t => {
      const due = new Date(t.dueDate);
      return {
        id: getNotificationId(String(t.id)),
        title: `⏰ EMI Reminder: ${t.title}`,
        body: `${t.list ? `List: ${t.list} • ` : ''}Due now: ${formatTaskMeta(t)}`,
        schedule: {
          at: due,
          allowWhileIdle: true
        },
        channelId: REMINDER_CHANNEL_ID,
        sound: 'reminder_sound.wav',
        extra: { taskId: t.id },
        iconColor: '#ff334b'
      };
    });

    await ln.schedule({ notifications: notificationsToSchedule });
  } catch (err) {
    console.warn('Error scheduling local notifications:', err);
  }
}

// Fire an immediate reminder notification for a task
function fireReminderNotification(task, isTest = false) {
  if (!task) return;
  const title = isTest ? `⏰ Test Reminder: ${task.title}` : `⏰ EMI Reminder: ${task.title}`;
  const body = isTest ? `Notification is working! (${task.list})` : `Task time is hit! ${formatTaskMeta(task)}`;

  // 1. Native Capacitor Local Notification
  const ln = getLocalNotificationsPlugin();
  if (ln) {
    initNotificationChannel().then(() => {
      ln.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 1000000),
          title: title,
          body: body,
          schedule: {
            at: new Date(Date.now() + 100),
            allowWhileIdle: true
          },
          channelId: REMINDER_CHANNEL_ID,
          sound: 'reminder_sound.wav',
          extra: { taskId: task.id },
          iconColor: '#ff334b'
        }]
      }).catch((e) => console.warn('Capacitor schedule immediate error:', e));
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // 2. Web Notification API
    try {
      new Notification(title, {
        body: body,
        icon: '/icon-192.png',
        tag: `reminder-${task.id}`
      });
    } catch (e) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body,
            icon: '/icon-192.png',
            tag: `reminder-${task.id}`
          });
        }).catch(() => {});
      }
    }
  }

  // 3. Audio chime
  if (appState.audioEnabled) {
    playSound('reminder');
  }

  // 4. Haptic vibration
  if (appState.settings?.vibrationEnabled && navigator.vibrate) {
    const level = appState.settings.vibrationLevel || 1;
    navigator.vibrate([120 * level, 80, 180 * level]);
  }

  // 5. TTS Voice if enabled in settings
  if (appState.settings?.voiceEnabled && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Reminder: ${task.title}`);
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  // 6. In-App Notification Toast
  showToast(isTest ? `🔔 Notification sent!` : `⏰ Time reached: "${task.title}"`, 'fa-bell');
}

// Background / in-app checker for crossed tasks
function checkTasksForCrossedReminders() {
  const now = Date.now();
  let newlyCrossed = false;

  appState.tasks.forEach(task => {
    if (!task.dueDate || task.completed) return;
    const due = new Date(task.dueDate).getTime();
    if (isNaN(due)) return;

    // If time reached / crossed within the past 2 hours and hasn't notified yet
    if (due <= now && (now - due) < 1000 * 60 * 60 * 2) {
      if (!notifiedTaskIds.has(task.id)) {
        notifiedTaskIds.add(task.id);
        newlyCrossed = true;
        fireReminderNotification(task);
      }
    }
  });

  if (newlyCrossed) {
    saveNotifiedTaskIds();
  }

  // Always re-render so crossed times dynamically update to red without manual refresh
  renderTasks();
}

// Test Notification button in Settings
const settingTestNotifRow = document.getElementById('settingTestNotifRow');
if (settingTestNotifRow) {
  settingTestNotifRow.addEventListener('click', async () => {
    await requestNotificationPermissions();
    const sampleTask = appState.tasks.find(t => !t.completed) || {
      id: 'test-reminder',
      title: 'Home Current Bill',
      list: 'Personal',
      dueDate: new Date().toISOString()
    };
    fireReminderNotification(sampleTask, true);
  });
}

// Initialize notification system
setTimeout(() => {
  requestNotificationPermissions();
  syncScheduledNotifications();
}, 1000);

// Check for newly crossed task times every 5 seconds for instant notification when time hits
setInterval(checkTasksForCrossedReminders, 5000);

// Allow clicking a notification to open the app or task
const localNotificationsPlugin = getLocalNotificationsPlugin();
if (localNotificationsPlugin) {
  localNotificationsPlugin.addListener('localNotificationActionPerformed', (notification) => {
    const taskId = notification.notification?.extra?.taskId;
    if (taskId) {
      openEditTaskView(taskId);
    }
  });
}
