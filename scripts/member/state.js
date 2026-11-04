// scripts/member/state.js
// App state, announcement rotation, render batching, URL screen and DOM refs.
// The shared data every member screen reads and updates.
// RELEVANT FILES: scripts/member/render.js, scripts/member/listeners.js, scripts/member/interactions.js

// ---- Estado
let state = {
  currentUser: null,
  classes: [],
  myBookings: [],
  waitlistEntries: [],
  attendanceRecords: {},
  currentScreen: 'agenda',
  scheduleFilter: 'today',
  selectedClassId: null,
  subscriptionType: 'monthly',
  isTotalPass: false,
  cancellationStrikes: 0,
  dailyMessage: null,
  errors: { classes: false, bookings: false },
  loading: {
    classes: true,
    bookings: true,
    users: false
  }
};

// Daily messages can now rotate when multiple announcements are active.
const DAILY_MESSAGE_ROTATION_MS = 10000;
let dailyMessageRotation = {
  intervalId: null,
  messages: [],
  index: 0,
  paused: false
};

// Announcements the member closed on this device (by message id). New messages still show.
const DISMISSED_MESSAGES_KEY = 'madness:dismissedMessages';
function readDismissedMessages(){
  try { return JSON.parse(localStorage.getItem(DISMISSED_MESSAGES_KEY)) || []; } catch { return []; }
}
function rememberDismissedMessages(ids){
  // Keep the list short; old ids belong to messages that are long gone.
  const merged = [...new Set([...readDismissedMessages(), ...ids.filter(Boolean)])].slice(-50);
  try { localStorage.setItem(DISMISSED_MESSAGES_KEY, JSON.stringify(merged)); } catch {}
}

function stopDailyMessageRotation(){
  if (dailyMessageRotation.intervalId){
    clearInterval(dailyMessageRotation.intervalId);
  }
  dailyMessageRotation.intervalId = null;
  dailyMessageRotation.messages = [];
  dailyMessageRotation.index = 0;
  dailyMessageRotation.paused = false;
}

function startDailyMessageRotation(messages){
  // We reset timers and store a shallow copy so future snapshots can replace the queue safely.
  stopDailyMessageRotation();
  dailyMessageRotation.messages = messages.slice();
  if (!dailyMessageRotation.messages.length){
    state.dailyMessage = null;
    return;
  }
  dailyMessageRotation.index = 0;
  state.dailyMessage = dailyMessageRotation.messages[0];
  scheduleAgendaDataRender();
  dailyMessageRotation.intervalId = setInterval(()=>{
    if (dailyMessageRotation.paused || matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('[data-message-id]:hover, [data-message-id]:focus-within')) return;
    if (!dailyMessageRotation.messages.length){
      stopDailyMessageRotation();
      return;
    }
    dailyMessageRotation.index = (dailyMessageRotation.index + 1) % dailyMessageRotation.messages.length;
    state.dailyMessage = dailyMessageRotation.messages[dailyMessageRotation.index];
    scheduleAgendaDataRender();
  }, DAILY_MESSAGE_ROTATION_MS);
}

function getStrikeInfo(){
  const strikesRaw = Number(state.cancellationStrikes);
  const strikeCount = Number.isFinite(strikesRaw) && strikesRaw > 0 ? Math.min(strikesRaw, 3) : 0;
  const strikeMessage = strikeCount >= 3
    ? 'Llegaste al límite de 3 strikes. Tu cuenta queda bloqueada temporalmente.'
    : strikeCount === 2
      ? 'Estás a 1 strike del bloqueo. Cancela con tiempo.'
      : strikeCount === 1
        ? 'Tienes 1 strike. Cancela con más de 2 horas de anticipación.'
        : 'Evita cancelar tarde para no llegar a 3 strikes.';
  return { strikeCount, strikeMessage };
}

// ---- Render batching
let renderQueued=false;
function scheduleRender(){
  if (renderQueued) return;
  renderQueued=true;
  requestAnimationFrame(()=>{ renderQueued=false; render(); });
}
function scheduleAgendaDataRender(){
  // Agenda data can update in the background, but Perfil should not rebuild for it.
  if (['agenda','history','classDetails'].includes(state.currentScreen)) scheduleRender();
}

// Screen via querystring
const _params = new URLSearchParams(location.search);
const requestedScreen = _params.get('screen');
const _screen = ['schedule', 'bookings'].includes(requestedScreen) ? 'agenda' : requestedScreen;
state.selectedClassId = _params.get('classId');
if (_screen && ['agenda','history','profile','classDetails'].includes(_screen)) state.currentScreen=_screen;

// DOM refs
const mainContent = document.getElementById('main-content');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loadingSpinner = document.getElementById('loading-spinner');
const navBar = document.getElementById('nav-bar');
const toastEl = document.getElementById('toast');
let toastTimeout;
function showToast(message, type = 'info', opts = {}) {
  if (!toastEl) return;
  const { html = false, duration = 3000 } = opts;
  if (html) toastEl.innerHTML = message; else toastEl.textContent = message;
  toastEl.classList.remove('opacity-0', 'bg-orange-600', 'bg-red-600', 'bg-zinc-800');
  const color = type === 'success' ? 'bg-orange-600' : type === 'error' ? 'bg-red-600' : 'bg-zinc-800';
  toastEl.classList.add(color, 'opacity-100');
  toastEl.focus();
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('opacity-100');
    toastEl.classList.add('opacity-0');
  }, duration);
}
window.showToast = showToast;
