// /scripts/admin/admin-blacklist.js
// Loads and manages the blacklist of users with booking restrictions
// Keeps blacklist logic modular so it can evolve independently of user search tools
// RELEVANT FILES: scripts/admin/admin-users.js, scripts/admin/admin-state.js, functions/index.js

import { AdminPanel } from './admin-state.js';

AdminPanel.listBlacklistedUsers = async function listBlacklistedUsers() {
  const container = document.getElementById('blacklisted-users-container');
  const feedback = document.getElementById('blacklisted-users-feedback');
  if (!container) return;
  const loadingHtml = '<div class="p-4 bg-zinc-900 rounded-lg text-sm text-zinc-400">Cargando usuarios…</div>';
  container.innerHTML = loadingHtml;
  if (feedback) {
    feedback.textContent = 'Cargando usuarios bloqueados…';
    feedback.classList.remove('hidden');
  }
  try {
    const snap = await this.db.collection('users').where('blacklisted', '==', true).get();
    if (snap.empty) {
      container.innerHTML = '<div class="p-4 bg-zinc-900 rounded-lg text-sm text-zinc-400">No hay usuarios en lista negra.</div>';
      if (feedback) {
        feedback.textContent = 'Sin usuarios bloqueados.';
        feedback.classList.remove('hidden');
      }
      this.state.blacklistedUsers = [];
      return;
    }
    this.state.blacklistedUsers = snap.docs;
    container.innerHTML = snap.docs.map((doc) => this.blacklistCardHTML(doc)).join('');
    if (feedback) {
      feedback.textContent = `Usuarios bloqueados: ${snap.size}`;
      feedback.classList.remove('hidden');
    }
    this.wireBlacklistButtons();
  } catch (e) {
    container.innerHTML = '<div class="p-4 bg-zinc-900 rounded-lg text-sm text-rose-400">No se pudo cargar la lista negra.</div>';
    if (feedback) {
      feedback.textContent = 'Error al cargar la lista negra.';
      feedback.classList.remove('hidden');
    }
    this.showToast({ title: 'Error al listar lista negra', message: e.message, variant: 'error' });
  }
};

AdminPanel.blacklistCardHTML = function blacklistCardHTML(userDoc) {
  const data = userDoc.data() || {};
  const safeName = DOMPurify.sanitize(data.displayName || 'Usuario sin nombre');
  const safeEmail = DOMPurify.sanitize(data.email || 'Sin correo');
  const strikesRaw = Number(data.lateCancellations);
  const strikes = Number.isFinite(strikesRaw) ? Math.max(0, strikesRaw) : 0;
  const safeStrikes = DOMPurify.sanitize(String(strikes));
  let formattedDate = 'Sin fecha registrada';
  const rawDate = data.blacklistedAt;
  let dateObj = null;
  if (rawDate?.toDate) dateObj = rawDate.toDate();
  else if (rawDate instanceof Date) dateObj = rawDate;
  if (dateObj instanceof Date && !Number.isNaN(dateObj.getTime())) {
    formattedDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(dateObj);
  }
  const safeDate = DOMPurify.sanitize(formattedDate);
  const safeUid = DOMPurify.sanitize(userDoc.id);
  return `
    <div class="p-4 bg-zinc-700/50 rounded-lg border border-zinc-600/50 space-y-2" data-user-card="${safeUid}">
      <div>
        <h3 class="text-lg font-semibold">${safeName}</h3>
        <p class="text-sm text-zinc-300">${safeEmail}</p>
      </div>
      <p class="text-sm text-zinc-400">Strikes: ${safeStrikes} / 3</p>
      <p class="text-xs text-zinc-500">Fecha de bloqueo: ${safeDate}</p>
      <button data-action="whitelist-user" data-user-id="${safeUid}" class="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-md text-sm">Rehabilitar Usuario</button>
    </div>`;
};

AdminPanel.wireBlacklistButtons = function wireBlacklistButtons() {
  document.querySelectorAll('[data-action="whitelist-user"]').forEach((btn) => {
    btn.onclick = () => this.whitelistUser(btn.dataset.userId);
  });
};

AdminPanel.whitelistUser = async function whitelistUser(userId) {
  if (!userId) return;
  try {
    await this.db.collection('users').doc(userId).set({
      blacklisted: false,
      lateCancellations: 0,
      blacklistedAt: firebase.firestore.FieldValue.delete()
    }, { merge: true });
    this.showToast({ title: 'Usuario rehabilitado', message: 'El usuario ya puede reservar de nuevo.' });
    await this.listBlacklistedUsers();
  } catch (e) {
    this.showToast({ title: 'No se pudo rehabilitar', message: e.message, variant: 'error' });
  }
};
