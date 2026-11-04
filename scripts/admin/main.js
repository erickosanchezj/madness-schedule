// scripts/admin/main.js
// Starts the admin panel once every AdminPanel script has loaded.
// Kept last so init() can use methods from all the other files.
// RELEVANT FILES: admin.html, scripts/admin/core.js, scripts/admin/init.js

AdminPanel.init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    }catch(error){
      console.error('No se pudo registrar el Service Worker para el panel admin:', error);
    }
  });
}
