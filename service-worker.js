// ===============================
// service-worker.js  (scope: "/madness-schedule/")
// ===============================

// SW doesn't have `window`—shim it so compat bundles don't explode.
self.window = self;               // minimal shim for compat builds
self.document = self.document || {}; // harmless stub

// Load Firebase (same-origin only in SW)
importScripts("/madness-schedule/vendor/firebase-app-compat-10.12.5.js");
importScripts("/madness-schedule/vendor/firebase-messaging-compat-10.12.5.js");

// Init Firebase (same config as your app)
firebase.initializeApp({
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
});

const messaging = firebase.messaging();

// Show background notifications (when page is closed/hidden)
messaging.onBackgroundMessage(({ notification = {}, data = {} }) => {
  const title = notification.title || "Recordatorio de clase";
  const body  = notification.body  || "";
  const url   = data?.url || "/madness-schedule/";
  const icon  = "/madness-schedule/images/icon-192x192.png";

  self.registration.showNotification(title, {
    body, icon, badge: icon, data: { url }
  });
});

// Click → focus existing tab or open one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/madness-schedule/";
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clientsList.find(c => c.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
  })());
});

// Fast activate
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));