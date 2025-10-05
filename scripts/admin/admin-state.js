// /scripts/admin/admin-state.js
// Sets up the shared AdminPanel object and base formatting helpers for the admin dashboard
// Provides common state so feature modules can extend and reuse admin behaviour
// RELEVANT FILES: admin.html, scripts/admin/admin-core.js, scripts/admin/admin-attendance-core.js

export const AdminPanel = {
  db: null,
  auth: null,
  functions: null,
  FACILITY_MAX_CAPACITY: 75,
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
    attendanceTickTimer: null,
    userSearchResults: [],
    blacklistedUsers: [],
    analyticsTracker: {
      bookingTimeline: {},
      userBehavior: {},
      cancellationTimeline: [],
      switches: []
    },
    selectedMetrics: new Set(['attended', 'absent', 'booked', 'utilization', 'revenue']),
    selectedPeriod: 'range',
    selectedClassType: 'all',
    selectedInstructor: 'all',
    selectedExportFormat: 'capacity',
    dailyMessages: [],
    unsubDailyMessages: null,
    userCache: new Map()
  },

  timeFmt: new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }),
  timePartsFmt: new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }),
  dayFmt: new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    day: '2-digit',
    month: 'short'
  }),
  dayShortFmt: new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short'
  }),
  weekdayNameFmt: new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long'
  }),
  weekdayShortFmt: new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'short'
  }),
  dateHelper: {
    ymd(date) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    },
    today() {
      return this.ymd(new Date());
    },
    tomorrow() {
      return this.ymd(new Date(Date.now() + 86400000));
    },
    yesterday() {
      return this.ymd(new Date(Date.now() - 86400000));
    }
  },
  normalizeStr(s = '') {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  },
  formatWeekdayLabel(dateStr = '') {
    if (!dateStr) return null;
    const base = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    const weekdayRaw = this.weekdayNameFmt.format(base) || '';
    const prettyWeekday = weekdayRaw ? `${weekdayRaw.charAt(0).toUpperCase()}${weekdayRaw.slice(1)}` : '';
    return `${prettyWeekday} - ${base.getDate()}`.trim();
  },
  formatWeekdayShortLabel(dateStr = '') {
    if (!dateStr) return '';
    const base = new Date(`${dateStr}T00:00:00-06:00`);
    if (Number.isNaN(base.getTime())) return '';
    const raw = this.weekdayShortFmt.format(base) || '';
    const cleaned = raw.replace('.', '');
    if (!cleaned) return '';
    return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
  }
};

if (!window.AdminPanel) {
  window.AdminPanel = AdminPanel;
}

export default AdminPanel;
