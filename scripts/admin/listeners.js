// scripts/admin/listeners.js
// Live listeners for this week's classes, their bookings and waitlists.
// Keeps the calendar and weekly bookings in sync in real time.
// RELEVANT FILES: scripts/admin/calendar.js, scripts/admin/weekly-bookings.js, scripts/admin/init.js

Object.assign(AdminPanel, {

  // --- LISTENERS (semana completa) ---
  listenWeeklyClasses(){
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push(this.dateHelper.ymd(date));
    }

    this.state.weekDates = weekDates;

    if (this.state.unsubClasses) this.state.unsubClasses();

    if (!weekDates.length){
      this.state.classes = [];
      this.mountBookingsListenersForVisibleClasses();
      this.mountWaitlistListenersForVisibleClasses();
      this.renderAll();
      this.renderAttendanceDashboardFromCache();
      return;
    }

    this.state.unsubClasses = this.db.collection('classes')
      .where('classDate', 'in', weekDates)
      .orderBy('classDate','asc').orderBy('time','asc')
      .onSnapshot((snap)=>{
        this.state.classes = snap.docs.map(d=>{
          const data = { id:d.id, ...d.data() };
          const timeStr = data.time || data.timeUTC;
          if (data.classDate && timeStr){
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
      }, err=>{
        console.error(err);
        this.showToast({ title:'Error listando clases', message: err.message, variant:'error' });
      });
  },

  // Attendee names for bookings and waitlists, read once per user per page load.
  // The cache holds promises, so lookups that run at the same time share one read.
  attendeeNames: new Map(),
  attendeeName(uid, fallback=''){
    if (!this.attendeeNames.has(uid)){
      const lookup = this.db.collection('users').doc(uid).get()
        .then(snap => { const d = snap.data() || {}; return d.displayName || d.email || uid; })
        .catch(() => { this.attendeeNames.delete(uid); return null; }); // retry next time
      this.attendeeNames.set(uid, lookup);
    }
    return this.attendeeNames.get(uid).then(name => name ?? fallback);
  },

  teardownBookingsListeners(){
    this.state.unsubBookings.forEach(fn=>{ try{ fn&&fn(); }catch{} });
    this.state.unsubBookings = [];
    this.state.bookingsMap.clear();
    this.teardownWaitlistListeners();
  },

  teardownWaitlistListeners(){
    this.state.unsubWaitlists.forEach(fn=>{ try{ fn&&fn(); }catch{} });
    this.state.unsubWaitlists = [];
    this.state.waitlistsMap.clear();
  },

  mountBookingsListenersForVisibleClasses(){
    this.teardownBookingsListeners();
    const classIds = this.state.classes.map(c=>c.id);
    for (let i=0;i<classIds.length;i+=10){
      const batch = classIds.slice(i,i+10);
      let batchSequence = 0;
      const unsub = this.db.collection('bookings')
        .where('classId','in',batch)
        .onSnapshot(async (snap)=>{
          const currentSequence = ++batchSequence;
          const tracker = this.state.analyticsTracker;
          const bookingsWithNames = await Promise.all(snap.docs.map(async doc=>{
            const b = doc.data();
            let userName = b.userName || '';
            if (b.userId) userName = await this.attendeeName(b.userId, userName);
            return { id:doc.id, ...b, userName };
          }));

          if (currentSequence !== batchSequence) return; // drop outdated snapshot results

          const shouldTrackAnalytics = Boolean(tracker);

          batch.forEach(cid => {
            this.state.bookingsMap.delete(cid);
            if (tracker){
              tracker.bookingTimeline[cid] = [];
            }
          });

          bookingsWithNames.forEach(record=>{
            const b = record;
            const arr = this.state.bookingsMap.get(b.classId) || [];
            arr.push(record);
            this.state.bookingsMap.set(b.classId, arr);

            if (!shouldTrackAnalytics) return;

            if (!tracker.bookingTimeline[b.classId]) tracker.bookingTimeline[b.classId] = [];
            const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : null);
            if (createdAt && !Number.isNaN(createdAt.getTime())){
              tracker.bookingTimeline[b.classId].push(createdAt.getTime());
            }
          });

          this.renderAll();
          this.renderAttendanceDashboardFromCache();
        });
      this.state.unsubBookings.push(unsub);
    }
  },

  mountWaitlistListenersForVisibleClasses(){
    this.teardownWaitlistListeners();
    const classIds = this.state.classes.map(c=>c.id);
    for (let i=0;i<classIds.length;i+=10){
      const batch = classIds.slice(i,i+10);
      const unsub = this.db.collection('waitlists')
        .where('classId','in',batch)
        .onSnapshot(async (snap)=>{
          batch.forEach(cid=>this.state.waitlistsMap.delete(cid));
          const items = await Promise.all(snap.docs.map(async doc=>{
            const w = doc.data();
            let userName = '';
            if (w.userId) userName = await this.attendeeName(w.userId, userName);
            return { id:doc.id, ...w, userName };
          }));
          items.forEach(w=>{
            const arr = this.state.waitlistsMap.get(w.classId) || [];
            arr.push(w);
            this.state.waitlistsMap.set(w.classId, arr);
          });
          this.renderAll();
        });
      this.state.unsubWaitlists.push(unsub);
    }
  },
});
