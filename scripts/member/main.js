// scripts/member/main.js
// Starts the member app in the original order: persistence, then auth, then event wiring.
// Firestore persistence must be on before the first read, which the auth gate makes.
// RELEVANT FILES: index.html, scripts/member/auth.js, scripts/member/push.js, scripts/member/interactions.js

document.addEventListener('DOMContentLoaded', async () => {
  // ---- Enable client cache (multi-tab safe)
  try {
    await firebase.firestore().enablePersistence({ synchronizeTabs: true });
  } catch (e) {
    console.warn('Persistence not enabled:', e && e.code);
  }
  watchNotificationPermission();
  startAuthGate();
  document.addEventListener('click', handleInteraction);
  navBar.addEventListener('click', e=>{
    const target = e.target.closest('.nav-button');
    if (target) app.navigateTo(target.dataset.screen);
  });
  genericModal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); hideModal(); }
    if (event.key !== 'Tab') return;
    const buttons = [...modalContent.querySelectorAll('button')];
    const next = event.shiftKey ? buttons.at(-1) : buttons[0];
    if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) { event.preventDefault(); next?.focus(); }
  });
  genericModal.addEventListener('cancel', event => { event.preventDefault(); hideModal(); });

  // Íconos
  lucide.createIcons();
});

// Service worker registration (fixed scope for GitHub Pages).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      window._msgSW = reg;
    } catch (err) {
      console.error('SW fail', err);
    }
  });
}
