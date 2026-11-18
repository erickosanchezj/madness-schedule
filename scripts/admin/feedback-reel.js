// scripts/admin/feedback-reel.js
// Loads and saves the global feedback reel switch for authenticated admins.
// Lets staff stop the automatic announcement while preserving the form banner.
// RELEVANT FILES: admin.html, scripts/admin/init.js, scripts/member/feedback.js, firestore.rules
(() => {
  let unsubscribe;
  let session = 0;
  let enabled = false;
  let loaded = false;
  let saving = false;
  const toggle = () => document.getElementById('feedback-reel-enabled');
  const status = message => { document.getElementById('feedback-reel-status').textContent = message; };
  const summary = () => enabled ? 'Activado: se muestra al abrir la app.' : 'Desactivado: no se muestra al abrir la app.';

  Object.assign(AdminPanel, {
    listenFeedbackReel() {
      this.stopFeedbackReel();
      const currentSession = session;
      status('Cargando configuración…');
      unsubscribe = this.db.collection('appSettings').doc('feedbackReel').onSnapshot({ includeMetadataChanges: true }, snapshot => {
        if (currentSession !== session || snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites) return;
        // A missing setting preserves the existing announcement until staff change it.
        enabled = !snapshot.exists || snapshot.data().enabled === true;
        loaded = true;
        if (!saving) {
          toggle().checked = enabled;
          toggle().disabled = false;
          status(summary());
        }
      }, error => {
        if (currentSession !== session) return;
        loaded = false;
        toggle().disabled = true;
        status('No se pudo cargar la configuración. Recarga la página para reintentar.');
        console.warn('Feedback reel settings failed:', error);
      });
    },

    async saveFeedbackReel() {
      if (!loaded || saving) return;
      const nextEnabled = toggle().checked;
      const currentSession = session;
      saving = true;
      toggle().disabled = true;
      status('Guardando…');
      try {
        await this.db.collection('appSettings').doc('feedbackReel').set({ enabled: nextEnabled }, { merge: true });
        if (currentSession !== session) return;
        enabled = nextEnabled;
        status(summary());
      } catch (error) {
        if (currentSession !== session) return;
        status('No se pudo guardar. Inténtalo de nuevo.');
        this.showToast({ title: 'No se guardó el cambio', message: 'Revisa tu conexión y vuelve a intentarlo.', variant: 'error' });
        console.warn('Feedback reel save failed:', error);
      } finally {
        // A completed request from a previous login must not re-enable the switch.
        if (currentSession === session) {
          saving = false;
          toggle().checked = enabled;
          toggle().disabled = !loaded;
        }
      }
    },

    stopFeedbackReel() {
      session += 1;
      unsubscribe?.();
      unsubscribe = null;
      enabled = false;
      loaded = false;
      saving = false;
      toggle().checked = false;
      toggle().disabled = true;
      status('Cargando configuración…');
    }
  });
})();
