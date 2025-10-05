// /scripts/admin/admin-bootstrap.js
// Handles core admin bootstrapping tasks like UI wiring, auth guard, and toast feedback
// Keeps initialisation logic isolated so the rest of the modules stay focused on features
// RELEVANT FILES: scripts/admin/admin-state.js, scripts/admin/admin-data-sources.js, scripts/admin/admin-attendance-dashboard.js

import { AdminPanel } from './admin-state.js';

AdminPanel.setupSectionToggles = function setupSectionToggles() {
  const buttons = document.querySelectorAll('[data-toggle-target]');
  buttons.forEach((btn) => {
    const targetId = btn.dataset.toggleTarget;
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    const labelEl = btn.querySelector('[data-toggle-label]');
    const expandedLabel = btn.dataset.expandedLabel || 'Colapsar';
    const collapsedLabel = btn.dataset.collapsedLabel || 'Expandir';

    const updateState = (expanded) => {
      btn.setAttribute('aria-expanded', String(expanded));
      if (labelEl) labelEl.textContent = expanded ? expandedLabel : collapsedLabel;
    };

    const isInitiallyHidden = target.classList.contains('hidden');
    updateState(!isInitiallyHidden);

    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        target.classList.add('hidden');
        updateState(false);
      } else {
        target.classList.remove('hidden');
        updateState(true);
      }
    });
  });
};

AdminPanel.showToast = function showToast({ title = 'Hecho', message = '', variant = 'success', timeout = 3000 }) {
  const color = variant === 'error' ? 'rose' : variant === 'warn' ? 'amber' : 'emerald';
  const wrap = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast max-w-md mx-auto bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-lg flex items-start gap-3';
  const safeTitle = DOMPurify.sanitize(title);
  const safeMessage = DOMPurify.sanitize(message);
  el.innerHTML = `
    <div class="w-10 h-10 rounded-lg bg-${color}-500/20 text-${color}-300 flex items-center justify-center shrink-0">
      <i data-lucide="${variant === 'error' ? 'alert-triangle' : variant === 'warn' ? 'alert-circle' : 'check'}" class="w-6 h-6"></i>
    </div>
    <div class="flex-1">
      <p class="font-semibold">${safeTitle}</p>
      ${safeMessage ? `<p class="text-sm text-zinc-400 mt-0.5">${safeMessage}</p>` : ''}
    </div>
    <button class="shrink-0 text-zinc-400 hover:text-zinc-200" aria-label="Cerrar notificación">
      <i data-lucide="x" class="w-5 h-5"></i>
    </button>`;
  wrap.appendChild(el);
  lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
  const close = () => el.remove();
  el.querySelector('button').addEventListener('click', close);
  if (timeout) setTimeout(close, timeout);
};

AdminPanel.init = function init() {
  const firebaseConfig = {
    apiKey: 'AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A',
    authDomain: 'madnessscheds.firebaseapp.com',
    projectId: 'madnessscheds',
    storageBucket: 'madnessscheds.firebasestorage.app',
    messagingSenderId: '788538690861',
    appId: '1:788538690861:web:ce19ead5929a8867c197a4'
  };
  firebase.initializeApp(firebaseConfig);
  this.db = firebase.firestore();
  this.auth = firebase.auth();
  this.functions = firebase.app().functions('us-central1');

  document.getElementById('login-btn').onclick = () => this.login();
  document.getElementById('logout-btn').onclick = () => this.logout();
  document.getElementById('gen-classes-btn').onclick = () => this.generateDailyClasses();
  document.getElementById('create-class-btn').onclick = () => this.showCreateClassModal();
  document.getElementById('send-reset-btn').onclick = () => this.sendPasswordReset();
  document.getElementById('att-refresh').onclick = () => this.fetchAttendanceData(true);

  const blacklistBtn = document.getElementById('list-blacklisted-btn');
  if (blacklistBtn) blacklistBtn.onclick = () => this.listBlacklistedUsers();
  const manualBookingsBtn = document.getElementById('generate-manual-bookings-btn');
  if (manualBookingsBtn) manualBookingsBtn.onclick = () => this.generateManualBookings();

  const range = this.getDefaultAttendanceRange();
  const sEl = document.getElementById('att-start-date');
  const eEl = document.getElementById('att-end-date');
  const capEl = document.getElementById('facility-capacity');
  const exportBtn = document.getElementById('att-export');
  const periodEl = document.getElementById('att-period');
  const classFilter = document.getElementById('class-filter');
  const instructorFilter = document.getElementById('instructor-filter');
  const exportFormatEl = document.getElementById('att-export-format');
  const dailyForm = document.getElementById('daily-message-form');
  const dailyResetBtn = document.getElementById('daily-message-reset');
  const dailyList = document.getElementById('daily-messages-list');

  const metricCheckboxes = [
    { id: 'metric-attended', key: 'attended' },
    { id: 'metric-absent', key: 'absent' },
    { id: 'metric-booked', key: 'booked' },
    { id: 'metric-utilization', key: 'utilization' },
    { id: 'metric-revenue', key: 'revenue' }
  ];

  if (sEl && eEl) {
    sEl.value = range.start;
    eEl.value = range.end;
    sEl.addEventListener('change', () => this.fetchAttendanceData(true));
    eEl.addEventListener('change', () => this.fetchAttendanceData(true));
  }

  if (capEl) {
    capEl.value = this.FACILITY_MAX_CAPACITY;
    capEl.addEventListener('change', () => {
      this.FACILITY_MAX_CAPACITY = Number(capEl.value) || 0;
      this.fetchAttendanceData(true);
    });
  }

  if (periodEl) {
    periodEl.addEventListener('change', () => {
      this.state.selectedPeriod = periodEl.value;
      this.fetchAttendanceData(true);
    });
  }

  if (classFilter) {
    classFilter.addEventListener('change', () => {
      this.state.selectedClassType = classFilter.value;
      this.fetchAttendanceData(true);
    });
  }

  if (instructorFilter) {
    instructorFilter.addEventListener('change', () => {
      this.state.selectedInstructor = instructorFilter.value;
      this.fetchAttendanceData(true);
    });
  }

  metricCheckboxes.forEach((meta) => {
    const el = document.getElementById(meta.id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (el.checked) {
        this.state.selectedMetrics.add(meta.key);
      } else {
        this.state.selectedMetrics.delete(meta.key);
      }
      this.renderAttendanceDashboardFromCache();
    });
  });

  if (exportFormatEl) {
    exportFormatEl.addEventListener('change', () => {
      this.state.selectedExportFormat = exportFormatEl.value;
    });
  }

  if (exportBtn) {
    exportBtn.onclick = () => this.exportCapacityReport();
  }

  if (dailyForm) {
    dailyForm.addEventListener('submit', (e) => this.submitDailyMessage(e));
  }
  if (dailyResetBtn) {
    dailyResetBtn.addEventListener('click', () => this.resetDailyMessageForm());
  }
  if (dailyList) {
    dailyList.addEventListener('click', (e) => this.handleDailyMessageListClick(e));
  }

  this.resetDailyMessageForm();
  this.setupSectionToggles();

  document.getElementById('find-user-btn').onclick = () => this.findUsersByQuery();
  document.getElementById('list-users-btn').onclick = () => this.listUsersPage();

  this.auth.onAuthStateChanged(async (user) => {
    if (user) {
      const token = await user.getIdTokenResult();
      if (token.claims && token.claims.admin) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        try {
          await this.loadWeeklyScheduleTemplate();
          this.listenWeeklyClasses();
          this.startAttendancePolling();
          this.listenRecentNotifications();
          this.listenDailyMessages();
        } catch (e) {
          this.showToast({ title: 'Error al iniciar', message: e.message, variant: 'error' });
        }
      } else {
        this.logout();
        this.showToast({ title: 'Acceso denegado', message: 'Tu cuenta no tiene rol de admin', variant: 'error' });
      }
    } else {
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('admin-panel').classList.add('hidden');
      this.teardownBookingsListeners();
      if (this.state.unsubClasses) this.state.unsubClasses();
      this.stopAttendancePolling();
      if (this.state.unsubRecentNotifs) this.state.unsubRecentNotifs();
      if (this.state.unsubDailyMessages) this.state.unsubDailyMessages();
      this.state.unsubDailyMessages = null;
      this.state.recentNotifications = [];
      this.renderRecentNotifications();
      this.state.dailyMessages = [];
      this.renderDailyMessages();
      this.resetDailyMessageForm();
      this.stopCurrentTimeTicker();
    }
  });

  lucide.createIcons();
};
