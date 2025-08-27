// Place this file at: /firebase-messaging-sw.js (same level as index.html)
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

// Show notifications when the app is in the background
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Clase próxima';
  const options = {
    body: payload.notification?.body || 'Tu clase comienza pronto.',
    icon: '/images/icon-192x192.png',   // update if needed
    badge: '/images/icon-192x192.png',  // optional
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

// Click → open deep link or home
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(clients.openWindow(targetUrl));
});
