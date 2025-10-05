// /scripts/admin/admin-users.js
// Handles admin user search, listing, and push notification tools
// Keeps user management concerns separate from classes and analytics modules
// RELEVANT FILES: scripts/admin/admin-blacklist.js, scripts/admin/admin-state.js, functions/index.js

import { AdminPanel } from './admin-state.js';

AdminPanel.findUsersByQuery = async function findUsersByQuery() {
  const input = document.getElementById('find-user-query-input');
  const raw = (input.value || '').trim();
  const q = this.normalizeStr(raw);
  const container = document.getElementById('user-details-container');
  const hint = document.getElementById('user-results-hint');
  container.innerHTML = '';
  container.classList.add('hidden');
  hint.classList.add('hidden');
  if (!raw) {
    this.showToast({ title: 'Falta texto de búsqueda', variant: 'warn' });
    return;
  }
  try {
    const results = [];
    if (raw.includes('@')) {
      const snap = await this.db.collection('users').where('emailLower', '==', q).limit(10).get();
      snap.forEach((d) => results.push(d));
      if (!results.length) {
        const snap2 = await this.db.collection('users').where('email', '==', raw).limit(10).get();
        snap2.forEach((d) => results.push(d));
      }
    } else {
      let triedPrefix = false;
      try {
        const start = q;
        const end = `${q}\uf8ff`;
        const byName = await this.db.collection('users').orderBy('displayNameLower').startAt(start).endAt(end).limit(20).get();
        byName.forEach((d) => results.push(d));
        triedPrefix = true;
      } catch (err) {
        console.warn('Búsqueda por prefijo no disponible', err);
      }
      if (!results.length) {
        const page = await this.db.collection('users').limit(300).get();
        page.forEach((d) => {
          const data = d.data() || {};
          const emailL = this.normalizeStr(data.email || '');
          const nameL = this.normalizeStr(data.displayName || '');
          if (emailL.includes(q) || nameL.includes(q)) results.push(d);
        });
        if (!triedPrefix && results.length) {
          hint.textContent = 'Resultado por búsqueda local (sin índice). Considera guardar displayNameLower y crear índice.';
          hint.classList.remove('hidden');
        }
      }
    }
    if (!results.length) {
      this.showToast({ title: 'Sin resultados', message: `No encontramos "${raw}"`, variant: 'warn' });
      return;
    }
    this.state.userSearchResults = results;
    container.innerHTML = results.map((doc, idx) => this.userCardHTML(doc, idx)).join('');
    container.classList.remove('hidden');
    this.wireUserCardButtons();
  } catch (e) {
    this.showToast({ title: 'Error al buscar', message: e.message, variant: 'error' });
  }
};

AdminPanel.listUsersPage = async function listUsersPage() {
  const container = document.getElementById('user-details-container');
  const hint = document.getElementById('user-results-hint');
  container.innerHTML = '';
  container.classList.add('hidden');
  hint.classList.add('hidden');
  try {
    const snap = await this.db.collection('users').get();
    if (snap.empty) {
      this.showToast({ title: 'Sin usuarios', variant: 'warn' });
      return;
    }
    container.innerHTML = snap.docs
      .map((doc) => {
        const data = doc.data() || {};
        const safeName = DOMPurify.sanitize(data.displayName || 'Usuario sin nombre');
        const safeEmail = DOMPurify.sanitize(data.email || '');
        return `
          <div class="p-4 bg-zinc-700/50 rounded-lg">
            <h4 class="font-bold">${safeName}</h4>
            <p class="text-sm text-zinc-400">${safeEmail}</p>
          </div>`;
      })
      .join('');
    container.classList.remove('hidden');
    hint.textContent = `Mostrando ${snap.size} usuarios.`;
    hint.classList.remove('hidden');
  } catch (e) {
    this.showToast({ title: 'Error listando', message: e.message, variant: 'error' });
  }
};

AdminPanel.userCardHTML = function userCardHTML(userDoc, indexBase = 0) {
  const userData = userDoc.data() || {};
  const tokenEntries = userData.fcmTokens ? Object.entries(userData.fcmTokens) : [];
  const safeName = DOMPurify.sanitize(userData.displayName || 'Usuario sin nombre');
  const safeEmail = DOMPurify.sanitize(userData.email || '');
  const head = `
    <div class="p-4 bg-zinc-700/50 rounded-lg">
      <h4 class="font-bold">${safeName}</h4>
      <p class="text-sm text-zinc-400">${safeEmail}</p>
  `;
  if (!tokenEntries.length) {
    return head + '<p class="text-sm text-zinc-400 mt-3">Sin dispositivos registrados.</p></div>';
  }
  const bodies = tokenEntries.map(([token, rawMeta], i) => {
    const safeToken = DOMPurify.sanitize(token);
    const displayToken = DOMPurify.sanitize(safeToken.substring(0, 30));
    const safeUid = DOMPurify.sanitize(userDoc.id);
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : null;
    let registeredAtStr = '';
    if (meta?.registeredAt) {
      const dateObj = meta.registeredAt.toDate ? meta.registeredAt.toDate() : new Date(meta.registeredAt);
      if (dateObj instanceof Date && !Number.isNaN(dateObj.getTime())) {
        registeredAtStr = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(dateObj);
      }
    }
    const metaRows = [];
    if (meta?.userAgent) metaRows.push(`<p class="text-xs text-zinc-400 break-words">UA: ${DOMPurify.sanitize(String(meta.userAgent))}</p>`);
    if (meta?.platform) metaRows.push(`<p class="text-xs text-zinc-400">Plataforma: ${DOMPurify.sanitize(String(meta.platform))}</p>`);
    if (registeredAtStr) metaRows.push(`<p class="text-xs text-zinc-500">Registrado: ${DOMPurify.sanitize(registeredAtStr)}</p>`);
    const screenInfo = meta?.screen || meta?.screenResolution;
    if (screenInfo) metaRows.push(`<p class="text-xs text-zinc-500">Pantalla: ${DOMPurify.sanitize(String(screenInfo))}</p>`);
    if (meta?.timezone) metaRows.push(`<p class="text-xs text-zinc-500">Zona horaria: ${DOMPurify.sanitize(String(meta.timezone))}</p>`);
    if (meta?.browser) metaRows.push(`<p class="text-xs text-zinc-500">Navegador: ${DOMPurify.sanitize(String(meta.browser))}</p>`);
    if (meta?.language) metaRows.push(`<p class="text-xs text-zinc-500">Idioma: ${DOMPurify.sanitize(String(meta.language))}</p>`);
    if (!metaRows.length) metaRows.push('<p class="text-xs text-zinc-500">Sin metadata disponible.</p>');
    const datasetIndex = `${indexBase}_${i}`;
    return `
      <div class="token-row p-3 bg-zinc-900 rounded-lg border border-zinc-700 mt-3">
        <p class="text-xs text-zinc-400 font-mono break-all">Dispositivo ${i + 1}: ${displayToken}...</p>
        <div class="mt-2 space-y-1">${metaRows.join('')}</div>
        <div class="mt-3 space-y-2">
          <input type="text" id="noti-title-${datasetIndex}" class="w-full bg-zinc-700 text-white p-2 rounded-md text-sm" placeholder="Título de la notificación">
          <textarea id="noti-body-${datasetIndex}" class="w-full bg-zinc-700 text-white p-2 rounded-md text-sm" placeholder="Mensaje a enviar"></textarea>
          <div class="flex flex-wrap gap-2 text-xs">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1 rounded" data-action="send-direct" data-token="${safeToken}" data-index="${datasetIndex}" data-uid="${safeUid}">Enviar a este Dispositivo</button>
            <button class="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-3 py-1 rounded" data-action="prune-token" data-token="${safeToken}" data-uid="${safeUid}">Eliminar token</button>
          </div>
        </div>
      </div>`;
  }).join('');
  return `${head}${bodies}</div>`;
};

AdminPanel.wireUserCardButtons = function wireUserCardButtons() {
  document.querySelectorAll('[data-action="send-direct"]').forEach((btn) => {
    btn.onclick = (event) => this.sendDirectNotification(event);
  });
  document.querySelectorAll('[data-action="prune-token"]').forEach((btn) => {
    btn.onclick = (event) => this.pruneTokenManually(event);
  });
};

AdminPanel.sendDirectNotification = async function sendDirectNotification(event) {
  const btn = event.target;
  const { token, index, uid } = btn.dataset;
  const title = document.getElementById(`noti-title-${index}`)?.value.trim();
  const body = document.getElementById(`noti-body-${index}`)?.value.trim();
  if (!title || !body) {
    this.showToast({ title: 'Faltan datos', message: 'El título y el cuerpo son requeridos.', variant: 'warn' });
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    if (this.auth.currentUser) await this.auth.currentUser.getIdToken(true);
    const send = this.functions.httpsCallable('sendDirectNotification');
    const result = await send({ token, title, body });
    if (result.data?.success) {
      this.showToast({ title: 'Notificación enviada', message: 'Dispositivo notificado ✅' });
    } else {
      throw new Error(result.data?.error || 'El servidor devolvió un error.');
    }
  } catch (e) {
    const msg = String(e?.message || e);
    this.showToast({ title: 'Error al enviar', message: msg, variant: 'error' });
    const looksInvalid = /not[-\s]?registered|unregistered|invalid[-\s]?registration|registration[-\s]?token|mismatch/i.test(msg);
    if (looksInvalid && uid && token) {
      const ok = confirm('Este token parece inválido. ¿Quieres eliminarlo del perfil del usuario?');
      if (ok) {
        try {
          await this.db.collection('users').doc(uid).set({
            fcmTokens: { [token]: firebase.firestore.FieldValue.delete() }
          }, { merge: true });
          this.showToast({ title: 'Token eliminado', message: 'Se removió el token inválido.' });
        } catch (pruneErr) {
          this.showToast({ title: 'No se pudo eliminar token', message: pruneErr.message, variant: 'error' });
        }
      }
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar a este Dispositivo';
  }
};

AdminPanel.pruneTokenManually = async function pruneTokenManually(event) {
  const btn = event.target;
  const { token, uid } = btn.dataset;
  if (!uid || !token) return;
  const ok = confirm('¿Eliminar este token del usuario?');
  if (!ok) return;
  btn.disabled = true;
  try {
    await this.db.collection('users').doc(uid).set({
      fcmTokens: { [token]: firebase.firestore.FieldValue.delete() }
    }, { merge: true });
    this.showToast({ title: 'Token eliminado' });
    const freshDoc = await this.db.collection('users').doc(uid).get();
    const idx = this.state.userSearchResults.findIndex((d) => d.id === uid);
    if (idx !== -1) this.state.userSearchResults[idx] = freshDoc;
    const card = btn.closest('.p-4');
    if (card) {
      card.outerHTML = this.userCardHTML(freshDoc, idx === -1 ? 0 : idx);
      this.wireUserCardButtons();
    }
  } catch (e) {
    this.showToast({ title: 'No se pudo eliminar', message: e.message, variant: 'error' });
  } finally {
    btn.disabled = false;
  }
};
