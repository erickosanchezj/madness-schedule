// ===============================
// service-worker.js (scope: "/madness-schedule/")
// ===============================

// Use same-origin imports (SW cannot import cross-origin)
importScripts("/madness-schedule/vendor/firebase-app-compat-10.12.5.js");
importScripts("/madness-schedule/vendor/firebase-messaging-compat-10.12.5.js");

// Your Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
});

const messaging = firebase.messaging();

// Background notifications
messaging.onBackgroundMessage(({ notification = {}, data = {} }) => {
  self.registration.showNotification(notification.title || "Recordatorio de clase", {
    body: notification.body || "",
    icon: "/madness-schedule/images/icon-192x192.png",
    badge: "/madness-schedule/images/icon-192x192.png",
    data: { url: data?.url || "/madness-schedule/" }
  });
});

// Click → focus existing tab or open one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/madness-schedule/";
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = list.find(c => c.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
  })());
});

// Fast activate
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
