// --- FCM hooks ---
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

messaging.onBackgroundMessage(({ notification = {}, data = {} }) => {
  self.registration.showNotification(notification.title || 'Recordatorio de clase', {
    body: notification.body || '',
    // Better use absolute paths on GH Pages to avoid scope surprises:
    icon: '/madness-schedule/images/icon-192x192.png',
    badge: '/madness-schedule/images/icon-192x192.png',
    data: { url: data?.url || '/madness-schedule/' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/madness-schedule/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.registration.scope));
      return existing ? existing.focus() : clients.openWindow(targetUrl);
    })
  );
});

// No caching → passthrough
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));