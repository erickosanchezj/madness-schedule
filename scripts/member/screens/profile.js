// scripts/member/screens/profile.js
// Profile screen: who you are (with name edit), membership status, strikes, reminders, settings (TotalPass, sign-out) and contact.
// Members see their account state at a glance and manage their settings here.
// RELEVANT FILES: scripts/member/render.js, scripts/member/push.js, scripts/member/state.js, docs/mockups/profile-unslop-mockup.html

const WHATSAPP_URL = 'https://wa.me/5215539887713';
// Contact buttons show only the name: a generic icon next to "WhatsApp" adds nothing.
const profileWhatsApp = () => `<a href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" class="profile-btn-line">WhatsApp</a>`;

function getProfileScreenHTML(){
  const user = state.currentUser;
  const safeName = DOMPurify.sanitize(user.displayName || '');
  const safeEmail = DOMPurify.sanitize(user.email || '');
  const initial = DOMPurify.sanitize(((user.displayName || user.email || 'U').trim().charAt(0) || 'U').toUpperCase());
  const avatar = user.photoURL
    ? `<img src="${DOMPurify.sanitize(user.photoURL)}" alt="" class="profile-avatar">`
    : `<span class="profile-avatar" aria-hidden="true">${initial}</span>`;
  // Push is "on" when the browser allows it and this phone saved its token (scripts/member/push.js).
  const pushAvailable = typeof Notification !== 'undefined' && isPushSupported();
  const pushOn = pushAvailable && Notification.permission === 'granted' && !!localStorage.getItem(LS_KEY);

  // Settings has no "Nombre" row: the pencil in the header edits the name.
  // The "Avisos" row shows only while push is on; while it is off, the reminders card already shows that state.
  return `
    <div class="profile-screen screen-layout p-6 space-y-6">
      <header class="profile-me">
        ${avatar}
        <div class="min-w-0"><h1 class="heading-display">${safeName || safeEmail}</h1>${safeName ? `<p>${safeEmail}</p>` : ''}</div>
        <button type="button" data-action="edit-name" class="profile-icon-btn" aria-label="Editar nombre"><i data-lucide="pencil" aria-hidden="true"></i></button>
      </header>
      ${profileMembershipHTML()}
      ${profileStrikesHTML()}
      ${pushOn ? '' : profileRemindersHTML(pushAvailable)}
      <section aria-labelledby="settings-title">
        <h2 id="settings-title" class="agenda-eyebrow">Ajustes</h2>
        <div class="history-panel profile-settings">
          ${pushOn ? '<button type="button" id="enablePush" class="profile-setting"><span>Avisos antes de clase<small>Activados</small></span><i data-lucide="bell-ring" aria-hidden="true"></i></button>' : ''}
          <label for="totalpass-toggle" class="profile-setting">
            <span>Uso TotalPass<small>Te recordamos enviar tu token</small></span>
            <span class="relative inline-flex items-center">
              <input type="checkbox" id="totalpass-toggle" class="sr-only peer" ${state.isTotalPass ? 'checked' : ''}>
              <span class="block w-11 h-6 rounded-full bg-zinc-700 transition-colors peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 peer-checked:bg-indigo-600"></span>
              <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></span>
            </span>
          </label>
          <button type="button" data-action="logout" class="profile-setting profile-logout"><span>Cerrar sesión</span><i data-lucide="log-out" aria-hidden="true"></i></button>
        </div>
      </section>
      <section aria-labelledby="contact-title">
        <h2 id="contact-title" class="agenda-eyebrow">Escríbenos</h2>
        <div class="profile-contact">
          ${profileWhatsApp()}
          <a href="https://instagram.com/madness_crosstrainingmx" target="_blank" rel="noopener noreferrer" class="profile-btn-line">Instagram</a>
        </div>
      </section>
    </div>`;
}

// Membership: type in the heading, payment status in the tag. Monthly members who did not pay can book until the grace date.
// TotalPass and per-class cards have no tag, because it would only repeat the heading.
function profileMembershipHTML(){
  const type = typeof state.subscriptionType === 'string' ? state.subscriptionType : 'monthly';
  const paid = state.subscriptionStatus === 'paid';
  const grace = state.subscriptionGraceUntil instanceof Date && !Number.isNaN(state.subscriptionGraceUntil.getTime()) ? state.subscriptionGraceUntil : null;
  const inGrace = grace ? Date.now() <= grace.getTime() : false;
  const deadline = formatGraceDeadline(grace);
  let card;
  if (type === 'totalpass') card = ['', 'TotalPass', '', '', 'Envía tu token después de cada clase desde Historial.'];
  else if (type !== 'monthly') card = ['', 'Membresía por clase', '', '', ''];
  else if (paid) card = ['', 'Membresía mensual', 'ok', 'Al corriente', ''];
  else if (inGrace) card = ['is-warn', 'Membresía mensual', 'warn', 'Pago pendiente', `Paga antes del <b>${deadline}</b> para seguir reservando.`];
  else card = ['is-bad', 'Membresía mensual', 'bad', 'Pago vencido', `Tu periodo de gracia terminó el ${deadline}. Paga en recepción o escríbenos para volver a reservar.`];
  const [panel, title, tone, tag, text] = card;
  return `
      <section class="history-panel ${panel}" aria-labelledby="membership-title"${tone === 'bad' ? ' role="alert"' : ''}>
        <div class="profile-row"><h2 id="membership-title">${title}</h2>${tag ? `<span class="profile-tag is-${tone}">${tag}</span>` : ''}</div>
        ${text ? `<p class="profile-sub">${text}</p>` : ''}
        ${tone === 'bad' ? `<div class="profile-contact">${profileWhatsApp()}</div>` : ''}
      </section>`;
}

// Strikes: a 3-part bar instead of a big number. Blocked members (3 strikes, or still blacklisted) see how to get unblocked.
// The bar is the only count on screen, so its aria-label gives screen readers the number.
function profileStrikesHTML(){
  const { strikeCount, strikeMessage, blocked } = getStrikeInfo();
  // Strikes reset on the 1st of each month (functions/index.js → automaticWhitelisting).
  const [y, m] = dateHelper.today.split('-').map(Number);
  const resetMonth = new Date(Date.UTC(y, m, 1, 12)).toLocaleDateString('es-MX', { timeZone: 'UTC', month: 'long' });
  return `
      <section class="history-panel${blocked ? ' is-bad' : ''}" aria-labelledby="strikes-title">
        <h2 id="strikes-title">Strikes por cancelación</h2>
        <div class="profile-meter${blocked ? ' is-full' : ''}" role="img" aria-label="${blocked ? 'Reservas bloqueadas' : `${strikeCount} de 3 strikes`}">${[1, 2, 3].map(i => `<i class="${i <= strikeCount || blocked ? 'is-on' : ''}"></i>`).join('')}</div>
        <p class="profile-sub">${strikeMessage}</p>
        ${blocked ? `<div class="profile-contact">${profileWhatsApp()}</div>` : `<p class="profile-small">Se reinician el 1 de ${resetMonth}.</p>`}
      </section>`;
}

// Reminders card while push is off: a clear button, or a hint when this browser cannot show notifications.
// Its heading uses the same name as the setting ("avisos") so one thing has one name.
function profileRemindersHTML(available){
  return `
      <section class="history-panel" aria-labelledby="remind-title">
        <h2 id="remind-title">${available ? 'Avisos antes de clase' : 'Tu navegador no permite avisos'}</h2>
        <p class="profile-sub">${available
          ? 'Te avisamos 60, 30 y 15 min antes de tu clase, y cuando se libere un lugar de tu lista de espera.'
          : 'Instala la app en tu pantalla de inicio para recibir avisos antes de clase.'}</p>
        ${available ? '<button type="button" id="enablePush" class="btn-primary px-4 mt-3">Activar avisos</button>' : ''}
      </section>`;
}
