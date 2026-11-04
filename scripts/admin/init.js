// scripts/admin/init.js
// Admin start-up: control wiring, admin-claim auth gate, template load, login and logout.
// Connects the static markup to AdminPanel once the page loads.
// RELEVANT FILES: scripts/admin/core.js, scripts/admin/main.js, scripts/admin/listeners.js

Object.assign(AdminPanel, {

  // --- INIT / AUTH ---
  async init(){
    const firebaseConfig = {
      apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
      authDomain: "madnessscheds.firebaseapp.com",
      projectId: "madnessscheds",
      storageBucket: "madnessscheds.firebasestorage.app",
      messagingSenderId: "788538690861",
      appId: "1:788538690861:web:ce19ead5929a8867c197a4"
    };
    firebase.initializeApp(firebaseConfig);
    this.db = firebase.firestore();
    try {
      await firebase.firestore().enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      console.warn('Persistence not enabled:', e && e.code);
    }
    this.auth = firebase.auth();
    this.functions = firebase.app().functions('us-central1');

    // Top buttons
    document.getElementById('login-btn').onclick = () => this.login();
    document.getElementById('logout-btn').onclick = () => this.logout();
    document.getElementById('gen-classes-btn').onclick = () => this.generateDailyClasses();
    document.getElementById('create-class-btn').onclick = () => this.showCreateClassModal();
    document.getElementById('send-reset-btn').onclick = () => this.sendPasswordReset();
    document.getElementById('att-refresh').onclick = () => this.fetchAttendanceData(true);
    const blacklistBtn = document.getElementById('list-blacklisted-btn');
    if (blacklistBtn) blacklistBtn.onclick = () => this.listBlacklistedUsers();
    const resetStrikesBtn = document.getElementById('reset-strikes-btn');
    if (resetStrikesBtn) resetStrikesBtn.onclick = () => this.resetAllStrikesForEveryone();
    const manualBookingsBtn = document.getElementById('generate-manual-bookings-btn');
    if (manualBookingsBtn) manualBookingsBtn.onclick = () => this.generateManualBookings();

    const range = this.getDefaultAttendanceRange();
    const sEl = document.getElementById('att-start-date');
    const eEl = document.getElementById('att-end-date');
    const exportBtn = document.getElementById('att-export');
    const periodEl = document.getElementById('att-period');
    const classFilter = document.getElementById('class-filter');
    const instructorFilter = document.getElementById('instructor-filter');
    const exportFormatEl = document.getElementById('att-export-format');
    const dailyForm = document.getElementById('daily-message-form');
    const dailyResetBtn = document.getElementById('daily-message-reset');
    const dailyList = document.getElementById('daily-messages-list');
    const metricCheckboxes = [
      { id:'metric-attended', key:'attended' },
      { id:'metric-absent', key:'absent' },
      { id:'metric-booked', key:'booked' },
      { id:'metric-utilization', key:'utilization' },
      { id:'metric-revenue', key:'revenue' }
    ];
    if (sEl && eEl){
      sEl.value = range.start;
      eEl.value = range.end;
      sEl.addEventListener('change',()=>this.fetchAttendanceData(true));
      eEl.addEventListener('change',()=>this.fetchAttendanceData(true));
    }
    if (periodEl){
      periodEl.addEventListener('change',()=>{
        this.state.selectedPeriod = periodEl.value;
        this.fetchAttendanceData(true);
      });
    }
    if (classFilter){
      classFilter.addEventListener('change',()=>{
        this.state.selectedClassType = classFilter.value;
        this.fetchAttendanceData(true);
      });
    }
    if (instructorFilter){
      instructorFilter.addEventListener('change',()=>{
        this.state.selectedInstructor = instructorFilter.value;
        this.fetchAttendanceData(true);
      });
    }
    metricCheckboxes.forEach(meta=>{
      const el = document.getElementById(meta.id);
      if (!el) return;
      el.addEventListener('change',()=>{
        if (el.checked){ this.state.selectedMetrics.add(meta.key); }
        else this.state.selectedMetrics.delete(meta.key);
        this.renderAttendanceDashboardFromCache();
      });
    });
    if (exportFormatEl){
      exportFormatEl.addEventListener('change',()=>{
        this.state.selectedExportFormat = exportFormatEl.value;
      });
    }
    if (exportBtn){
      exportBtn.onclick = () => this.exportCapacityReport();
    }

    if (dailyForm){
      dailyForm.addEventListener('submit', (e)=>this.submitDailyMessage(e));
    }
    if (dailyResetBtn){
      dailyResetBtn.addEventListener('click', ()=>this.resetDailyMessageForm());
    }
    if (dailyList){
      dailyList.addEventListener('click', (e)=>this.handleDailyMessageListClick(e));
    }

    this.resetDailyMessageForm();

    this.setupSectionToggles();
    this.expandTodayBookingsAccordion();

    // Users: find + list
    document.getElementById('find-user-btn').onclick = () => this.findUsersByQuery();
    document.getElementById('list-users-btn').onclick = () => this.startUsersPagination();
    const userPrevBtn = document.getElementById('user-prev-page-btn');
    const userNextBtn = document.getElementById('user-next-page-btn');
    const userShowAllBtn = document.getElementById('user-show-all-btn');
    if (userPrevBtn) userPrevBtn.onclick = () => this.listUsersPreviousPage();
    if (userNextBtn) userNextBtn.onclick = () => this.listUsersPage();
    if (userShowAllBtn) userShowAllBtn.onclick = () => this.listAllUsers();

    const subscriptionFilter = document.getElementById('subscription-filter');
    const userSearchInput = document.getElementById('user-search');
    const refreshUsersBtn = document.getElementById('refresh-users-btn');
    if (subscriptionFilter){
      subscriptionFilter.addEventListener('change', ()=> this.listenSubscriptionUsers());
    }
    if (userSearchInput){
      userSearchInput.addEventListener('input', ()=> this.listenSubscriptionUsers());
    }
    if (refreshUsersBtn){
      refreshUsersBtn.onclick = () => this.listenSubscriptionUsers();
    }

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
            this.listenSubscriptionUsers();
          } catch(e){
            this.showToast({ title:'Error al iniciar', message:e.message, variant:'error' });
          }
        } else {
          this.logout();
          this.showToast({ title:'Acceso denegado', message:'Tu cuenta no tiene rol de admin', variant:'error' });
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
        if (this.state.unsubSubscriptionUsers){ this.state.unsubSubscriptionUsers(); this.state.unsubSubscriptionUsers = null; }
        this.state.subscriptionUsers = [];
        this.renderSubscriptionUsers();
        this.state.recentNotifications = [];
        this.renderRecentNotifications();
        this.state.dailyMessages = [];
        this.renderDailyMessages();
        this.resetDailyMessageForm();
        this.stopCurrentTimeTicker();
      }
    });

    lucide.createIcons();
  },

  async loadWeeklyScheduleTemplate(){
    const snap = await this.db.collection('schedule_template').get();
    if (snap.empty) throw new Error('No existe la plantilla de horario.');
    snap.forEach(doc => { this.state.weeklySchedule[doc.id] = doc.data().classes || []; });
  },

  // ---- AUTH ----
  login() {
      // 1. Get the Turnstile token from the widget
      const turnstileToken = turnstile.getResponse();

      const email = document.getElementById('email-input').value.trim();
      const pass  = document.getElementById('password-input').value;
      const errEl = document.getElementById('error-message');
      errEl.classList.add('hidden');

      // 2. Check if the token exists
      if (!turnstileToken) {
          errEl.textContent = 'Por favor, completa la verificación de seguridad.';
          errEl.classList.remove('hidden');
          return; // Stop the login attempt if no token
      }

      // 3. If token exists, proceed with Firebase auth
      this.auth.signInWithEmailAndPassword(email, pass).catch(err => {
          errEl.textContent = 'Error: ' + err.message;
          errEl.classList.remove('hidden');
          // Reset the widget if login fails so the user can try again
          turnstile.reset();
      });
  },
  logout(){
    this.stopCurrentTimeTicker();
    this.auth.signOut();
    this.showToast({ title:'Sesión cerrada' });
  },
});
