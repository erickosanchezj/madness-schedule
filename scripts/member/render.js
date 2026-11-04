// scripts/member/render.js
// Draws the current screen into #main-content and wires per-screen controls.
// Single entry point for re-rendering after any state change.
// RELEVANT FILES: scripts/member/state.js, scripts/member/screens/agenda.js, scripts/member/modal.js

// Render principal
function render(){
  const screen = state.currentScreen;
  document.getElementById('agenda-background').hidden = screen !== 'agenda';
  let content = '';
  if (screen === 'agenda') content = getAgendaScreenHTML();
  else if (screen === 'history') content = getHistoryScreenHTML();
  else if (screen === 'profile') content = getProfileScreenHTML();
  else if (screen === 'classDetails') content = getClassDetailsScreenHTML(state.selectedClassId);
  // Keep the shared status node alive when replacing a screen's markup.
  if (mainContent.contains(toastEl)) document.body.append(toastEl);
  mainContent.classList.toggle('has-class-details', screen === 'classDetails');
  mainContent.innerHTML = `<div class="max-w-md mx-auto">${content}</div>`;
  mainContent.querySelector('.class-detail-feedback')?.append(toastEl);
  updateNavButtons();
  lucide.createIcons();

  const btn = document.getElementById('enablePush');
  if (btn){
    btn.onclick = async () => {
      try{
        const user = firebase.auth().currentUser;
        if (!user) return showToast('Inicia sesión primero', 'error');
        if (!isPushSupported()) return showToast('Este navegador no soporta notificaciones push.', 'error');
        btn.disabled = true;
        await ensurePushPermissionAndToken(user);
        showToast('Notificaciones activadas ✅', 'success');
        scheduleRender();
      }catch(e){
        console.error('Enable push failed:', e);
        showToast(e.message || 'No se pudo activar notificaciones', 'error');
      }finally{
        btn.disabled = false;
      }
    };
  }

  const tpToggle = document.getElementById('totalpass-toggle');
  if (tpToggle){
    tpToggle.onchange = async e => {
      const checked = e.target.checked;
      try{
        await db.collection('users').doc(state.currentUser.uid).set({ totalPass: checked }, { merge: true });
        state.isTotalPass = checked;
        showToast('Preferencia guardada', 'success');
      }catch(err){
        showToast('No se pudo guardar', 'error');
        e.target.checked = !checked;
      }
    };
  }
}
