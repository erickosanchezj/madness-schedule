// ===============================
// service-worker.js  (GitHub Pages: scope "/madness-schedule/")
// ===============================

// --- Firebase Web Messaging (Compat) ---
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

// Your Firebase config (same as your app)
firebase.initializeApp({
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
});

const messaging = firebase.messaging();

// Show background notifications when the page is closed or hidden.
// Works when your FCM payload has a `notification` key OR you build one yourself.
messaging.onBackgroundMessage(({ notification = {}, data = {} }) => {
  const title = notification.title || "Recordatorio de clase";
  const body  = notification.body  || "";
  const icon  = "/madness-schedule/images/icon-192x192.png"; // adjust if needed
  const url   = data?.url || "/madness-schedule/";           // you can set this in fcmOptions.link too

  self.registration.showNotification(title, {
    body,
    icon,
    badge: icon,
    data: { url },
    // Keep notifications quiet if you like:
    // silent: true,
  });
});

// Focus an existing tab under this SW scope or open a new one on click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/madness-schedule/";

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const scope = self.registration.scope; // e.g. https://erickosanchezj.github.io/madness-schedule/
    const candidate = allClients.find(c => c.url.startsWith(scope));
    if (candidate) {
      await candidate.focus();
      // Optionally navigate the existing tab:
      // candidate.navigate(targetUrl);
      return;
    }
    await clients.openWindow(targetUrl);
  })());
});

// --- Lifecycle: take control ASAP so updates ship fast ---
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Optional: token rotation hook (usually not necessary to handle manually)
self.addEventListener("pushsubscriptionchange", () => {
  // No-op; the page can call messaging.getToken() again on next load.
});
