// scripts/member/interactions.js
// Delegated click handler that maps data-action buttons to member actions.
// One listener handles every button rendered by the screens.
// RELEVANT FILES: scripts/member/actions.js, scripts/member/main.js, scripts/member/screens/agenda.js

function handleInteraction(e){
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, screen, filter, classId } = target.dataset;
  switch(action){
    case 'retry-agenda': refreshAgendaListenersOnResume(true); break;
    case 'navigate': app.navigateTo(screen); break;
    case 'navigate-details': app.navigateTo('classDetails',{classId}); break;
    case 'set-filter': app.setScheduleFilter(filter); break;
    case 'scroll-to-schedule': {
      const scheduleHeader = document.getElementById('horario');
      if (scheduleHeader) scheduleHeader.scrollIntoView({ behavior: 'smooth' });
      break;
    }
    case 'edit-name': app.editUserName(e); break;
    case 'logout': app.logout(); break;
    case 'confirm-booking': target.disabled=true; app.confirmBooking(classId).finally(()=>target.disabled=false); break;
    case 'cancel-booking': target.disabled=true; app.cancelBooking(classId).finally(()=>target.disabled=false); break;
    case 'join-waitlist': target.disabled=true; app.joinWaitlist(classId).finally(()=>target.disabled=false); break;
    case 'leave-waitlist': target.disabled=true; app.leaveWaitlist(classId).finally(()=>target.disabled=false); break;
    case 'held-spot': showToast('Reservado para lista de espera. Intenta en unos minutos.', 'info', { duration: 5000 }); break;
    case 'pause-messages':
      dailyMessageRotation.paused = !dailyMessageRotation.paused;
      scheduleRender();
      break;
    case 'dismiss-message':
      // Remember every message currently in the queue, not just the visible one.
      rememberDismissedMessages(dailyMessageRotation.messages.length ? dailyMessageRotation.messages.map(m => m.id) : [state.dailyMessage?.id]);
      stopDailyMessageRotation();
      state.dailyMessage = null;
      scheduleRender();
      break;

    /* RESUELTO: usar deep-link + fallback web y confirmación modal
       Mantiene el nombre de acción existente: send-totalpass-daily */
    case 'send-totalpass-daily': {
      const classInfo = state.classes.find(c=>c.id===classId) || state.myBookings.find(b=>b.classId===classId);
      const className = classInfo?.name || classInfo?.className || '';

      showModal({
        title: '¿Abrir WhatsApp?',
        message: 'Se abrirá WhatsApp para enviar tu código de TotalPass.',
        buttons: [
          { text: 'Cancelar', primary: false, callback: null },
          {
            text: 'Abrir WhatsApp',
            primary: true,
            callback: () => {
              const baseMsg = 'Hola! Aqui te mando mi codigo de TotalPass: ';
              const txt = className ? `${baseMsg} (${className})` : baseMsg;
              const message = encodeURIComponent(txt);

              // Deep link a la app nativa
              const deepLink = `whatsapp://send?phone=5215539887713&text=${message}`;
              // Fallback a web si la app no abre
              const webLink  = `https://api.whatsapp.com/send?phone=5215539887713&text=${message}`;

              const visibilityHandler = () => {
                document.removeEventListener('visibilitychange', visibilityHandler);
                clearTimeout(fallbackTimer);
              };

              const fallbackTimer = setTimeout(() => {
                if (document.visibilityState === 'visible') {
                  window.location.href = webLink;
                }
              }, 600);

              document.addEventListener('visibilitychange', visibilityHandler);
              window.location.href = deepLink;
              showToast('WhatsApp abierto para enviar token', 'success');
            }
          }
        ]
      });
      break;
    }
  }
}
