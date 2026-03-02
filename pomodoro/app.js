/* ==========================================================
   Pomodoro Focus Tracker — app.js  (v4)
   ----------------------------------------------------------
   ARCHITECTURE: Main-thread timer with ABSOLUTE TIMESTAMPS.
   
   The timer stores targetEndTime (wall clock ms). On each
   tick it computes remaining = targetEndTime - Date.now().
   If the user leaves/locks and comes back, visibilitychange
   recalculates instantly — no drift, no bugs.
   
   Wake Lock API keeps the screen on during active timers.
   If the user declines or the API isn't available, the timer
   still works correctly thanks to timestamp math.
   
   SW is only used for offline caching + notifications.
   ========================================================== */

'use strict';

/* ----------------------------------------------------------
   1. INDEXEDDB
   ---------------------------------------------------------- */

const DB_NAME = 'PomodoroDB';
const DB_VERSION = 2;
const STORE_SESSIONS = 'sessions';
const STORE_SETTINGS = 'settings';
const STORE_COUNTERS = 'counters';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const s = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date', { unique: false });
        s.createIndex('tag', 'tag', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_COUNTERS)) {
        db.createObjectStore(STORE_COUNTERS, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveSession(session) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).add(session);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}

function deleteSession(id) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}

function updateSessionTag(id, newTag) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    const req = store.get(id);
    req.onsuccess = () => {
      const session = req.result;
      if (session) {
        session.tag = newTag;
        store.put(session);
      }
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}

function getSessions(filterDate, filterTag) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const req = tx.objectStore(STORE_SESSIONS).getAll();
    req.onsuccess = () => {
      let r = req.result;
      if (filterDate) r = r.filter((s) => s.date === filterDate);
      if (filterTag) r = r.filter((s) => s.tag === filterTag);
      r.sort((a, b) => b.startTime - a.startTime);
      res(r);
    };
    req.onerror = () => rej(req.error);
  }));
}

function getSessionsInRange(start, end) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const req = tx.objectStore(STORE_SESSIONS).index('date').getAll(IDBKeyRange.bound(start, end));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

function saveSetting(key, value) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key, value });
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}

function loadSetting(key, def) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(key);
    req.onsuccess = () => res(req.result ? req.result.value : def);
    req.onerror = () => rej(req.error);
  }));
}

/* --- Counter DB helpers --- */

function getAllCounters() {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_COUNTERS, 'readonly');
    const req = tx.objectStore(STORE_COUNTERS).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

function saveCounter(counter) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_COUNTERS, 'readwrite');
    tx.objectStore(STORE_COUNTERS).put(counter);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}

function addCounter(name) {
  const counter = { name, value: 0, archived: false, log: [] };
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_COUNTERS, 'readwrite');
    const req = tx.objectStore(STORE_COUNTERS).add(counter);
    tx.oncomplete = () => { counter.id = req.result; res(counter); };
    tx.onerror = () => rej(tx.error);
  }));
}

function deleteCounter(id) {
  return openDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE_COUNTERS, 'readwrite');
    tx.objectStore(STORE_COUNTERS).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}


/* ----------------------------------------------------------
   2. STATE
   ----------------------------------------------------------
   Timer truth is in targetEndTime (absolute wall clock ms).
   Everything else is derived from it.
   ---------------------------------------------------------- */

const state = {
  phase: 'work',              // 'work' | 'short-break' | 'long-break'
  pomodoroCount: 0,
  durationMs: 25 * 60 * 1000, // total phase duration
  targetEndTime: null,         // absolute ms when countdown hits 0
  pausedRemainingMs: null,     // ms left when paused (null = not paused)
  isRunning: false,
  isOvertime: false,           // true once targetEndTime has passed
  phaseCompleteHandled: false, // prevents double-firing onPhaseComplete
  intervalId: null,
  sessionStartTime: null,      // work session start timestamp

  // Settings
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  tags: ['Trabajo', 'Estudio', 'Personal', 'Proyecto'],
  wakeLockEnabled: true,

  // Current session metadata
  currentTag: '',
  currentDesc: '',
};


/* ----------------------------------------------------------
   3. DOM
   ---------------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  wakelockBadge: $('#wakelock-badge'),
  timerTime: $('#timer-time'),
  timerProgress: $('#timer-progress'),
  timerPhaseName: $('#timer-phase-name'),
  timerOvertime: $('#timer-overtime'),
  phaseIndicator: $('#phase-indicator'),
  phaseLabel: $('#phase-label'),
  btnPlay: $('#btn-play'),
  btnReset: $('#btn-reset'),
  btnSkip: $('#btn-skip'),
  btnFinish: $('#btn-finish'),
  iconPlay: $('#icon-play'),
  iconPause: $('#icon-pause'),
  tagChips: $('#tag-chips'),
  sessionDesc: $('#session-desc'),
  modal: $('#modal-complete'),
  modalTags: $('#modal-tags'),
  modalDesc: $('#modal-desc'),
  modalSave: $('#modal-save'),
  modalSkip: $('#modal-skip'),
  statToday: $('#stat-today'),
  statStreak: $('#stat-streak'),
  statHours: $('#stat-hours'),
  weeklyChart: $('#weekly-chart'),
  filterDate: $('#filter-date'),
  filterTag: $('#filter-tag'),
  sessionList: $('#session-list'),
  btnExport: $('#btn-export'),
  historyTagList: $('#history-tag-list'),
  historyNewTag: $('#history-new-tag'),
  historyAddTag: $('#history-add-tag'),
  setWork: $('#set-work'),
  setShort: $('#set-short'),
  setLong: $('#set-long'),
  setWakelock: $('#set-wakelock'),
  tagManageList: $('#tag-manage-list'),
  newTagInput: $('#new-tag-input'),
  btnAddTag: $('#btn-add-tag'),
  navItems: $$('.nav-item'),
  screens: $$('.screen'),
};


/* ----------------------------------------------------------
   4. WAKE LOCK API
   ----------------------------------------------------------
   Keeps the screen on while timer is active.
   Falls back gracefully if not supported.
   ---------------------------------------------------------- */

let wakeLock = null;

async function acquireWakeLock() {
  if (!state.wakeLockEnabled) return;
  if (!('wakeLock' in navigator)) {
    console.log('[WakeLock] API not supported');
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('[WakeLock] Acquired');
    dom.wakelockBadge.style.display = 'inline-flex';

    // Re-acquire if released (e.g. tab switch)
    wakeLock.addEventListener('release', () => {
      console.log('[WakeLock] Released');
      dom.wakelockBadge.style.display = 'none';
      wakeLock = null;
    });
  } catch (err) {
    console.log('[WakeLock] Failed:', err.message);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
  dom.wakelockBadge.style.display = 'none';
}

// Re-acquire on visibility change (Chrome releases it on tab switch)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.isRunning && state.wakeLockEnabled) {
    acquireWakeLock();
  }
});


/* ----------------------------------------------------------
   5. NAVIGATION
   ---------------------------------------------------------- */

function switchScreen(id) {
  dom.screens.forEach((s) => s.classList.remove('active'));
  dom.navItems.forEach((n) => n.classList.remove('active'));
  $(`#${id}`).classList.add('active');
  $(`.nav-item[data-screen="${id}"]`).classList.add('active');
  if (id === 'screen-history') loadHistory();
  if (id === 'screen-counters') loadCounters();
}

dom.navItems.forEach((btn) => {
  btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
});


/* ----------------------------------------------------------
   6. TIMER ENGINE
   ----------------------------------------------------------
   Uses absolute timestamps. Every tick just computes:
     remaining = targetEndTime - Date.now()
   
   This is immune to setInterval drift, phone sleep, tab
   switches, etc. When you come back, it instantly shows
   the correct time (or overtime).
   ---------------------------------------------------------- */

const CIRCUMFERENCE = 2 * Math.PI * 120;

function fmtSecs(totalSecs) {
  const m = Math.floor(Math.abs(totalSecs) / 60);
  const s = Math.abs(totalSecs) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tick() {
  const now = Date.now();

  if (state.pausedRemainingMs !== null) {
    // Paused — show frozen time
    const secs = Math.ceil(state.pausedRemainingMs / 1000);
    renderTimer(secs, false, 0);
    return;
  }

  if (!state.targetEndTime) return;

  const remainingMs = state.targetEndTime - now;

  if (remainingMs > 0) {
    // Normal countdown
    const secs = Math.ceil(remainingMs / 1000);
    renderTimer(secs, false, 0);
  } else {
    // Past target — overtime
    const overtimeSecs = Math.floor((-remainingMs) / 1000);
    renderTimer(0, true, overtimeSecs);

    if (!state.phaseCompleteHandled) {
      state.phaseCompleteHandled = true;
      onPhaseComplete();
    }
  }
}

function renderTimer(remainingSecs, overtime, overtimeSecs) {
  // Time display
  dom.timerTime.textContent = fmtSecs(remainingSecs);

  // Ring progress
  const totalSecs = state.durationMs / 1000;
  const progress = overtime ? 1 : Math.max(0, Math.min(1, 1 - (remainingSecs / totalSecs)));
  const offset = CIRCUMFERENCE * (1 - progress);
  dom.timerProgress.style.strokeDasharray = CIRCUMFERENCE;
  dom.timerProgress.style.strokeDashoffset = offset;

  // Overtime
  if (overtime) {
    state.isOvertime = true;
    dom.timerOvertime.textContent = `+${fmtSecs(overtimeSecs)}`;
    dom.timerOvertime.style.display = 'block';
    document.body.classList.add('state-overtime');
    dom.btnFinish.style.display = 'block';
  } else {
    dom.timerOvertime.style.display = 'none';
    document.body.classList.remove('state-overtime');
  }

  // Page title
  document.title = overtime
    ? `+${fmtSecs(overtimeSecs)} — Pomodoro`
    : `${fmtSecs(remainingSecs)} — Pomodoro`;
}

function updatePhaseUI() {
  const names = { 'work': 'Trabajo', 'short-break': 'Descanso corto', 'long-break': 'Descanso largo' };
  dom.timerPhaseName.textContent = names[state.phase];
  dom.phaseLabel.textContent = state.phase === 'work'
    ? `Pomodoro ${state.pomodoroCount + 1}/4`
    : names[state.phase];

  document.body.classList.remove('state-break', 'state-long-break');
  if (state.phase === 'short-break') document.body.classList.add('state-break');
  if (state.phase === 'long-break') document.body.classList.add('state-long-break');

  const dots = dom.phaseIndicator.querySelectorAll('.phase-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('completed', 'current');
    if (i < state.pomodoroCount) dot.classList.add('completed');
    if (i === state.pomodoroCount && state.phase === 'work') dot.classList.add('current');
  });
}

function showPlayIcon(play) {
  dom.iconPlay.style.display = play ? 'block' : 'none';
  dom.iconPause.style.display = play ? 'none' : 'block';
}

/* --- Phase setup --- */

function setPhase(phase) {
  stopInterval();
  releaseWakeLock();

  state.phase = phase;
  state.isRunning = false;
  state.isOvertime = false;
  state.phaseCompleteHandled = false;
  state.targetEndTime = null;
  state.pausedRemainingMs = null;

  switch (phase) {
    case 'work': state.durationMs = state.workMinutes * 60 * 1000; break;
    case 'short-break': state.durationMs = state.shortBreakMinutes * 60 * 1000; break;
    case 'long-break': state.durationMs = state.longBreakMinutes * 60 * 1000; break;
  }

  showPlayIcon(true);
  dom.btnFinish.style.display = 'none';
  renderTimer(state.durationMs / 1000, false, 0);
  updatePhaseUI();
}

/* --- Start / Pause / Resume --- */

function startTimer() {
  if (state.isRunning) return;

  // Record session start for work phases
  if (state.phase === 'work' && !state.sessionStartTime) {
    state.sessionStartTime = Date.now();
    state.currentDesc = dom.sessionDesc.value.trim();
  }

  // Set absolute target
  state.targetEndTime = Date.now() + state.durationMs;
  state.pausedRemainingMs = null;
  state.isRunning = true;
  state.phaseCompleteHandled = false;

  showPlayIcon(false);
  startInterval();
  acquireWakeLock();
}

function pauseTimer() {
  if (!state.isRunning || state.isOvertime) return;

  // Freeze remaining time
  state.pausedRemainingMs = Math.max(0, state.targetEndTime - Date.now());
  state.isRunning = false;

  showPlayIcon(true);
  stopInterval();
  releaseWakeLock();

  // Keep ticking to show paused state
  tick();
}

function resumeTimer() {
  if (state.isOvertime) return;
  if (state.pausedRemainingMs === null) return;

  // Recalculate target from now
  state.targetEndTime = Date.now() + state.pausedRemainingMs;
  state.pausedRemainingMs = null;
  state.isRunning = true;

  showPlayIcon(false);
  startInterval();
  acquireWakeLock();
}

function stopTimer() {
  stopInterval();
  releaseWakeLock();

  state.isRunning = false;
  state.isOvertime = false;
  state.phaseCompleteHandled = false;
  state.targetEndTime = null;
  state.pausedRemainingMs = null;
  state.sessionStartTime = null;

  dom.btnFinish.style.display = 'none';
  document.body.classList.remove('state-overtime');
}

function startInterval() {
  stopInterval();
  state.intervalId = setInterval(tick, 250);
  tick(); // immediate first tick
}

function stopInterval() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

/* --- Phase complete --- */

function onPhaseComplete() {
  // Vibrate
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 400, 100, 200]);

  if (state.phase === 'work') {
    // Notify and enter overtime (timer keeps running, counts up)
    sendNotification('🍅 ¡Pomodoro completado!', `${state.workMinutes} min de enfoque cumplidos.`);
    // Timer continues — overtime display is handled by tick()
    // User must press "Finalizar sesión"
  } else {
    // Break done — notify, stop, advance to work, auto-start
    sendNotification('⏰ ¡Descanso terminado!', 'Es hora de volver al trabajo.');
    setPhase('work');
    startTimer();
  }
}

/* --- Visibility recovery --- */

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Force an immediate tick to sync the display
    if (state.isRunning || state.isOvertime) {
      tick();
    }
    // Re-acquire wake lock (Chrome releases on tab switch)
    if (state.isRunning && state.wakeLockEnabled) {
      acquireWakeLock();
    }
  }
});


/* ----------------------------------------------------------
   7. CONTROLS
   ---------------------------------------------------------- */

dom.btnPlay.addEventListener('click', () => {
  requestNotificationPermission();

  if (state.isOvertime) return;

  if (state.isRunning) {
    pauseTimer();
  } else if (state.pausedRemainingMs !== null) {
    resumeTimer();
  } else {
    startTimer();
  }
});

dom.btnReset.addEventListener('click', () => {
  stopTimer();
  setPhase(state.phase);
});

dom.btnSkip.addEventListener('click', () => {
  stopTimer();

  if (state.phase === 'work') {
    if (state.pomodoroCount >= 3) {
      state.pomodoroCount = 0;
      setPhase('long-break');
    } else {
      setPhase('short-break');
    }
  } else {
    setPhase('work');
  }
});

dom.btnFinish.addEventListener('click', () => {
  showCompletionModal();
});


/* ----------------------------------------------------------
   8. COMPLETION MODAL
   ---------------------------------------------------------- */

function showCompletionModal() {
  renderModalTags();
  dom.modalDesc.value = state.currentDesc;
  dom.modal.classList.add('active');
}

function hideCompletionModal() {
  dom.modal.classList.remove('active');
}

function renderModalTags() {
  dom.modalTags.innerHTML = state.tags.map((tag) => `
    <button class="tag-chip ${tag === state.currentTag ? 'selected' : ''}"
            data-tag="${tag}">${tag}</button>
  `).join('');
  dom.modalTags.querySelectorAll('.tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.modalTags.querySelectorAll('.tag-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });
}

function recordCompletedPomodoro(tag, description) {
  const session = {
    date: toDateString(new Date(state.sessionStartTime || Date.now())),
    startTime: state.sessionStartTime || Date.now(),
    endTime: Date.now(),
    durationMinutes: state.workMinutes,
    tag: tag || '',
    description: description || ''
  };

  saveSession(session).catch((err) => console.error('[Save]', err));

  stopTimer();

  state.pomodoroCount++;
  dom.sessionDesc.value = '';

  if (state.pomodoroCount >= 4) {
    state.pomodoroCount = 0;
    setPhase('long-break');
  } else {
    setPhase('short-break');
  }

  // Auto-start break
  startTimer();
}

dom.modalSave.addEventListener('click', () => {
  const chip = dom.modalTags.querySelector('.tag-chip.selected');
  hideCompletionModal();
  recordCompletedPomodoro(chip ? chip.dataset.tag : '', dom.modalDesc.value.trim());
});

dom.modalSkip.addEventListener('click', () => {
  hideCompletionModal();
  recordCompletedPomodoro(state.currentTag, state.currentDesc);
});


/* ----------------------------------------------------------
   9. TAG CHIPS
   ---------------------------------------------------------- */

function renderTagChips() {
  dom.tagChips.innerHTML = state.tags.map((tag) => `
    <button class="tag-chip ${tag === state.currentTag ? 'selected' : ''}"
            data-tag="${tag}">${tag}</button>
  `).join('');
  dom.tagChips.querySelectorAll('.tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (state.currentTag === chip.dataset.tag) {
        state.currentTag = '';
        chip.classList.remove('selected');
      } else {
        dom.tagChips.querySelectorAll('.tag-chip').forEach((c) => c.classList.remove('selected'));
        state.currentTag = chip.dataset.tag;
        chip.classList.add('selected');
      }
    });
  });
}


/* ----------------------------------------------------------
   10. HISTORY
   ---------------------------------------------------------- */

function toDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTime(ts) { return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); }
function formatDateShort(ds) { const [y, m, d] = ds.split('-'); return `${d}/${m}/${y}`; }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function loadHistory() {
  const fd = dom.filterDate.value || '';
  const ft = dom.filterTag.value || '';

  dom.filterTag.innerHTML = '<option value="">Todas</option>';
  state.tags.forEach((tag) => {
    const o = document.createElement('option');
    o.value = tag; o.textContent = tag;
    if (tag === ft) o.selected = true;
    dom.filterTag.appendChild(o);
  });

  const sessions = await getSessions(fd, ft);

  if (sessions.length === 0) {
    dom.sessionList.innerHTML = '<div class="empty-state">No hay sesiones registradas aún.</div>';
  } else {
    dom.sessionList.innerHTML = sessions.map((s) => `
      <div class="session-item" data-id="${s.id}">
        <button class="session-delete-btn" data-id="${s.id}" aria-label="Eliminar">✕</button>
        <div class="session-item-header">
          <span class="session-date">${formatDateShort(s.date)} · ${formatTime(s.startTime)} → ${formatTime(s.endTime)}</span>
          <span class="session-duration">${s.durationMinutes}min</span>
        </div>
        <span class="session-tag editable" data-id="${s.id}" data-tag="${escapeHtml(s.tag || '')}">${s.tag ? escapeHtml(s.tag) : '+ etiqueta'}</span>
        ${s.description ? `<span class="session-desc">${escapeHtml(s.description)}</span>` : ''}
      </div>
    `).join('');

    // Delete handlers
    dom.sessionList.querySelectorAll('.session-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('¿Eliminar esta sesión?')) {
          await deleteSession(Number(btn.dataset.id));
          loadHistory();
        }
      });
    });

    // Edit tag handlers — click on tag to change it
    dom.sessionList.querySelectorAll('.session-tag.editable').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditTagModal(Number(el.dataset.id), el.dataset.tag);
      });
    });
  }

  renderHistoryTagManagement();
  await updateStats();
  await drawWeeklyChart();
}

async function updateStats() {
  const all = await getSessions();
  const today = toDateString(new Date());
  dom.statToday.textContent = all.filter((s) => s.date === today).length;
  dom.statHours.textContent = (all.reduce((sum, s) => sum + s.durationMinutes, 0) / 60).toFixed(1);

  const uniqueDays = [...new Set(all.map((s) => s.date))].sort().reverse();
  let streak = 0, check = new Date();
  if (uniqueDays.length > 0 && uniqueDays[0] !== toDateString(check)) {
    check.setDate(check.getDate() - 1);
    if (uniqueDays[0] !== toDateString(check)) { dom.statStreak.textContent = '0'; return; }
  }
  for (let i = 0; i < 365; i++) {
    if (uniqueDays.includes(toDateString(check))) { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }
  dom.statStreak.textContent = streak;
}

async function drawWeeklyChart() {
  const canvas = dom.weeklyChart, ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = 160 * dpr;
  canvas.style.width = rect.width + 'px'; canvas.style.height = '160px';
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 160;

  const now = new Date(), dow = (now.getDay() + 6) % 7;
  const mon = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0, 0, 0, 0);
  const weekDates = [], labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); weekDates.push(toDateString(d)); }

  const sessions = await getSessionsInRange(weekDates[0], weekDates[6]);
  const counts = weekDates.map((d) => sessions.filter((s) => s.date === d).length);
  const max = Math.max(...counts, 1);
  ctx.clearRect(0, 0, w, h);
  const barW = Math.min(36, (w - 60) / 7), gap = (w - barW * 7) / 8;
  const top = 24, bot = h - 28, ch = bot - top;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

  counts.forEach((c, i) => {
    const x = gap + i * (barW + gap), bh = max > 0 ? (c / max) * ch : 0, y = bot - bh;
    ctx.fillStyle = c > 0 ? accent : 'rgba(255,255,255,0.06)';
    ctx.beginPath(); roundRect(ctx, x, y, barW, bh || 4, 4); ctx.fill();
    if (c > 0) { ctx.fillStyle = '#eeeef2'; ctx.font = '500 11px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(c, x + barW / 2, y - 6); }
    ctx.fillStyle = weekDates[i] === toDateString(new Date()) ? accent : '#666677';
    ctx.font = '500 10px "Outfit", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(labels[i], x + barW / 2, h - 6);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}


/* ----------------------------------------------------------
   10b. EDIT TAG MODAL (for history sessions)
   ---------------------------------------------------------- */

let editingSessionId = null;

function openEditTagModal(sessionId, currentTag) {
  editingSessionId = sessionId;
  const container = $('#edit-tag-chips');

  // Render tag chips with "none" option
  container.innerHTML = `<button class="tag-chip ${!currentTag ? 'selected' : ''}" data-tag="">Sin etiqueta</button>` +
    state.tags.map((tag) => `
      <button class="tag-chip ${tag === currentTag ? 'selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
    `).join('');

  container.querySelectorAll('.tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.tag-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  $('#modal-edit-tag').classList.add('active');
}

$('#edit-tag-cancel').addEventListener('click', () => {
  $('#modal-edit-tag').classList.remove('active');
  editingSessionId = null;
});

$('#edit-tag-save').addEventListener('click', async () => {
  if (editingSessionId === null) return;
  const chip = $('#edit-tag-chips').querySelector('.tag-chip.selected');
  const newTag = chip ? chip.dataset.tag : '';
  await updateSessionTag(editingSessionId, newTag);
  $('#modal-edit-tag').classList.remove('active');
  editingSessionId = null;
  loadHistory();
});


/* ----------------------------------------------------------
   11. CSV EXPORT
   ---------------------------------------------------------- */

dom.btnExport.addEventListener('click', async () => {
  const sessions = await getSessions(dom.filterDate.value || '', dom.filterTag.value || '');
  if (!sessions.length) { alert('No hay sesiones para exportar.'); return; }
  const header = 'Fecha,Hora Inicio,Hora Fin,Duración (min),Etiqueta,Descripción';
  const rows = sessions.map((s) =>
    `${s.date},${new Date(s.startTime).toLocaleString('es-CL')},${new Date(s.endTime).toLocaleString('es-CL')},${s.durationMinutes},"${(s.tag || '').replace(/"/g, '""')}","${(s.description || '').replace(/"/g, '""')}"`
  );
  const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `pomodoro_historial_${toDateString(new Date())}.csv`; a.click();
  URL.revokeObjectURL(a.href);
});

dom.filterDate.addEventListener('change', loadHistory);
dom.filterTag.addEventListener('change', loadHistory);


/* ----------------------------------------------------------
   12. SETTINGS
   ---------------------------------------------------------- */

async function loadSettings() {
  state.workMinutes = await loadSetting('workMinutes', 25);
  state.shortBreakMinutes = await loadSetting('shortBreakMinutes', 5);
  state.longBreakMinutes = await loadSetting('longBreakMinutes', 15);
  state.tags = await loadSetting('tags', ['Trabajo', 'Estudio', 'Personal', 'Proyecto']);
  state.wakeLockEnabled = await loadSetting('wakeLockEnabled', true);

  dom.setWork.value = state.workMinutes;
  dom.setShort.value = state.shortBreakMinutes;
  dom.setLong.value = state.longBreakMinutes;
  dom.setWakelock.checked = state.wakeLockEnabled;

  setPhase(state.phase);
  renderTagChips();
  renderSettingsTagManagement();
}

function saveAllSettings() {
  saveSetting('workMinutes', parseInt(dom.setWork.value) || 25);
  saveSetting('shortBreakMinutes', parseInt(dom.setShort.value) || 5);
  saveSetting('longBreakMinutes', parseInt(dom.setLong.value) || 15);
  saveSetting('tags', state.tags);
  saveSetting('wakeLockEnabled', state.wakeLockEnabled);
}

let settingsTimeout;
[dom.setWork, dom.setShort, dom.setLong].forEach((input) => {
  input.addEventListener('input', () => {
    clearTimeout(settingsTimeout);
    settingsTimeout = setTimeout(() => {
      state.workMinutes = parseInt(dom.setWork.value) || 25;
      state.shortBreakMinutes = parseInt(dom.setShort.value) || 5;
      state.longBreakMinutes = parseInt(dom.setLong.value) || 15;
      saveAllSettings();
      if (!state.isRunning && state.pausedRemainingMs === null) setPhase(state.phase);
    }, 500);
  });
});

dom.setWakelock.addEventListener('change', () => {
  state.wakeLockEnabled = dom.setWakelock.checked;
  saveAllSettings();
  if (!state.wakeLockEnabled) releaseWakeLock();
  else if (state.isRunning) acquireWakeLock();
});


/* ----------------------------------------------------------
   13. TAG MANAGEMENT
   ---------------------------------------------------------- */

function addTag(value) {
  const v = value.trim();
  if (v && !state.tags.includes(v)) {
    state.tags.push(v);
    saveAllSettings();
    renderTagChips();
    renderSettingsTagManagement();
    renderHistoryTagManagement();
  }
}

function removeTag(tag) {
  state.tags = state.tags.filter((t) => t !== tag);
  saveAllSettings();
  renderTagChips();
  renderSettingsTagManagement();
  renderHistoryTagManagement();
}

function renderTagList(listEl) {
  listEl.innerHTML = state.tags.map((tag) => `
    <div class="tag-manage-item">
      <span>${escapeHtml(tag)}</span>
      <button class="tag-remove-btn" data-tag="${escapeHtml(tag)}">✕</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.tag-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => removeTag(btn.dataset.tag));
  });
}

function renderSettingsTagManagement() { renderTagList(dom.tagManageList); }
dom.btnAddTag.addEventListener('click', () => { addTag(dom.newTagInput.value); dom.newTagInput.value = ''; });
dom.newTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') dom.btnAddTag.click(); });

function renderHistoryTagManagement() { if (dom.historyTagList) renderTagList(dom.historyTagList); }
dom.historyAddTag?.addEventListener('click', () => { addTag(dom.historyNewTag.value); dom.historyNewTag.value = ''; });
dom.historyNewTag?.addEventListener('keydown', (e) => { if (e.key === 'Enter') dom.historyAddTag.click(); });


/* ----------------------------------------------------------
   14. NOTIFICATIONS + SW
   ---------------------------------------------------------- */

async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag: 'pomodoro-' + Date.now() });
    } else {
      try { new Notification(title, { body, icon: './icon-192.png' }); } catch (e) {}
    }
  }
}

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.error('[SW]', e); }
  }
}


/* ----------------------------------------------------------
   15. COUNTERS MODULE
   ----------------------------------------------------------
   Simple named numeric counters with optional notes per change.
   Each counter: { id, name, value, archived, log[] }
   Each log entry: { delta, note, timestamp }
   ---------------------------------------------------------- */

async function loadCounters() {
  const all = await getAllCounters();
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  renderCounters(active, archived);
}

function renderCounters(active, archived) {
  const list = $('#counter-list');
  if (!list) return;

  let html = '';

  if (active.length === 0 && archived.length === 0) {
    html = '<div class="empty-state">No hay contadores. Crea uno para empezar.</div>';
  } else {
    // Active counters
    active.forEach((c) => { html += counterCardHTML(c); });

    // Archived (collapsible)
    if (archived.length > 0) {
      html += `<details class="counter-archived-section">
        <summary class="tag-manager-toggle">Archivados (${archived.length})</summary>
        <div class="counter-archived-list">`;
      archived.forEach((c) => { html += counterCardHTML(c); });
      html += `</div></details>`;
    }
  }

  list.innerHTML = html;

  // Attach all event handlers
  list.querySelectorAll('.counter-card').forEach((card) => {
    const id = Number(card.dataset.id);

    // +/- buttons
    card.querySelector('.counter-add')?.addEventListener('click', () => showCounterDelta(id, 1));
    card.querySelector('.counter-sub')?.addEventListener('click', () => showCounterDelta(id, -1));

    // Edit name (click on name)
    card.querySelector('.counter-name')?.addEventListener('click', () => editCounterName(id, card));

    // Archive/unarchive
    card.querySelector('.counter-archive')?.addEventListener('click', () => toggleArchive(id));

    // Delete
    card.querySelector('.counter-delete')?.addEventListener('click', () => deleteCounterConfirm(id));

    // Toggle log
    card.querySelector('.counter-toggle-log')?.addEventListener('click', () => {
      card.querySelector('.counter-log')?.classList.toggle('open');
    });
  });
}

function counterCardHTML(c) {
  const recentLog = (c.log || []).slice(-5).reverse();
  const hasLog = recentLog.length > 0;

  return `
    <div class="counter-card ${c.archived ? 'archived' : ''}" data-id="${c.id}">
      <div class="counter-header">
        <span class="counter-name" title="Click para editar">${escapeHtml(c.name)}</span>
        <div class="counter-actions">
          <button class="counter-archive" title="${c.archived ? 'Desarchivar' : 'Archivar'}">${c.archived ? '↩' : '📦'}</button>
          <button class="counter-delete" title="Eliminar">✕</button>
        </div>
      </div>
      <div class="counter-body">
        <button class="counter-btn counter-sub">−</button>
        <span class="counter-value">${c.value}</span>
        <button class="counter-btn counter-add">+</button>
      </div>
      ${hasLog ? `
        <button class="counter-toggle-log">Últimos cambios ▾</button>
        <div class="counter-log">
          ${recentLog.map((e) => `
            <div class="counter-log-entry">
              <span class="log-delta ${e.delta >= 0 ? 'pos' : 'neg'}">${e.delta >= 0 ? '+' : ''}${e.delta}</span>
              <span class="log-note">${e.note ? escapeHtml(e.note) : ''}</span>
              <span class="log-time">${new Date(e.timestamp).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })} ${new Date(e.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;
}

/* --- Counter actions (using modals, not prompt) --- */

let pendingDeltaCounterId = null;
let pendingDeltaSign = 1;

function showCounterDelta(id, sign) {
  pendingDeltaCounterId = id;
  pendingDeltaSign = sign;
  $('#counter-delta-title').textContent = sign > 0 ? 'Sumar al contador' : 'Restar del contador';
  $('#counter-delta-amount').value = '1';
  $('#counter-delta-note').value = '';
  $('#modal-counter-delta').classList.add('active');
  setTimeout(() => $('#counter-delta-amount').focus(), 100);
}

$('#counter-delta-cancel').addEventListener('click', () => {
  $('#modal-counter-delta').classList.remove('active');
  pendingDeltaCounterId = null;
});

$('#counter-delta-ok').addEventListener('click', async () => {
  if (pendingDeltaCounterId === null) return;
  const amount = parseFloat($('#counter-delta-amount').value);
  if (isNaN(amount) || amount === 0) return;
  const note = $('#counter-delta-note').value.trim();

  const all = await getAllCounters();
  const c = all.find((x) => x.id === pendingDeltaCounterId);
  if (!c) return;

  const delta = pendingDeltaSign > 0 ? Math.abs(amount) : -Math.abs(amount);
  c.value = Math.round((c.value + delta) * 1000) / 1000;
  c.log = c.log || [];
  c.log.push({ delta, note, timestamp: Date.now() });

  await saveCounter(c);
  $('#modal-counter-delta').classList.remove('active');
  pendingDeltaCounterId = null;
  loadCounters();
});

let pendingRenameCounterId = null;

async function editCounterName(id, card) {
  pendingRenameCounterId = id;
  const current = card.querySelector('.counter-name').textContent;
  $('#counter-rename-input').value = current;
  $('#modal-counter-rename').classList.add('active');
  setTimeout(() => $('#counter-rename-input').focus(), 100);
}

$('#counter-rename-cancel').addEventListener('click', () => {
  $('#modal-counter-rename').classList.remove('active');
  pendingRenameCounterId = null;
});

$('#counter-rename-ok').addEventListener('click', async () => {
  if (pendingRenameCounterId === null) return;
  const newName = $('#counter-rename-input').value.trim();
  if (!newName) return;

  const all = await getAllCounters();
  const c = all.find((x) => x.id === pendingRenameCounterId);
  if (!c) return;
  c.name = newName;
  await saveCounter(c);
  $('#modal-counter-rename').classList.remove('active');
  pendingRenameCounterId = null;
  loadCounters();
});

async function toggleArchive(id) {
  const all = await getAllCounters();
  const c = all.find((x) => x.id === id);
  if (!c) return;
  c.archived = !c.archived;
  await saveCounter(c);
  loadCounters();
}

async function deleteCounterConfirm(id) {
  if (confirm('¿Eliminar este contador y todo su historial?')) {
    await deleteCounter(id);
    loadCounters();
  }
}

/* --- New counter (inline input) --- */
async function createNewCounter() {
  const input = $('#new-counter-name');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  await addCounter(name);
  input.value = '';
  loadCounters();
}


/* ----------------------------------------------------------
   16. INIT
   ---------------------------------------------------------- */

const APP_VERSION = '4.2.0';

async function init() {
  await registerSW();

  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    console.log(`[Storage] Persistent: ${granted}`);
  }

  await loadSettings();
  setPhase('work');
  renderTagChips();
  renderHistoryTagManagement();

  // Counters: new button
  $('#btn-new-counter')?.addEventListener('click', createNewCounter);
  $('#new-counter-name')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') createNewCounter(); });

  // Counter delta: enter key
  $('#counter-delta-amount')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#counter-delta-ok').click(); });
  $('#counter-delta-note')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#counter-delta-ok').click(); });
  $('#counter-rename-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#counter-rename-ok').click(); });

  console.log(`[App] Pomodoro v${APP_VERSION} ready`);
}

init();
