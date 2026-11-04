// scripts/member/screens/profile.js
// Profile screen: subscription status, strikes, push, TotalPass and sign-out.
// Members manage their account settings here.
// RELEVANT FILES: scripts/member/render.js, scripts/member/push.js, scripts/member/actions.js

function getProfileScreenHTML(){
  const safeDisplay = DOMPurify.sanitize(state.currentUser.displayName || '');
  const safeEmail = DOMPurify.sanitize(state.currentUser.email || '');
  const nameForText = safeDisplay || safeEmail;
  const placeholder = (nameForText.charAt(0) || 'U').toUpperCase();
  // true if push notifications are allowed and token saved
  const notificationsAvailable = typeof Notification !== 'undefined' && isPushSupported();
  const pushEnabled = notificationsAvailable && Notification.permission === 'granted' && localStorage.getItem(LS_KEY);
  const pushStatusText = pushEnabled ? 'Activadas' : (notificationsAvailable ? 'Desactivadas' : 'No disponible');
  const nameSubtitle = nameForText || 'Sin nombre';
  const { strikeCount, strikeMessage } = getStrikeInfo();
  const subscriptionType = typeof state.subscriptionType === 'string' ? state.subscriptionType : 'monthly';
  const subscriptionStatus = typeof state.subscriptionStatus === 'string' ? state.subscriptionStatus : 'unpaid';
  const graceUntilDate = state.subscriptionGraceUntil instanceof Date && !Number.isNaN(state.subscriptionGraceUntil.getTime())
    ? state.subscriptionGraceUntil
    : null;
  const isWithinGrace = (() => {
    if (!graceUntilDate) return false;
    return Date.now() <= graceUntilDate.getTime();
  })();
  const graceDeadlineLabel = formatGraceDeadline(graceUntilDate);
  const graceDeadlineMessage = isWithinGrace
    ? `Paga antes del ${graceDeadlineLabel} para seguir reservando.`
    : `Tu periodo de gracia terminó el ${graceDeadlineLabel}. Paga para seguir reservando.`;
  const subscriptionBadgeClass = subscriptionType === 'monthly'
    ? 'bg-blue-600'
    : subscriptionType === 'totalpass'
      ? 'bg-purple-600'
      : 'bg-zinc-600';
  const subscriptionLabel = subscriptionType === 'monthly'
    ? 'Mensual'
    : subscriptionType === 'totalpass'
      ? 'TotalPass'
      : 'Por Clase';
  const showUnpaidAlert = (subscriptionType === 'monthly') && subscriptionStatus !== 'paid' && !isWithinGrace;
  return `
    <div class="screen-layout p-6 space-y-6">
      <header class="text-center space-y-4">
        <img src="${state.currentUser.photoURL || 'images/icon-192x192.png'}" alt="Perfil de Madness" class="w-24 h-24 rounded-full mx-auto border-4 border-zinc-700">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold">${nameForText}</h1>
          <p class="text-sm text-zinc-400">${safeEmail}</p>
        </div>
      </header>
      ${showUnpaidAlert ? `
      <div class="bg-rose-900/60 border border-rose-700 text-rose-100 p-4 rounded-xl text-sm">
        <p class="font-semibold">Suscripción mensual no pagada.</p>
        <p class="text-rose-200 mt-1">${graceDeadlineMessage}</p>
      </div>` : ''}
      <section aria-labelledby="profile-strikes" class="card-panel p-4 text-center space-y-2">
        <h2 id="profile-strikes" class="text-lg font-semibold">Strikes por cancelación</h2>
        <p class="text-3xl font-bold text-rose-400">${strikeCount}/3</p>
        <p class="text-sm text-zinc-400">${strikeMessage}</p>
      </section>

      <section class="flex gap-4">
        <a href="https://wa.me/5215539887713" target="_blank" rel="noopener noreferrer" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg">
          <i data-lucide="message-circle" class="w-5 h-5"></i>
          <span class="font-bold">WhatsApp</span>
        </a>
        <a href="https://instagram.com/madness_crosstrainingmx" target="_blank" rel="noopener noreferrer" class="flex-1 bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white rounded-xl py-3 flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg">
          <i data-lucide="camera" class="w-5 h-5"></i>
          <span class="font-bold">Instagram</span>
        </a>
      </section>

      <div class="card-panel p-4 divide-y divide-zinc-700">
        <a href="#" data-action="edit-name" class="flex items-center justify-between py-3">
          <div class="flex flex-col">
            <span>Editar Nombre</span>
            <span class="text-xs text-zinc-500">${nameSubtitle}</span>
          </div>
          <i data-lucide="chevron-right" class="w-5 h-5 text-zinc-500"></i>
        </a>
        <label for="totalpass-toggle" class="flex items-center justify-between py-3 gap-4">
          <span>Usuario TotalPass</span>
          <span class="relative inline-flex items-center">
            <input type="checkbox" id="totalpass-toggle" class="sr-only peer" ${state.isTotalPass?'checked':''}>
            <span class="block w-11 h-6 rounded-full bg-zinc-700 transition-colors peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 peer-checked:bg-indigo-600"></span>
            <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></span>
          </span>
        </label>
        <div class="flex items-center justify-between py-3">
          <span>Tipo de Suscripción</span>
          <span class="px-2 py-1 rounded text-xs ${subscriptionBadgeClass}">${subscriptionLabel}</span>
        </div>
        <button id="enablePush" class="flex items-center justify-between w-full py-3">
          <div class="flex flex-col text-left">
            <span>Notificaciones Push</span>
            <span class="text-xs text-zinc-500">${pushStatusText}</span>
          </div>
          <div class="flex items-center gap-2">
            <i data-lucide="${pushEnabled?'bell-ring':'bell-off'}" class="w-5 h-5 ${pushEnabled?'text-orange-400':'text-zinc-500'}"></i>
            <i data-lucide="chevron-right" class="w-5 h-5 text-zinc-500"></i>
          </div>
        </button>
        <a href="#" data-action="logout" class="flex items-center justify-between py-3 text-rose-400">
          <span>Cerrar Sesión</span>
          <i data-lucide="log-out" class="w-5 h-5"></i>
        </a>
      </div>
    </div>`;
}
