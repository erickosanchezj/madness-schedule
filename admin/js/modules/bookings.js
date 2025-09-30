/* /admin/js/modules/bookings.js */
/* Booking and waitlist management for the admin view */
/* Separates reservation logic from the legacy AdminPanel */
/* RELEVANT FILES: admin/js/admin-core.js, admin/js/utils/ui-components.js, admin/js/utils/ui-helpers.js, admin/js/modules/calendar.js */

import { BookingListComponent } from '../utils/ui-components.js';

export class BookingsModule {
  constructor(db, state) {
    this.db = db;
    this.state = state;
    this.unsubscribeBookings = null;
    this.unsubscribeWaitlist = null;
  }

  mountBookingsListeners(classId) {
    this.detach();
    if (!classId) return;

    const bookingsRef = this.db.collection('bookings').where('classId', '==', classId).orderBy('createdAt', 'desc');
    this.unsubscribeBookings = bookingsRef.onSnapshot((snap) => {
      const bookings = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      this.state.bookingsMap.set(classId, bookings);
      this.renderBookingsList(classId);
    });

    const waitlistRef = this.db.collection('waitlists').where('classId', '==', classId).orderBy('createdAt', 'desc');
    this.unsubscribeWaitlist = waitlistRef.onSnapshot((snap) => {
      const waitlist = snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), waitlisted: true }));
      this.state.waitlistsMap.set(classId, waitlist);
      this.renderBookingsList(classId);
    });
  }

  renderBookingsList(classId) {
    const bookingsContainer = document.getElementById('bookings-list');
    if (!bookingsContainer) return;

    const bookings = this.state.bookingsMap.get(classId) || [];
    const waitlist = this.state.waitlistsMap.get(classId) || [];

    const markup = `
      <h3 class="text-lg font-semibold mb-3">Reservaciones</h3>
      ${BookingListComponent(bookings)}
      <h3 class="text-lg font-semibold mt-6 mb-3">Lista de espera</h3>
      ${BookingListComponent(waitlist)}
    `;

    bookingsContainer.innerHTML = markup;
  }

  detach() {
    if (this.unsubscribeBookings) {
      this.unsubscribeBookings();
      this.unsubscribeBookings = null;
    }
    if (this.unsubscribeWaitlist) {
      this.unsubscribeWaitlist();
      this.unsubscribeWaitlist = null;
    }
  }
}
