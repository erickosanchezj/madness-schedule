// scripts/member/listeners.js
// Live Firestore listeners for classes, bookings, waitlists, attendance and the user.
// Keeps the agenda in sync and refreshes it when the app comes back to the front.
// RELEVANT FILES: scripts/member/state.js, scripts/member/auth.js, scripts/member/render.js

// Firestore listeners
const AGENDA_REFRESH_MIN_MS = 60000;
const AGENDA_SCREENS = ['agenda', 'history', 'classDetails'];
let unsubClasses=null, unsubMyBookings=null, unsubWaitlist=null, unsubUser=null, unsubDailyMessage=null, unsubAttendance=null, listenersAttached=false;
let lastAgendaResumeRefreshAt = 0;
let pendingAgendaResumeRefresh = false;
let resumeRefreshHandlersAttached = false;
function detachListeners(){
  if (unsubClasses){ try{unsubClasses();}catch{}; unsubClasses=null; }
  if (unsubMyBookings){ try{unsubMyBookings();}catch{}; unsubMyBookings=null; }
  if (unsubWaitlist){ try{unsubWaitlist();}catch{}; unsubWaitlist=null; }
  if (unsubUser){ try{unsubUser();}catch{}; unsubUser=null; }
  if (unsubDailyMessage){ try{unsubDailyMessage();}catch{}; unsubDailyMessage=null; }
  if (unsubAttendance){ try{unsubAttendance();}catch{}; unsubAttendance=null; }
  stopDailyMessageRotation();
  state.dailyMessage = null;
  state.classes = [];
  state.myBookings = [];
  state.waitlistEntries = [];
  state.attendanceRecords = {};
  if (state.loading){
    state.loading.classes = true;
    state.loading.bookings = true;
  }
  scheduleRender();
  listenersAttached=false;
  pendingAgendaResumeRefresh=false;
}
function refreshAgendaListenersOnResume(force=false){
  if (!state.currentUser) return;

  const isAgendaScreen = AGENDA_SCREENS.includes(state.currentScreen);
  if (!isAgendaScreen) {
    pendingAgendaResumeRefresh = listenersAttached;
    return;
  }

  const now = Date.now();
  if (!force && now - lastAgendaResumeRefreshAt < AGENDA_REFRESH_MIN_MS) return;
  lastAgendaResumeRefreshAt = now;
  pendingAgendaResumeRefresh = false;

  if (listenersAttached) detachListeners();
  attachAgendaListeners();
}
// Copies subscription, TotalPass and strike fields from the user doc into state.
// Used at sign-in too, so Perfil is correct even before the agenda listeners start.
function applyUserData(data){
  state.isTotalPass = !!data.totalPass;
  state.subscriptionType = typeof data.subscriptionType === 'string' ? data.subscriptionType : 'monthly';
  state.subscriptionStatus = typeof data.subscriptionStatus === 'string' ? data.subscriptionStatus : 'unpaid';
  const graceRaw = data.subscriptionGraceUntil;
  let graceUntil = null;
  if (graceRaw?.toDate) {
    graceUntil = graceRaw.toDate();
  } else if (graceRaw instanceof Date && !Number.isNaN(graceRaw.getTime())) {
    graceUntil = graceRaw;
  } else if (graceRaw) {
    const parsedGrace = new Date(graceRaw);
    if (!Number.isNaN(parsedGrace.getTime())) {
      graceUntil = parsedGrace;
    }
  }
  state.subscriptionGraceUntil = graceUntil;
  const strikesRaw = Number(data.lateCancellations);
  state.cancellationStrikes = Number.isFinite(strikesRaw) && strikesRaw > 0 ? strikesRaw : 0;
}
function attachAgendaListeners(){
  if (listenersAttached || !state.currentUser) return;
  state.loading.classes = true;
  state.loading.bookings = true;
  scheduleAgendaDataRender();
  const nowMinus5 = new Date(Date.now()-5*60*1000);
  unsubClasses = db.collection('classes').where('startAt','>=',nowMinus5).orderBy('startAt','asc').limit(100)
    .onSnapshot(snap=>{
      state.errors.classes = false;
      state.classes = snap.docs.map(d=>({id:d.id,...d.data()}));
      state.loading.classes = false;
      scheduleAgendaDataRender();
    }, err=>{
      state.errors.classes = true;
      console.error('Error clases:', err);
      state.loading.classes = false;
      scheduleAgendaDataRender();
    });
  unsubMyBookings = db.collection('bookings').where('userId','==',state.currentUser.uid)
    .onSnapshot(snap=>{
      state.errors.bookings = false;
      state.myBookings = snap.docs.map(d=>({id:d.id,...d.data()}));
      state.loading.bookings = false;
      scheduleAgendaDataRender();
    }, err=>{
      state.errors.bookings = true;
      console.error('Error mis reservas:', err);
      state.loading.bookings = false;
      scheduleAgendaDataRender();
    });
  unsubWaitlist = db.collection('waitlists')
    .where('userId', '==', state.currentUser.uid)
    .onSnapshot(snap => {
      state.waitlistEntries = snap.docs.map(d=>({id:d.id,...d.data()}));
      scheduleAgendaDataRender();
    });
  unsubAttendance = db.collection('attendance')
    .where('userId', '==', state.currentUser.uid)
    .onSnapshot(snap => {
      const records = {};
      snap.forEach(doc => {
        const data = doc.data() || {};
        if (!data.classId) return;
        const rawStatus = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
        records[data.classId] = { status: rawStatus };
      });
      state.attendanceRecords = records;
      scheduleAgendaDataRender();
    }, err => {
      console.error('Error asistencia usuario:', err);
    });
  unsubUser = db.collection('users').doc(state.currentUser.uid)
    .onSnapshot(doc => {
      applyUserData(doc.data() || {});
      scheduleRender();
    });
  unsubDailyMessage = db.collection('dailyMessages')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .onSnapshot(snap => {
      const dismissed = readDismissedMessages();
      const activeMessages = snap.docs.map(doc => {
        const data = doc.data() || {};
        const rawText = typeof data.message === 'string' ? data.message.trim() : '';
        return { id: doc.id, ...data, message: rawText };
      }).filter(msg => msg.isActive && msg.message && !dismissed.includes(msg.id));
      if (!activeMessages.length){
        stopDailyMessageRotation();
        state.dailyMessage = null;
        scheduleAgendaDataRender();
        return;
      }
      if (activeMessages.length === 1){
        stopDailyMessageRotation();
        state.dailyMessage = activeMessages[0];
        scheduleAgendaDataRender();
        return;
      }
      startDailyMessageRotation(activeMessages);
    }, err => {
      console.error('Error mensaje diario:', err);
      stopDailyMessageRotation();
      state.dailyMessage = null;
      scheduleAgendaDataRender();
    });
  listenersAttached=true;
}
