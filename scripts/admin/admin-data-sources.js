// /scripts/admin/admin-data-sources.js
// Listens to Firestore collections and keeps in-memory state aligned with live data
// Keeps data subscription logic decoupled so rendering modules can stay simple
// RELEVANT FILES: scripts/admin/admin-state.js, scripts/admin/admin-calendar.js, scripts/admin/admin-attendance-core.js

import { AdminPanel } from './admin-state.js';

AdminPanel.loadWeeklyScheduleTemplate = async function loadWeeklyScheduleTemplate() {
  const snap = await this.db.collection('schedule_template').get();
  if (snap.empty) throw new Error('No existe la plantilla de horario.');
  snap.forEach((doc) => {
    this.state.weeklySchedule[doc.id] = doc.data().classes || [];
  });
};

AdminPanel.listenWeeklyClasses = function listenWeeklyClasses() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  const weekDates = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    weekDates.push(this.dateHelper.ymd(date));
  }

  this.state.weekDates = weekDates;

  if (this.state.unsubClasses) this.state.unsubClasses();

  if (!weekDates.length) {
    this.state.classes = [];
    this.mountBookingsListenersForVisibleClasses();
    this.mountWaitlistListenersForVisibleClasses();
    this.renderAll();
    this.renderAttendanceDashboardFromCache();
    return;
  }

  this.state.unsubClasses = this.db
    .collection('classes')
    .where('classDate', 'in', weekDates)
    .orderBy('classDate', 'asc')
    .orderBy('time', 'asc')
    .onSnapshot((snap) => {
      this.state.classes = snap.docs.map((d) => {
        const data = { id: d.id, ...d.data() };
        const timeStr = data.time || data.timeUTC;
        if (data.classDate && timeStr) {
          const start = new Date(`${data.classDate}T${timeStr}:00Z`);
          data.localDate = this.dateHelper.ymd(start);
          data.localTime = this.timeFmt.format(start);
        }
        return data;
      });
      this.mountBookingsListenersForVisibleClasses();
      this.mountWaitlistListenersForVisibleClasses();
      this.renderAll();
      this.refreshAttendanceFilters();
      this.renderAttendanceDashboardFromCache();
    }, (err) => {
      console.error(err);
      this.showToast({ title: 'Error listando clases', message: err.message, variant: 'error' });
    });
};

AdminPanel.teardownBookingsListeners = function teardownBookingsListeners() {
  this.state.unsubBookings.forEach((fn) => {
    try {
      if (fn) fn();
    } catch (err) {
      console.warn('Error closing booking listener', err);
    }
  });
  this.state.unsubBookings = [];
  this.state.bookingsMap.clear();
  this.teardownWaitlistListeners();
};

AdminPanel.teardownWaitlistListeners = function teardownWaitlistListeners() {
  this.state.unsubWaitlists.forEach((fn) => {
    try {
      if (fn) fn();
    } catch (err) {
      console.warn('Error closing waitlist listener', err);
    }
  });
  this.state.unsubWaitlists = [];
  this.state.waitlistsMap.clear();
};

AdminPanel.mountBookingsListenersForVisibleClasses = function mountBookingsListenersForVisibleClasses() {
  this.teardownBookingsListeners();
  const classIds = this.state.classes.map((c) => c.id);
  for (let i = 0; i < classIds.length; i += 10) {
    const batch = classIds.slice(i, i + 10);
    const unsub = this.db
      .collection('bookings')
      .where('classId', 'in', batch)
      .onSnapshot((snap) => {
        const tracker = this.state.analyticsTracker;
        batch.forEach((cid) => {
          this.state.bookingsMap.delete(cid);
          tracker.bookingTimeline[cid] = [];
        });
        snap.docs.forEach((doc) => {
          const b = doc.data();
          const arr = this.state.bookingsMap.get(b.classId) || [];
          const record = { id: doc.id, ...b };
          arr.push(record);
          this.state.bookingsMap.set(b.classId, arr);
          const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : null);
          if (!tracker.bookingTimeline[b.classId]) tracker.bookingTimeline[b.classId] = [];
          if (createdAt && !Number.isNaN(createdAt.getTime())) {
            tracker.bookingTimeline[b.classId].push(createdAt.getTime());
          }
          const userKey = b.userId || b.userEmail || b.userName || doc.id;
          if (!tracker.userBehavior[userKey]) {
            tracker.userBehavior[userKey] = {
              bookingsSet: new Set(),
              cancellationIds: new Set(),
              switchIds: new Set(),
              bookings: 0,
              cancellations: 0,
              switches: 0,
              lastClassId: null
            };
          }
          tracker.userBehavior[userKey].bookingsSet.add(doc.id);
          tracker.userBehavior[userKey].bookings = tracker.userBehavior[userKey].bookingsSet.size;
          if ((b.status && b.status === 'cancelled') || b.cancelledAt) {
            tracker.userBehavior[userKey].cancellationIds.add(doc.id);
            tracker.userBehavior[userKey].cancellations = tracker.userBehavior[userKey].cancellationIds.size;
            this.recordCancellationTiming(b);
          }
          if (b.previousClassId && b.previousClassId !== b.classId) {
            tracker.userBehavior[userKey].switchIds.add(`${doc.id}:${b.previousClassId}->${b.classId}`);
            tracker.userBehavior[userKey].switches = tracker.userBehavior[userKey].switchIds.size;
            this.recordClassSwitch(b);
          }
          tracker.userBehavior[userKey].lastClassId = b.classId;
        });
        this.renderAll();
        this.renderAttendanceDashboardFromCache();
      });
    this.state.unsubBookings.push(unsub);
  }
};

AdminPanel.mountWaitlistListenersForVisibleClasses = function mountWaitlistListenersForVisibleClasses() {
  this.teardownWaitlistListeners();
  const classIds = this.state.classes.map((c) => c.id);
  for (let i = 0; i < classIds.length; i += 10) {
    const batch = classIds.slice(i, i + 10);
    const unsub = this.db
      .collection('waitlists')
      .where('classId', 'in', batch)
      .onSnapshot(async (snap) => {
        batch.forEach((cid) => this.state.waitlistsMap.delete(cid));
        const items = await Promise.all(
          snap.docs.map(async (doc) => {
            const w = doc.data();
            let userName = '';
            if (w.userId) {
              try {
                const uSnap = await this.db.collection('users').doc(w.userId).get();
                userName = uSnap.data()?.displayName || uSnap.data()?.email || w.userId;
              } catch (err) {
                console.warn('No se pudo cargar usuario de lista de espera', err);
              }
            }
            return { id: doc.id, ...w, userName };
          })
        );
        items.forEach((w) => {
          const arr = this.state.waitlistsMap.get(w.classId) || [];
          arr.push(w);
          this.state.waitlistsMap.set(w.classId, arr);
        });
        this.renderAll();
      });
    this.state.unsubWaitlists.push(unsub);
  }
};

AdminPanel.recordCancellationTiming = function recordCancellationTiming(booking) {
  const tracker = this.state.analyticsTracker;
  if (!tracker) return;
  const cancelledAtRaw = booking.cancelledAt?.toDate
    ? booking.cancelledAt.toDate()
    : booking.cancelledAt
    ? new Date(booking.cancelledAt)
    : null;
  const classDate = booking.classDate || '';
  const classTime = booking.classTime || booking.time || '';
  let classStart = null;
  if (classDate && classTime) {
    const timeValue = classTime.length === 5 ? classTime : classTime.slice(0, 5);
    classStart = new Date(`${classDate}T${timeValue}:00Z`);
  }
  let hoursBefore = null;
  if (cancelledAtRaw && classStart && !Number.isNaN(cancelledAtRaw.getTime()) && !Number.isNaN(classStart.getTime())) {
    const diff = (classStart.getTime() - cancelledAtRaw.getTime()) / 3600000;
    hoursBefore = Math.round(diff * 10) / 10;
  }
  tracker.cancellationTimeline.push({
    classId: booking.classId,
    classDate,
    cancelledAt: cancelledAtRaw?.getTime?.() || cancelledAtRaw || null,
    hoursBefore
  });
};

AdminPanel.recordClassSwitch = function recordClassSwitch(booking) {
  const tracker = this.state.analyticsTracker;
  if (!tracker) return;
  tracker.switches.push({
    classId: booking.classId,
    previousClassId: booking.previousClassId,
    userId: booking.userId,
    switchedAt: booking.modifiedAt?.toDate ? booking.modifiedAt.toDate().getTime() : Date.now()
  });
};

AdminPanel.renderAll = function renderAll() {
  this.renderCalendarGrid();
  this.renderDailyBookings();
};
