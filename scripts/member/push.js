// scripts/member/push.js
// Service worker registration and FCM token upkeep for push reminders.
// Lets members receive class reminders and waitlist alerts.
// RELEVANT FILES: service-worker.js, scripts/member/auth.js, scripts/member/screens/profile.js

// ===============================
//  FCM: registrar SW y mantener token fresco
// ===============================
const VAPID_KEY = 'BDkzQqJ9a_NQssIIP6Pu-HQ1sxCOIwUiDW6OxCdKtvCmrSZMXpcjO-hdETrkPKycj-CfLSf75cskOC6HfHmYWRw';
const LS_KEY = 'fcm:lastToken';

async function registerSW() {
  // Asegura scope correcto en GitHub Pages
  const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  try { await reg.update(); } catch {}
  // Guarda para getToken
  window._msgSW = reg;
  return reg;
}

function isPushSupported(){
  return typeof firebase.messaging.isSupported === 'function' && firebase.messaging.isSupported();
}

function buildDeviceMetadata(){
  const metadata = {
    userAgent: navigator.userAgent || 'unknown',
    platform: navigator.platform || 'unknown',
    registeredAt: new Date()
  };
  const screenObj = window?.screen;
  if (screenObj?.width && screenObj?.height){
    metadata.screen = `${screenObj.width}x${screenObj.height}`;
  }
  try{
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) metadata.timezone = tz;
  }catch{}
  const language = navigator.language || (navigator.languages && navigator.languages[0]);
  if (language) metadata.language = language;
  if (navigator.vendor) metadata.browser = navigator.vendor;
  return metadata;
}

async function saveToken(uid, token, prevToken){
  if (!uid || !token) return;
  const ref = db.collection('users').doc(uid);
  const deviceMetadata = buildDeviceMetadata();
  const update = { fcmTokens: { [token]: deviceMetadata }, fcmUpdatedAt: new Date() };
  if (prevToken && prevToken !== token){
    update.fcmTokens[prevToken] = firebase.firestore.FieldValue.delete();
  }
  await ref.set(update, { merge:true });
  localStorage.setItem(LS_KEY, token);
}

async function removeToken(uid, token){
  try{
    await db.collection('users').doc(uid).set({
      fcmTokens: { [token]: firebase.firestore.FieldValue.delete() },
      fcmUpdatedAt: new Date()
    }, { merge:true });
  }catch{}
  if (localStorage.getItem(LS_KEY) === token) localStorage.removeItem(LS_KEY);
}

// Shows pushes that arrive while the app is open, as a toast. Registered once per page.
let foregroundListenerAttached = false;
function listenForegroundMessages(){
  if (foregroundListenerAttached) return;
  foregroundListenerAttached = true;
  messaging.onMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || 'Notificación';
    const body  = payload.notification?.body  || payload.data?.body  || '';
    showToast(`${title}${body ? ': ' + body : ''}`);
  });
}

async function ensureFreshFcmToken(uid){
  if (!isPushSupported()) return; // navegador no soporta
  // Permiso
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted'){
    const prev = localStorage.getItem(LS_KEY);
    if (uid && prev) await removeToken(uid, prev);
    return;
  }
  // SW listo
  const reg = window._msgSW || await registerSW();
  // Token actual
  const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return;
  const prev = localStorage.getItem(LS_KEY);
  const prevToken = prev && prev !== token ? prev : undefined;
  await saveToken(uid, token, prevToken);
  listenForegroundMessages();
}

// Botón manual (expuesto en perfil)
async function ensurePushPermissionAndToken(user){
  if (!user) throw new Error('No user session');
  if (!isPushSupported()) throw new Error('Push no soportado en este navegador');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso no concedido');
  const reg = window._msgSW || await registerSW();
  const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error('No se obtuvo token FCM');
  const prev = localStorage.getItem(LS_KEY);
  await saveToken(user.uid, token, prev);
  listenForegroundMessages();
  return token;
}
window.ensurePushPermissionAndToken = ensurePushPermissionAndToken; // útil para consola

// Limpieza si el usuario revoca permisos después
// ===============================

// Clears the saved token if the member later blocks notifications. Started by main.js.
function watchNotificationPermission(){
  if (navigator.permissions?.query){
    // Permission observation must not delay auth setup or the first agenda render.
    try{
      navigator.permissions.query({ name: 'notifications' }).then(status => {
        status.onchange = async () => {
          if (status.state !== 'granted'){
            const uid = auth.currentUser?.uid;
            const prev = localStorage.getItem(LS_KEY);
            if (uid && prev) await removeToken(uid, prev);
            showToast('Notificaciones desactivadas. Puedes activarlas de nuevo en la configuración del navegador.', 'error', { duration: 6000 });
            try{ gtag('event', 'notification_permission_disabled'); }catch{ console.log('notification_permission_disabled'); }
          }
        };
      }).catch(() => {});
    }catch{}
  }
}
