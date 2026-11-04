// scripts/member/actions.js
// Member actions: auth, name edit, navigation, booking, cancelling and waitlist calls.
// All server calls go through Cloud Functions callables from here.
// RELEVANT FILES: scripts/member/interactions.js, scripts/member/firebase.js, functions/src/memberBooking.js

const app = {
  handleAuth: (isLogin)=>{
    const turnstileApi = window.turnstile;
    if (!turnstileApi || typeof turnstileApi.getResponse !== 'function'){
      alert('La verificación de seguridad se está inicializando. Intenta de nuevo en unos segundos.');
      return;
    }

    const turnstileToken = turnstileApi.getResponse();
    const email = document.getElementById('email-input').value;
    const pass  = document.getElementById('password-input').value;
    if (!turnstileToken) {
      alert('Por favor, completa la verificación de seguridad.');  
      return;  
    }
    if (!email || !pass){ alert('Por favor, ingresa correo y contraseña.'); return; }
    loadingSpinner.classList.remove('hidden');
    const p = isLogin ? auth.signInWithEmailAndPassword(email,pass) : auth.createUserWithEmailAndPassword(email,pass);
    p.catch(err=>{ alert(err.message); loadingSpinner.classList.add('hidden'); });
  },
  logout: ()=> auth.signOut(),
  editUserName: async (event)=>{
    event.preventDefault();
    const newName = await window.madnessNameDialog(state.currentUser.displayName || '');
    if (newName && newName.trim()!==''){
      loadingSpinner.classList.remove('hidden');
      const trimmedName = newName.trim();
      // Update both Firebase Auth profile and Firestore user document to keep the display name consistent.
      Promise.all([
        state.currentUser.updateProfile({ displayName: trimmedName }),
        db.collection('users').doc(state.currentUser.uid).set({ displayName: trimmedName }, { merge: true })
      ])
        .then(()=>{ scheduleRender(); loadingSpinner.classList.add('hidden'); })
        .catch(err=>{ alert('Error: '+err.message); loadingSpinner.classList.add('hidden'); });
    }
  },
  navigateTo: (screen, data={})=>{
    state.currentScreen = screen;
    if (data.classId) state.selectedClassId = data.classId;
    // Keep listeners alive while logged in so tab changes reuse cached state.
    // Perfil should not start agenda reads, but it also should not detach them.
    if (AGENDA_SCREENS.includes(screen)) {
      if (pendingAgendaResumeRefresh) {
        refreshAgendaListenersOnResume(true);
      } else {
        attachAgendaListeners();
      }
    }
    render();
    mainContent.scrollTop = 0;
  },
  setScheduleFilter: (filter)=>{ state.scheduleFilter=filter; render(); },
  confirmBooking: async (classId)=>{
    try{
      await createBookingCallable({ classId });
      showModal({ success:true, title:'¡Reserva Exitosa!' });
    }catch(err){ alert(`No se pudo reservar\n\n${err.message}`); }
  },
  cancelBooking: async (classId)=>{
    const uid = state.currentUser.uid;
    if (!classId) return;

    const userRef = db.collection('users').doc(uid);

    const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
    const resolveStartDate = (bookingData, classData) => {
      if (bookingData?.startAt) {
        const fromBooking = asDate(bookingData.startAt);
        if (isValidDate(fromBooking)) return fromBooking;
      }
      if (classData?.startAt) {
        const fromClass = asDate(classData.startAt);
        if (isValidDate(fromClass)) return fromClass;
      }
      const dateStr = bookingData?.classDate || classData?.classDate;
      const timeStr = bookingData?.time || classData?.time;
      if (dateStr && timeStr) {
        const parsed = new Date(`${dateStr}T${timeStr}:00Z`);
        if (isValidDate(parsed)) return parsed;
      }
      return null;
    };

    const localBooking = state.myBookings.find(b=>b.classId===classId);
    const localClass = state.classes.find(cls=>cls.id===classId);
    const estimatedStart = resolveStartDate(localBooking, localClass);
    const startValid = isValidDate(estimatedStart);
    const looksLate = startValid ? (estimatedStart.getTime() - Date.now()) <= TWO_HOURS_MS : true;

    let currentLateCount = 0;
    try{
      const userSnap = await userRef.get();
      if (userSnap.exists) currentLateCount = Number(userSnap.data()?.lateCancellations || 0);
    }catch(err){ console.warn('No se pudo leer lateCancellations:', err); }

    const upcomingStrike = Math.min(currentLateCount + 1, 3);
    const confirmMessage = looksLate
      ? `Cancelar a menos de 2 horas suma un strike (${upcomingStrike}/3). Si llegas a 3 tu cuenta será bloqueada temporalmente. ¿Deseas continuar?`
      : 'Si cancelas deberás esperar 15 minutos para volver a reservar. ¿Deseas continuar?';
    if (!confirm(confirmMessage)) return;

    try{
      const response = await cancelBookingCallable({ classId });
      const data = response?.data || {};
      const becameBlacklisted = data.becameBlacklisted === true;
      const recordedLateStrike = data.recordedLateStrike === true;
      const resultingLateCount = Number.isFinite(Number(data.resultingLateCount))
        ? Number(data.resultingLateCount)
        : currentLateCount;

      showModal({ success:false, title:'Cancelación Exitosa' });

      if (becameBlacklisted) {
        showToast('Llegaste a 3 strikes por cancelaciones tardías. Tu cuenta fue bloqueada temporalmente.', 'error');
      } else if (recordedLateStrike) {
        showToast(`Cancelación tardía registrada. Strikes: ${resultingLateCount}/3`, 'error');
      }
      state.cancellationStrikes = Number.isFinite(resultingLateCount) && resultingLateCount > 0 ? resultingLateCount : 0;
      scheduleRender();
    }catch(err){
      const errMessage = err?.details?.message || err?.message || 'Error desconocido.';
      alert(`No se pudo cancelar\n\n${errMessage}`);
    }
  },
  joinWaitlist: async (classId)=>{
    try{
      await joinWaitlistCallable({ classId });
      showToast('Unido a la lista de espera', 'success');
    }catch(err){ alert(`No se pudo unir a la lista de espera\n\n${err.message}`); }
  },
  leaveWaitlist: async (classId)=>{
    try{
      await leaveWaitlistCallable({ classId });
      showToast('Saliste de la lista de espera');
    }catch(err){ alert(`No se pudo salir de la lista de espera\n\n${err.message}`); }
  }
};
