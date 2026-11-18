// scripts/admin/today.js
// "Hoy" panel: today's classes, who is booked, the waitlist, attendance status and a shortcut to take it.
// Staff work day to day; this puts today's roster and attendance one tap away.
// RELEVANT FILES: scripts/admin/views/week.js, scripts/admin/weekly-bookings.js, scripts/admin/class-modal.js, scripts/admin/calendar.js

Object.assign(AdminPanel, {

  // Called from renderAll() (live data) and every minute by the calendar ticker,
  // so a button switches to "Tomar asistencia" when the 30-minute window opens.
  renderTodayPanel(){
    const container = document.getElementById('today-classes');
    if (!container) return;
    const today = this.dateHelper.today();
    const classes = this.state.classes
      .filter(cls => (cls.localDate || cls.classDate) === today)
      .sort((a, b) => new Date(`${a.classDate}T${a.time}:00Z`) - new Date(`${b.classDate}T${b.time}:00Z`));
    this.syncTodayAttendanceListener(classes.map(cls => cls.id));

    if (!classes.length){
      container.innerHTML = '<p class="text-zinc-400 text-sm">No hay clases hoy.</p>';
      return;
    }

    container.innerHTML = classes.map(cls => {
      const enrolled = Number(cls.enrolledCount || 0);
      const capacity = Number(cls.capacity || 0);
      const full = capacity > 0 && enrolled >= capacity;
      // Attendance opens 30 min before class (same rule as the class modal).
      const canTakeAttendance = this.isClassInProgressWindow(cls);
      const startMs = new Date(`${cls.classDate}T${cls.time}:00Z`).getTime();
      const opensAt = this.timeFmt.format(new Date(startMs - 30*60000));
      // Saved = at least one attendance record exists. Pending only once the class has started.
      const saved = this.state.todayAttendance.has(cls.id);
      const status = saved
        ? '<p class="admin-today-status is-done">Asistencia guardada ✓</p>'
        : (startMs <= Date.now() ? '<p class="admin-today-status is-pending">Asistencia pendiente</p>' : '');
      return `
        <article class="admin-today-class">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-bold">${DOMPurify.sanitize(cls.localTime || '')} · ${DOMPurify.sanitize(cls.name || '')}</p>
              <p class="text-xs text-zinc-400">${DOMPurify.sanitize(cls.instructor || 'Instructor por asignar')}</p>
            </div>
            <span class="admin-today-count${full ? ' is-full' : ''}">${enrolled} / ${capacity || '—'}</span>
          </div>
          <div class="text-sm mt-2">${this.classRosterHTML(cls)}</div>
          ${status}
          <button type="button" data-today-class="${DOMPurify.sanitize(cls.id)}"
                  class="w-full mt-3 ${canTakeAttendance ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-zinc-600 hover:bg-zinc-700'} text-white font-bold py-2 px-4 rounded-md text-sm">
            ${canTakeAttendance ? 'Tomar asistencia' : `Ver clase · asistencia desde ${DOMPurify.sanitize(opensAt)}`}
          </button>
        </article>`;
    }).join('');

    // One click handler for the whole panel (re-set on every render, so it is never doubled).
    container.onclick = (event) => {
      const btn = event.target.closest('[data-today-class]');
      if (btn) this.openTodayClass(btn.dataset.todayClass);
    };
  },

  // One live listener on today's attendance records. It only reconnects when the list of
  // today's classes changes, so the every-minute re-render costs no Firestore reads.
  syncTodayAttendanceListener(classIds){
    const key = classIds.join(',');
    if (key === this.state.todayAttendanceKey) return;
    this.stopTodayAttendance();
    this.state.todayAttendanceKey = key;
    if (!classIds.length) return;
    // Firestore "in" accepts up to 30 values; a single day never has that many classes.
    this.state.unsubTodayAttendance = this.db.collection('attendance')
      .where('classId', 'in', classIds.slice(0, 30))
      .onSnapshot(snap => {
        this.state.todayAttendance = new Set(snap.docs.map(doc => doc.data().classId));
        this.renderTodayPanel();
      }, err => console.error('No se pudo leer la asistencia de hoy', err));
  },

  stopTodayAttendance(){
    if (this.state.unsubTodayAttendance) this.state.unsubTodayAttendance();
    this.state.unsubTodayAttendance = null;
    this.state.todayAttendanceKey = '';
    this.state.todayAttendance = new Set();
  },

  // Opens the existing class modal; goes straight to the attendance tab when it is available.
  async openTodayClass(classId){
    const cls = this.state.classes.find(c => c.id === classId);
    if (!cls) return;
    await this.showClassModal(cls);
    if (this.isClassInProgressWindow(cls)) this.switchTab('attendance');
  },
});
