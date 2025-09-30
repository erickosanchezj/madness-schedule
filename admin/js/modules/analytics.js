/* /admin/js/modules/analytics.js */
/* Attendance tracking and lightweight analytics helpers */
/* Moves insights logic away from the bloated AdminPanel */
/* RELEVANT FILES: admin/js/admin-core.js, admin/js/utils/ui-components.js, admin/js/utils/ui-helpers.js, admin/js/utils/date-helpers.js */

import { AttendanceFormComponent } from '../utils/ui-components.js';
import { UIHelpers } from '../utils/ui-helpers.js';
import { DateHelpers } from '../utils/date-helpers.js';

export class AnalyticsModule {
  constructor(db, state) {
    this.db = db;
    this.state = state;
    this.dateHelpers = new DateHelpers();
  }

  async loadAttendeesForAttendance(cls) {
    if (!cls?.id) return;
    const bookingsSnap = await this.db.collection('bookings').where('classId', '==', cls.id).get();
    const attendees = bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    this.state.currentAttendance = attendees.reduce((acc, attendee) => {
      acc[attendee.id] = attendee.status || 'booked';
      return acc;
    }, {});
    this.renderAttendanceForm(attendees);
  }

  renderAttendanceForm(attendees) {
    const container = document.getElementById('attendance-list');
    if (!container) return;
    container.innerHTML = AttendanceFormComponent(attendees.map((attendee) => ({
      id: attendee.id,
      name: attendee.memberName || attendee.displayName || 'Miembro',
      email: attendee.email || 'sin correo'
    })));

    container.querySelectorAll('.attendance-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (!id || !action) return;
        this.state.currentAttendance[id] = action;
        container
          .querySelectorAll(`[data-id="${id}"]`)
          .forEach((peer) => peer.classList.remove('selected-attended', 'selected-absent'));
        btn.classList.add(action === 'attended' ? 'selected-attended' : 'selected-absent');
      });
    });
  }

  async saveAttendance(cls) {
    if (!cls?.id) return;
    const attendanceEntries = Object.entries(this.state.currentAttendance);
    const batch = this.db.batch();
    attendanceEntries.forEach(([bookingId, status]) => {
      const ref = this.db.collection('bookings').doc(bookingId);
      batch.update(ref, { status, attendanceUpdatedAt: Date.now() });
    });
    await batch.commit();
    UIHelpers.showToast({ title: 'Asistencia guardada', message: 'Los registros fueron actualizados.' });
  }

  async fetchAttendanceData(rangeStart, rangeEnd) {
    const start = rangeStart || this.dateHelpers.ymd(new Date());
    const end = rangeEnd || start;
    const snap = await this.db
      .collection('attendance')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();
    this.state.attendanceData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return this.state.attendanceData;
  }
}
