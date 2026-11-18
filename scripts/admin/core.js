// scripts/admin/core.js
// AdminPanel object: shared state, date formatters, small helpers and toasts.
// Every other admin script adds its methods to this object.
// RELEVANT FILES: admin.html, scripts/admin/init.js, scripts/admin/main.js

const AdminPanel = {
  db: null,
  auth: null,
  functions: null,
  DEFAULT_TICKET_PRICE: 120,
  calendarStartHour: 6,
  calendarEndHour: 22,
  currentTimeTicker: null,
  state: {
    classes: [],
    bookingsMap: new Map(),
    waitlistsMap: new Map(),
    weeklySchedule: {},
    weekDates: [],
    recentNotifications: [],
    currentAttendance: {},
    selectedClass: null,
    attendanceCharts: {},
    unsubClasses: null,
    unsubBookings: [],
    unsubWaitlists: [],
    unsubRecentNotifs: null,
    attendanceData: null,
    attendanceLastAt: 0,
    unsubCapacity: null,
    attendanceRangeKey: '',
    attendanceTickTimer: null,
    userSearchResults: [], // the member open in the detail card (0 or 1 docs)
    todayAttendance: new Set(), // ids of today's classes that already have attendance saved
    todayAttendanceKey: '',
    unsubTodayAttendance: null,
    unsubTicketPrice: null, // live listener on appSettings/reports (price per class)
    reels: [],              // all reels, sorted by order (scripts/admin/reels.js)
    unsubReels: null,
    editingReelId: null,
    reelPlayTimer: null, // "Reproducir" in the reel preview (scripts/admin/reels.js)
    unsubBanner: null,      // live listener on appSettings/feedbackBanner (scripts/admin/banner.js)
    bannerDirty: false,     // true while staff have unsaved banner edits
    analyticsTracker: {
      bookingTimeline: {}
    },
    dashboardContainers: {},
    selectedMetrics: new Set(['attended','absent','booked','utilization','revenue']),
    selectedPeriod: 'range',
    selectedClassType: 'all',
    selectedInstructor: 'all',
    dailyMessages: [],
    unsubDailyMessages: null,
    userCache: new Map(),
    subscriptionAllUsers: [], // everyone the live listener returned
    subscriptionUsers: [],    // the same list after the search box filter
    unsubSubscriptionUsers: null
  },

  // --- Helpers ---
  timeFmt: new Intl.DateTimeFormat('es-MX',{ timeZone: 'America/Mexico_City', hour:'2-digit',minute:'2-digit',hour12:false }),
  timePartsFmt: new Intl.DateTimeFormat('es-MX',{ timeZone: 'America/Mexico_City', hour:'2-digit',minute:'2-digit',hour12:false }),
  dayShortFmt: new Intl.DateTimeFormat('es-MX',{ timeZone: 'America/Mexico_City', day:'2-digit',month:'short' }),
  weekdayNameFmt: new Intl.DateTimeFormat('es-MX',{ timeZone: 'America/Mexico_City', weekday:'long' }),
  weekdayShortFmt: new Intl.DateTimeFormat('es-MX',{ timeZone: 'America/Mexico_City', weekday:'short' }),
  fullDateFmt: new Intl.DateTimeFormat('es-MX',{ timeZone: 'America/Mexico_City', dateStyle:'medium', timeStyle:'short' }),
  dateHelper: {
    ymd(date){ return new Intl.DateTimeFormat('en-CA',{ timeZone: 'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit' }).format(date); },
    today(){ return this.ymd(new Date()); }
  },
  normalizeStr(s=''){
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  },
  formatWeekdayLabel(dateStr=''){
    // Converts an ISO date into "Lunes - 26" so the calendar headers show the active day number.
    if (!dateStr) return null;
    const base = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    const weekdayRaw = this.weekdayNameFmt.format(base) || '';
    const prettyWeekday = weekdayRaw ? `${weekdayRaw.charAt(0).toUpperCase()}${weekdayRaw.slice(1)}` : '';
    return `${prettyWeekday} - ${base.getDate()}`.trim();
  },

  formatWeekdayShortLabel(dateStr=''){
    // Returns a short weekday string (e.g. "Lun") for chart labels.
    if (!dateStr) return '';
    const base = new Date(`${dateStr}T00:00:00-06:00`);
    if (Number.isNaN(base.getTime())) return '';
    const raw = this.weekdayShortFmt.format(base) || '';
    const cleaned = raw.replace('.', '');
    if (!cleaned) return '';
    return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
  },

  // --- TOASTS ---
  showToast({ title='Hecho', message='', variant='success', timeout=3000 }){
    const color = variant==='error'?'rose': variant==='warn'?'amber':'emerald';
    const wrap = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast max-w-md mx-auto bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-lg flex items-start gap-3';
    const safeTitle = DOMPurify.sanitize(title);
    const safeMessage = DOMPurify.sanitize(message);
    el.innerHTML = `
      <div class="w-10 h-10 rounded-lg bg-${color}-500/20 text-${color}-300 flex items-center justify-center shrink-0">
        <i data-lucide="${variant==='error'?'alert-triangle':variant==='warn'?'alert-circle':'check'}" class="w-6 h-6"></i>
      </div>
      <div class="flex-1">
        <p class="font-semibold">${safeTitle}</p>
        ${safeMessage?`<p class="text-sm text-zinc-400 mt-0.5">${safeMessage}</p>`:''}
      </div>
      <button class="shrink-0 text-zinc-400 hover:text-zinc-200" aria-label="Cerrar notificación">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>`;
    wrap.appendChild(el);
    lucide.createIcons({ attrs:{'aria-hidden':'true'} });
    const close = () => el.remove();
    el.querySelector('button').addEventListener('click', close);
    if (timeout) setTimeout(close, timeout);
  },
};
