// /scripts/admin/admin-attendance-core.js
// Fetches attendance, bookings, and class data to feed analytics dashboards
// Keeps data-loading concerns isolated from rendering and insight helpers
// RELEVANT FILES: scripts/admin/admin-state.js, scripts/admin/admin-attendance-calculations.js, scripts/admin/admin-attendance-dashboard.js

import { AdminPanel } from './admin-state.js';

AdminPanel.refreshAttendanceFilters = function refreshAttendanceFilters() {
  const classFilter = document.getElementById('class-filter');
  const instructorFilter = document.getElementById('instructor-filter');
  if (!classFilter || !instructorFilter) return;
  const classTypes = new Set(['all']);
  const instructors = new Set(['all']);
  this.state.classes.forEach((cls) => {
    if (cls.type) classTypes.add(cls.type);
    else if (cls.category) classTypes.add(cls.category);
    if (cls.instructor) instructors.add(cls.instructor);
  });
  const classValue = classFilter.value || this.state.selectedClassType;
  const instructorValue = instructorFilter.value || this.state.selectedInstructor;
  classFilter.innerHTML = Array.from(classTypes)
    .map((val) => {
      const safe = DOMPurify.sanitize(val);
      const label = val === 'all' ? 'Todas' : safe;
      const selected = val === classValue ? 'selected' : '';
      return `<option value="${safe}" ${selected}>${label}</option>`;
    })
    .join('');
  instructorFilter.innerHTML = Array.from(instructors)
    .map((val) => {
      const safe = DOMPurify.sanitize(val);
      const label = val === 'all' ? 'Todos' : safe;
      const selected = val === instructorValue ? 'selected' : '';
      return `<option value="${safe}" ${selected}>${label}</option>`;
    })
    .join('');
  this.state.selectedClassType = classFilter.value;
  this.state.selectedInstructor = instructorFilter.value;
};

AdminPanel.getDefaultAttendanceRange = function getDefaultAttendanceRange() {
  const today = this.dateHelper.today();
  const end = new Date(`${today}T00:00:00-06:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 2);
  return { start: this.dateHelper.ymd(start), end: this.dateHelper.ymd(end) };
};

AdminPanel.getSelectedAttendanceRange = function getSelectedAttendanceRange() {
  const def = this.getDefaultAttendanceRange();
  const sEl = document.getElementById('att-start-date');
  const eEl = document.getElementById('att-end-date');
  let start = sEl?.value;
  let end = eEl?.value;
  if (!start || !end || start > end) {
    start = def.start;
    end = def.end;
    if (sEl) sEl.value = start;
    if (eEl) eEl.value = end;
  }
  return { start, end };
};

AdminPanel.startAttendancePolling = function startAttendancePolling() {
  this.fetchAttendanceData(true);
  this.stopAttendancePolling();
  this.state.unsubCapacity = this.db.collection('bookings').onSnapshot(() => {
    this.fetchAttendanceData(true);
  });
  this.state.attendanceTickTimer = setInterval(() => {
    this.updateAttendanceLegend();
  }, 1000);
};

AdminPanel.stopAttendancePolling = function stopAttendancePolling() {
  if (this.state.unsubCapacity) {
    this.state.unsubCapacity();
    this.state.unsubCapacity = null;
  }
  if (this.state.attendanceTickTimer) {
    clearInterval(this.state.attendanceTickTimer);
    this.state.attendanceTickTimer = null;
  }
};

AdminPanel.fetchAttendanceData = async function fetchAttendanceData(force = false) {
  const loadingEl = document.getElementById('dashboard-loading');
  if (loadingEl) loadingEl.classList.remove('hidden');
  const now = Date.now();
  const { start, end } = this.getSelectedAttendanceRange();
  const report = {};
  const labels = [];
  const aggregateContext = {
    classPopularity: new Map(),
    heatmap: {},
    instructorTotals: {},
    totals: { revenue: 0, target: 0, repeat: 0, newMembers: 0, cancellations: 0, noShows: 0 }
  };
  const userStatsMap = new Map();
  const cancellationsByDay = {};
  const startDate = new Date(`${start}T00:00:00-06:00`);
  const endDate = new Date(`${end}T00:00:00-06:00`);
  for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
    const clone = new Date(dt);
    const dayKey = this.dateHelper.ymd(clone);
    report[dayKey] = {
      attended: 0,
      absent: 0,
      booked: 0,
      totalCapacity: 0,
      utilizationRate: 0,
      warning: '',
      details: { attended: {}, absent: {}, booked: {} },
      revenue: 0,
      revenueTarget: 0,
      repeatBookings: 0,
      newMembers: 0,
      cancellations: 0,
      noShows: 0,
      popularityScore: 0,
      instructorMetrics: {},
      peakHours: {},
      memberRetention: 0
    };
    labels.push({ date: dayKey, label: this.dayShortFmt.format(clone) });
  }
  try {
    const [attendanceSnap, classesSnap, bookingsSnap] = await Promise.all([
      this.db.collection('attendance').where('classDate', '>=', start).where('classDate', '<=', end).get(),
      this.db.collection('classes').where('classDate', '>=', start).where('classDate', '<=', end).get(),
      this.db.collection('bookings').where('classDate', '>=', start).where('classDate', '<=', end).get()
    ]);

    attendanceSnap.forEach((doc) => {
      const rec = doc.data();
      if (!rec.classDate || !report[rec.classDate]) return;
      const cat = rec.status === 'attended' ? 'attended' : 'absent';
      report[rec.classDate][cat] += 1;
      const labelBase = rec.classTime ?? rec.className ?? '';
      const key = `${labelBase} - ${rec.className || ''}`.trim();
      if (!report[rec.classDate].details[cat][key]) report[rec.classDate].details[cat][key] = [];
      report[rec.classDate].details[cat][key].push(rec.userName || rec.userId || 'Anónimo');
    });

    const classesByDay = {};
    classesSnap.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (!data.classDate || !report[data.classDate]) return;
      if (data.classDate && data.time) {
        const startAt = new Date(`${data.classDate}T${data.time}:00Z`);
        data.localDate = this.dateHelper.ymd(startAt);
        data.localTime = this.timeFmt.format(startAt);
      }
      if (!classesByDay[data.classDate]) classesByDay[data.classDate] = [];
      classesByDay[data.classDate].push(data);
    });

    const listenerClassesByDay = {};
    this.state.classes.forEach((cls) => {
      const day = cls.localDate || cls.classDate;
      if (!day || !report[day]) return;
      if (!listenerClassesByDay[day]) listenerClassesByDay[day] = [];
      listenerClassesByDay[day].push({ ...cls });
    });

    const bookingsByClass = {};
    bookingsSnap.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (!data.classId) return;
      if (!bookingsByClass[data.classId]) bookingsByClass[data.classId] = [];
      bookingsByClass[data.classId].push(data);
      const userKey = data.userId || data.userEmail || data.userName || data.id;
      if (!userStatsMap.has(userKey)) {
        userStatsMap.set(userKey, { count: 0, firstDate: data.classDate || '', revenue: 0, cancellations: 0 });
      }
      const stat = userStatsMap.get(userKey);
      stat.count += 1;
      if (data.classDate && (!stat.firstDate || data.classDate < stat.firstDate)) stat.firstDate = data.classDate;
      stat.revenue += this.estimateClassRevenue({ price: data.price }, 1);
      if ((data.status && data.status === 'cancelled') || data.cancelledAt) {
        stat.cancellations = (stat.cancellations || 0) + 1;
        if (data.classDate) cancellationsByDay[data.classDate] = (cancellationsByDay[data.classDate] || 0) + 1;
      }
    });

    const effectiveClassesByDay = {};
    Object.keys(report).forEach((day) => {
      if (classesByDay[day]?.length) {
        effectiveClassesByDay[day] = classesByDay[day];
      } else if (listenerClassesByDay[day]?.length) {
        effectiveClassesByDay[day] = listenerClassesByDay[day];
      } else {
        effectiveClassesByDay[day] = [];
      }
    });

    Object.entries(effectiveClassesByDay).forEach(([day, classList]) => {
      const base = report[day];
      if (!base) return;
      report[day] = this.calculateDaySnapshot({
        day,
        base,
        classList,
        bookingsByClass,
        userStats: userStatsMap,
        cancellationsByDay,
        aggregates: aggregateContext
      });
    });

    const aggregates = this.buildAttendanceAggregates({
      labels,
      report,
      aggregateContext,
      userStats: userStatsMap
    });

    this.state.attendanceData = {
      report,
      labels,
      classesByDay: effectiveClassesByDay,
      bookingsByClass,
      userStats: userStatsMap,
      cancellationsByDay,
      aggregates
    };
    this.state.attendanceLastAt = now;
    this.updateAttendanceLegend();
    this.renderAttendanceDashboardFromCache();
    this.updateCapacityGauge();
  } catch (e) {
    console.error('Error leyendo asistencia:', e);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
};
