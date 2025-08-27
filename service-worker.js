// ===============================
// service-worker.js  (scope: "/madness-schedule/")
// ===============================

// Minimal shim so compat bundles don't crash, without breaking SW detection:
var window = self;  // <-- declare a local var, do NOT set self.window
// IMPORTANT: do NOT create self.document or window.document here.

// Load Firebase (must be same-origin inside a SW)
importScripts("/madness-schedule/vendor/firebase-app-compat-10.12.5.js");
importScripts("/madness-schedule/vendor/firebase-messaging-compat-10.12.5.js");

// Initialize Firebase (same config as your app)
firebase.initializeApp({
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
});

const messaging = firebase.messaging();

// Background notifications when the page is closed/hidden
messaging.onBackgroundMessage(({ notification = {}, data = {} }) => {
  const title = notification.title || "Recordatorio de clase";
  const body  = notification.body  || "";
  const url   = data?.url || "/madness-schedule/";
  const icon  = "/madness-schedule/images/icon-192x192.png";

  self.registration.showNotification(title, {
    body,
    icon,
    badge: icon,
    data: { url },
  });
});

// Click → focus existing tab under this scope or open one
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

// Fast activate so updates take effect immediately
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));