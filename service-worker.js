// service-worker.js (sin offline / sin caché)
// No hace precache ni runtime cache. Todo va siempre a la red.

// --- FCM hooks (works inside your existing SW) ---
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
});

const messaging = firebase.messaging();

const swMessaging = firebase.messaging();
swMessaging.onBackgroundMessage(({ notification = {}, data = {} }) => {
  self.registration.showNotification(notification.title || 'Recordatorio de clase', {
    body: notification.body || '',
    icon: './images/icon-192x192.png',
    badge: './images/icon-192x192.png',
    data: { url: data.url || './' }
  });
});

// Handle clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || './';
  event.waitUntil(clients.openWindow(targetUrl));
});

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