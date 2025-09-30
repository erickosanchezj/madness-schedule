/* /admin/js/admin-core.js */
/* Entry point that wires the modular admin panel together */
/* Replaces the monolithic AdminPanel with smaller focused modules */
/* RELEVANT FILES: admin/index.html, admin/js/modules/auth.js, admin/js/modules/calendar.js, admin/js/modules/bookings.js */

import { AuthModule } from './modules/auth.js';
import { CalendarModule } from './modules/calendar.js';
import { BookingsModule } from './modules/bookings.js';
import { AnalyticsModule } from './modules/analytics.js';
import { UserModule } from './modules/users.js';
import { DateHelpers } from './utils/date-helpers.js';
import { UIHelpers } from './utils/ui-helpers.js';
import { APP_CONSTANTS } from './utils/firebase-config.js';

class AdminCore {
  constructor() {
    this.db = null;
    this.auth = null;
    this.functions = null;
    this.dateHelpers = new DateHelpers();
    this.state = {
      classes: [],
      bookingsMap: new Map(),
      waitlistsMap: new Map(),
      weeklySchedule: {},
      weekDates: [],
      recentNotifications: [],
      currentAttendance: {},
      selectedClass: null,
      attendanceData: null
    };
    this.modules = {};
    this.dom = {};
  }

  async init() {
    this.cacheDom();
    this.modules.auth = new AuthModule();
    await this.modules.auth.init();
    this.auth = this.modules.auth.auth;
    this.db = window.firebase.firestore();
    this.functions = window.firebase.app().functions('us-central1');

    this.modules.calendar = new CalendarModule(this.db, this.state);
    this.modules.bookings = new BookingsModule(this.db, this.state);
    this.modules.analytics = new AnalyticsModule(this.db, this.state);
    this.modules.users = new UserModule(this.db, this.auth);

    this.attachEventListeners();
    UIHelpers.setupSectionToggles();
    this.setupAuthUI();
    await this.modules.calendar.loadWeek();
  }

  cacheDom() {
    this.dom = {
      loginScreen: document.getElementById('login-screen'),
      adminPanel: document.getElementById('admin-panel'),
      emailInput: document.getElementById('email-input'),
      passwordInput: document.getElementById('password-input'),
      loginBtn: document.getElementById('login-btn'),
      logoutBtn: document.getElementById('logout-btn'),
      errorMessage: document.getElementById('error-message'),
      bookingsList: document.getElementById('bookings-list'),
      saveAttendanceBtn: document.getElementById('save-attendance-btn'),
      attendanceContent: document.getElementById('attendance-content'),
      calendarGrid: document.getElementById('calendar-grid'),
      selectedClassTitle: document.getElementById('selected-class-title'),
      selectedClassMeta: document.getElementById('selected-class-meta')
    };
  }

  attachEventListeners() {
    if (this.dom.loginBtn) {
      this.dom.loginBtn.addEventListener('click', async () => {
        const email = this.dom.emailInput?.value;
        const password = this.dom.passwordInput?.value;
        try {
          await this.modules.auth.login(email, password);
        } catch (err) {
          if (this.dom.errorMessage) {
            this.dom.errorMessage.textContent = err?.message || 'No pudimos iniciar sesión.';
            this.dom.errorMessage.classList.remove('hidden');
          }
        }
      });
    }

    if (this.dom.logoutBtn) {
      this.dom.logoutBtn.addEventListener('click', async () => {
        await this.modules.auth.logout();
      });
    }

    if (this.dom.saveAttendanceBtn) {
      this.dom.saveAttendanceBtn.addEventListener('click', async () => {
        if (!this.state.selectedClass) return;
        await this.modules.analytics.saveAttendance(this.state.selectedClass);
      });
    }

    window.addEventListener('admin:class:selected', async (evt) => {
      const cls = evt.detail;
      this.state.selectedClass = cls;
      if (this.dom.selectedClassTitle) {
        this.dom.selectedClassTitle.textContent = cls.title || 'Clase sin título';
      }
      if (this.dom.selectedClassMeta) {
        const attendees = cls.capacity || APP_CONSTANTS.FACILITY_MAX_CAPACITY;
        this.dom.selectedClassMeta.textContent = `${cls.date} • ${cls.startTime} • ${attendees} lugares`;
      }
      if (this.dom.attendanceContent) {
        this.dom.attendanceContent.classList.remove('hidden');
      }
      if (this.dom.saveAttendanceBtn) {
        this.dom.saveAttendanceBtn.classList.remove('hidden');
      }
      this.modules.bookings.mountBookingsListeners(cls.id);
      await this.modules.analytics.loadAttendeesForAttendance(cls);
    });
  }

  setupAuthUI() {
    this.modules.auth.onAuthStateChanged(async (user) => {
      const isLogged = Boolean(user);
      if (this.dom.loginScreen) {
        this.dom.loginScreen.classList.toggle('hidden', isLogged);
      }
      if (this.dom.adminPanel) {
        this.dom.adminPanel.classList.toggle('hidden', !isLogged);
      }
      if (isLogged) {
        await this.modules.calendar.loadWeek();
      } else {
        this.modules.calendar.detach();
        this.modules.bookings.detach();
      }
    });
  }
}

const adminApp = new AdminCore();
window.adminApp = adminApp;
adminApp.init();

