// /scripts/admin/admin-attendance-calculations.js
// Provides reusable calculations for attendance metrics and aggregates
// Keeps number-crunching logic separate from data fetch and rendering layers
// RELEVANT FILES: scripts/admin/admin-attendance-core.js, scripts/admin/admin-attendance-dashboard.js, scripts/admin/admin-state.js

import { AdminPanel } from './admin-state.js';

AdminPanel.estimateClassRevenue = function estimateClassRevenue(cls = {}, quantity) {
  const basePrice = Number(cls.price || this.DEFAULT_TICKET_PRICE || 120);
  return Math.round(Math.max(quantity, 0) * basePrice);
};

AdminPanel.calculateBookingVelocityScore = function calculateBookingVelocityScore(classId, seatsBooked) {
  const tracker = this.state.analyticsTracker;
  if (!tracker || !tracker.bookingTimeline) return 0;
  const raw = tracker.bookingTimeline[classId] || [];
  if (!raw.length) return 0;
  const sorted = [...raw].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const hours = Math.max((last - first) / 3600000, 1 / 12);
  const velocity = seatsBooked / Math.max(hours, 0.1);
  return Math.min(Math.round(velocity * 15), 60);
};

AdminPanel.calculateDaySnapshot = function calculateDaySnapshot({ day, base, classList, bookingsByClass, userStats, cancellationsByDay, aggregates }) {
  const stats = userStats instanceof Map ? userStats : new Map();
  const snapshot = {
    ...base,
    booked: 0,
    totalCapacity: 0,
    utilizationRate: 0,
    revenue: 0,
    revenueTarget: 0,
    repeatBookings: 0,
    newMembers: 0,
    cancellations: cancellationsByDay?.[day] || 0,
    noShows: base?.absent || 0,
    popularityScore: 0,
    instructorMetrics: {},
    peakHours: {},
    memberRetention: 0,
    details: { ...base.details, booked: {} }
  };
  let popularityAccumulator = 0;
  let classesConsidered = 0;
  const filterType = this.state.selectedClassType;
  const filterInstructor = this.state.selectedInstructor;
  const weekdayShort = this.formatWeekdayShortLabel(day);

  classList.forEach((cls) => {
    if (!cls) return;
    const matchesType = filterType === 'all' || cls.type === filterType || cls.category === filterType;
    const matchesInstructor = filterInstructor === 'all' || cls.instructor === filterInstructor;
    if (!matchesType || !matchesInstructor) return;
    classesConsidered += 1;

    const liveBookings = this.state.bookingsMap.get(cls.id) || [];
    const storedBookings = bookingsByClass?.[cls.id] || [];
    const rosterSource = liveBookings.length ? liveBookings : storedBookings;
    const labelTime = cls.localTime || cls.time || '';
    const labelName = cls.name || 'Clase';
    const label = `${labelTime} - ${labelName}`.trim();
    const rosterNames = rosterSource.map((x) => DOMPurify.sanitize(x.userName || x.userEmail || x.userId || 'Anónimo'));
    if (rosterNames.length) snapshot.details.booked[label] = rosterNames;

    const capacity = Number(cls.capacity || 0);
    snapshot.totalCapacity += capacity;
    snapshot.booked += rosterSource.length;
    snapshot.revenue += this.estimateClassRevenue(cls, rosterSource.length);
    snapshot.revenueTarget += this.estimateClassRevenue(cls, capacity);

    const hourLabel = labelTime ? labelTime.slice(0, 5) : 'N/D';
    snapshot.peakHours[hourLabel] = (snapshot.peakHours[hourLabel] || 0) + rosterSource.length;

    const instructor = cls.instructor || 'Sin asignar';
    if (!snapshot.instructorMetrics[instructor]) snapshot.instructorMetrics[instructor] = { classes: 0, attendees: 0, utilizationSum: 0 };
    snapshot.instructorMetrics[instructor].classes += 1;
    snapshot.instructorMetrics[instructor].attendees += rosterSource.length;
    const utilizationPct = capacity ? (rosterSource.length / Math.max(capacity, 1)) * 100 : 0;
    snapshot.instructorMetrics[instructor].utilizationSum += utilizationPct;

    let classRepeats = 0;
    let classNew = 0;
    rosterSource.forEach((rec) => {
      const userKey = rec.userId || rec.userEmail || rec.userName || rec.id;
      const stat = stats.get ? stats.get(userKey) : undefined;
      if (!stat) return;
      if (stat.count > 1 && stat.firstDate && stat.firstDate < day) classRepeats += 1;
      else if (stat.count === 1 && stat.firstDate === day) classNew += 1;
    });
    snapshot.repeatBookings += classRepeats;
    snapshot.newMembers += classNew;

    const basePopularity = capacity ? (rosterSource.length / Math.max(capacity, 1)) * 100 : rosterSource.length * 5;
    const velocityScore = this.calculateBookingVelocityScore(cls.id, rosterSource.length);
    const classScore = Math.round(basePopularity + velocityScore);
    popularityAccumulator += classScore;

    if (aggregates?.classPopularity) {
      if (!aggregates.classPopularity.has(cls.id)) {
        aggregates.classPopularity.set(cls.id, { id: cls.id, label, instructor, totalScore: 0, occurrences: 0, weekdays: new Set() });
      }
      const entry = aggregates.classPopularity.get(cls.id);
      if (!entry.weekdays || !(entry.weekdays instanceof Set)) entry.weekdays = new Set(entry.weekdays ? [...entry.weekdays] : []);
      entry.totalScore += classScore;
      entry.occurrences += 1;
      if (weekdayShort) entry.weekdays.add(weekdayShort);
    }
  });

  if (classesConsidered > 0) {
    snapshot.popularityScore = Math.round(popularityAccumulator / classesConsidered);
    Object.values(snapshot.instructorMetrics).forEach((metrics) => {
      metrics.utilization = metrics.classes ? Math.round(metrics.utilizationSum / metrics.classes) : 0;
    });
  } else {
    snapshot.popularityScore = 0;
  }

  snapshot.utilizationRate = snapshot.totalCapacity > 0 ? Math.round((snapshot.booked / Math.max(snapshot.totalCapacity, 1)) * 100) : 0;
  if (snapshot.utilizationRate > 85) snapshot.warning = 'Capacidad crítica';
  else if (snapshot.utilizationRate > 60) snapshot.warning = 'Capacidad alta';
  else snapshot.warning = 'Capacidad estable';
  snapshot.memberRetention = snapshot.booked > 0 ? Math.round((snapshot.repeatBookings / Math.max(snapshot.booked, 1)) * 100) : 0;

  if (aggregates) {
    aggregates.heatmap[day] = snapshot.peakHours;
    aggregates.totals.revenue += snapshot.revenue;
    aggregates.totals.target += snapshot.revenueTarget;
    aggregates.totals.repeat += snapshot.repeatBookings;
    aggregates.totals.newMembers += snapshot.newMembers;
    aggregates.totals.cancellations += snapshot.cancellations;
    aggregates.totals.noShows += snapshot.noShows;
    Object.entries(snapshot.instructorMetrics).forEach(([name, metrics]) => {
      if (!aggregates.instructorTotals[name]) aggregates.instructorTotals[name] = { classes: 0, attendees: 0, utilizationSum: 0 };
      aggregates.instructorTotals[name].classes += metrics.classes;
      aggregates.instructorTotals[name].attendees += metrics.attendees;
      aggregates.instructorTotals[name].utilizationSum += metrics.utilizationSum;
    });
  }

  return snapshot;
};

AdminPanel.aggregateReportByPeriod = function aggregateReportByPeriod(dataCache, period) {
  const { report, labels } = dataCache;
  if (period === 'range' || period === 'daily') return labels.map((l) => ({ label: l.label, key: l.date, data: report[l.date] }));
  const grouped = new Map();
  labels.forEach((l) => {
    const baseDate = new Date(`${l.date}T00:00:00-06:00`);
    if (Number.isNaN(baseDate.getTime())) return;
    let key = l.date;
    let labelTxt = l.label;
    if (period === 'weekly') {
      const monday = new Date(baseDate);
      const day = monday.getDay();
      const diff = day === 0 ? 6 : day - 1;
      monday.setDate(monday.getDate() - diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      key = `${monday.toISOString().slice(0, 10)}_${sunday.toISOString().slice(0, 10)}`;
      labelTxt = `${this.dayShortFmt.format(monday)} - ${this.dayShortFmt.format(sunday)}`;
    } else if (period === 'monthly') {
      key = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;
      labelTxt = baseDate.toLocaleString('es-MX', { month: 'short', year: 'numeric' });
    }
    if (!grouped.has(key)) {
      grouped.set(key, {
        label: labelTxt,
        keys: [],
        data: {
          attended: 0,
          absent: 0,
          booked: 0,
          totalCapacity: 0,
          revenue: 0,
          revenueTarget: 0,
          repeatBookings: 0,
          newMembers: 0,
          cancellations: 0,
          noShows: 0,
          popularityScore: 0
        }
      });
    }
    const bucket = grouped.get(key);
    bucket.keys.push(l.date);
    const dayData = report[l.date];
    ['attended', 'absent', 'booked', 'totalCapacity', 'revenue', 'revenueTarget', 'repeatBookings', 'newMembers', 'cancellations', 'noShows'].forEach((field) => {
      bucket.data[field] += dayData?.[field] || 0;
    });
    bucket.data.popularityScore += dayData?.popularityScore || 0;
  });
  return Array.from(grouped.values()).map((bucket) => {
    const count = bucket.keys.length || 1;
    bucket.data.popularityScore = Math.round(bucket.data.popularityScore / count);
    bucket.data.utilizationRate = bucket.data.totalCapacity > 0 ? Math.round((bucket.data.booked / Math.max(bucket.data.totalCapacity, 1)) * 100) : 0;
    bucket.data.memberRetention = bucket.data.booked > 0 ? Math.round((bucket.data.repeatBookings / Math.max(bucket.data.booked, 1)) * 100) : 0;
    return { label: bucket.label, key: bucket.keys[0], data: bucket.data };
  });
};

AdminPanel.buildAttendanceAggregates = function buildAttendanceAggregates({ labels, report, aggregateContext, userStats }) {
  const popularity = Array.from(aggregateContext.classPopularity.values())
    .map((entry) => {
      const avgScore = entry.occurrences ? Math.round(entry.totalScore / entry.occurrences) : 0;
      const weekdayList = entry.weekdays instanceof Set ? Array.from(entry.weekdays) : Array.isArray(entry.weekdays) ? [...entry.weekdays] : [];
      weekdayList.sort((a, b) => a.localeCompare(b, 'es'));
      return { id: entry.id, label: entry.label, score: avgScore, instructor: entry.instructor, weekdays: weekdayList };
    })
    .sort((a, b) => b.score - a.score);

  const instructorMetrics = {};
  Object.entries(aggregateContext.instructorTotals).forEach(([name, metrics]) => {
    instructorMetrics[name] = {
      classes: metrics.classes,
      attendees: metrics.attendees,
      avgUtilization: metrics.classes ? Math.round(metrics.utilizationSum / metrics.classes) : 0
    };
  });

  const totals = aggregateContext.totals;
  const retentionRate = Math.round((totals.repeat / Math.max(totals.repeat + totals.newMembers, 1)) * 100);
  const revenueSeries = labels.map((l) => ({
    date: l.date,
    revenue: report[l.date]?.revenue || 0,
    target: report[l.date]?.revenueTarget || 0
  }));
  const behavior = {
    cancellationTimeline: [...(this.state.analyticsTracker?.cancellationTimeline || [])],
    switches: [...(this.state.analyticsTracker?.switches || [])]
  };
  const bi = {
    lifetimeValue: this.calculateMemberLifetimeValue({ userStats }),
    classProfitability: this.analyzeClassProfitability(popularity, report),
    optimalScheduling: this.recommendOptimalScheduling(report),
    capacityVsDemand: this.calculateCapacityVsDemand(report),
    instructorUtilization: this.calculateInstructorUtilization(instructorMetrics)
  };

  return {
    totals,
    instructorMetrics,
    popularity,
    heatmap: aggregateContext.heatmap,
    retention: { newMembers: totals.newMembers, repeatMembers: totals.repeat, retentionRate },
    revenueSeries,
    behavior,
    bi
  };
};

AdminPanel.injectBookingsIntoReport = function injectBookingsIntoReport() {
  const data = this.state.attendanceData;
  if (!data) return;
  const aggregateContext = {
    classPopularity: new Map(),
    heatmap: {},
    instructorTotals: {},
    totals: { revenue: 0, target: 0, repeat: 0, newMembers: 0, cancellations: 0, noShows: 0 }
  };
  const { report, classesByDay, bookingsByClass, userStats, cancellationsByDay } = data;
  Object.keys(report).forEach((day) => {
    const classList = (classesByDay && classesByDay[day]) || [];
    report[day] = this.calculateDaySnapshot({
      day,
      base: report[day],
      classList,
      bookingsByClass,
      userStats,
      cancellationsByDay,
      aggregates: aggregateContext
    });
  });
  data.aggregates = this.buildAttendanceAggregates({ labels: data.labels, report, aggregateContext, userStats });
};
