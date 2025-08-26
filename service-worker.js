// service-worker.js (sin offline / sin caché)
// No hace precache ni runtime cache. Todo va siempre a la red.

self.addEventListener('install', (event) => {
  // Activación inmediata en nuevas cargas
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Reclama clientes para que el SW tome control sin recargar
  event.waitUntil(self.clients.claim());
});

// Passthrough total: no interceptamos nada.
// (Opcional) Si quieres ver el tráfico, descomenta el listener y deja fetch(event.request)
// self.addEventListener('fetch', (event) => {
//   event.respondWith(fetch(event.request));
// });
