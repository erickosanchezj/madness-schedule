// /service-worker.js (scope: "/")
// Service Worker for push notifications and offline support.
// Needed so the app works offline and shows notifications.
// Relevant files: sw-firebase-config.js, index.html, vendor/firebase-messaging-compat-10.12.5.js

var window = self; // <- requerido por firebase-*-compat en SW

// Firebase libs desde tu origen (para evitar CSP/CORS en SW)
// MODIFIED: Removed "/madness-schedule" from paths
importScripts("/vendor/firebase-app-compat-10.12.5.js");
importScripts("/vendor/firebase-messaging-compat-10.12.5.js");

// Inicializa Firebase (no changes needed here)
firebase.initializeApp({
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
});

const messaging = firebase.messaging();

// Parámetros usados para avisar al cliente que debe mostrar el prompt TotalPass
const TOTALPASS_PROMPT_PARAM = "totalpassPrompt";
const TOTALPASS_URL_PARAM = "whatsappUrl";
const TOTALPASS_MESSAGE_PARAM = "whatsappMessage";

// -------- util de log --------
const LOG = true;
const log = (...a) => { if (LOG) console.log("[SW]", ...a); };

// Notificaciones en background
messaging.onBackgroundMessage((payload) => {
  log("onBackgroundMessage payload:", payload);

  const hasNotification =
    !!payload?.notification &&
    (!!payload.notification.title || !!payload.notification.body);

  if (hasNotification) {
    log("Payload trae notification → dejo que el navegador muestre la suya y NO duplico.");
    return;
  }

  const data = payload?.data || {};
  const type = data.type || "";
  let title = data.title || "Recordatorio de clase";
  let body = data.body || "";

  const isWaitlist = type === "waitlist_opportunity";
  const isTotalPass = type === "totalpass";

  if (isWaitlist) {
    title = "¡Lugar disponible!";
    body = "Tienes 5 minutos para reservar";
  }

  if (isTotalPass) {
    title = data.title || "TotalPass";
    body = data.body || "Recuerda enviar tu token de TotalPass";
  }

  const whatsappUrl = isTotalPass ? data.whatsappUrl || data.url || "" : "";
  const url = isTotalPass
    ? whatsappUrl || "/"
    : data.url || "/";
  const classId = data.classId || "";
  const tag = classId
    ? `class-${classId}`
    : isTotalPass
      ? "totalpass"
      : undefined;
  // MODIFIED: Changed icon path to root
  const icon = "/images/icon-192x192.png";

  log("Mostrando notificación manual (data-only):", {
    title,
    body,
    url,
    classId,
    type,
  });
  self.registration.showNotification(title, {
    body,
    icon,
    badge: icon,
    data: {
      url,
      classId,
      type,
      whatsappUrl,
      whatsappMessage: isTotalPass ? data.whatsappMessage || "" : "",
    },
    tag,
    renotify: true,
  });
});

// Click → enfocamos pestaña existente del scope o abrimos una nueva
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const type = data.type;
  const whatsappUrl = data.whatsappUrl;

  if (type === "totalpass" && whatsappUrl) {
    const whatsappMessage = data.whatsappMessage || "";

    event.waitUntil((async () => {
      const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = list.find(c => c.url.startsWith(self.registration.scope));

      if (existing) {
        log("Mandando prompt TotalPass a pestaña existente");
        existing.postMessage({
          type: "totalpass-whatsapp",
          whatsappUrl,
          whatsappMessage,
        });
        return existing.focus();
      }

      const params = new URLSearchParams({ [TOTALPASS_PROMPT_PARAM]: "1" });
      params.set(TOTALPASS_URL_PARAM, whatsappUrl);
      if (whatsappMessage) params.set(TOTALPASS_MESSAGE_PARAM, whatsappMessage);
      const targetUrl = `/?${params.toString()}`;
      log("Abriendo ventana con prompt TotalPass:", targetUrl);
      return clients.openWindow(targetUrl);
    })());

    return;
  }

  // If we have a classId, go straight to its details screen
  const classId = data.classId;
  const targetUrl = classId
    ? `/?screen=classDetails&classId=${classId}`
    : data.url || "/";

  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = list.find(c => c.url.startsWith(self.registration.scope));
    if (existing) {
      log("Focus a tab existente:", existing.url);
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    log("Abriendo nueva ventana:", targetUrl);
    return clients.openWindow(targetUrl);
  })());
});

// Activación rápida para que el SW nuevo tome control (no changes needed)
self.addEventListener("install", () => {
  log("SW install → skipWaiting()");
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  log("SW activate → clients.claim()");
  e.waitUntil(self.clients.claim());
});
