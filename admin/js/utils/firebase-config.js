/* /admin/js/utils/firebase-config.js */
/* Firebase configuration and shared admin constants */
/* Centralizes SDK setup values to keep modules clean */
/* RELEVANT FILES: admin/js/admin-core.js, admin/js/modules/auth.js, admin/js/modules/calendar.js, admin/js/modules/bookings.js */

export const firebaseConfig = {
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
};

export const APP_CONSTANTS = {
  FACILITY_MAX_CAPACITY: 75,
  DEFAULT_TICKET_PRICE: 120,
  CALENDAR_START_HOUR: 6,
  CALENDAR_END_HOUR: 22
};
