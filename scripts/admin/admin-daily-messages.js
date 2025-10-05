// /scripts/admin/admin-daily-messages.js
// Manages the daily message CRUD workflow shown in the admin app
// Keeps message-specific Firestore listeners out of broader dashboard logic
// RELEVANT FILES: scripts/admin/admin-state.js, scripts/admin/admin-bootstrap.js, scripts/admin/admin-attendance-dashboard.js

import { AdminPanel } from './admin-state.js';

AdminPanel.listenDailyMessages = function listenDailyMessages() {
  if (this.state.unsubDailyMessages) {
    this.state.unsubDailyMessages();
    this.state.unsubDailyMessages = null;
  }
  this.state.unsubDailyMessages = this.db
    .collection('dailyMessages')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .onSnapshot(async (snap) => {
      const cache = this.state.userCache instanceof Map ? this.state.userCache : new Map();
      this.state.userCache = cache;
      const messages = await Promise.all(
        snap.docs.map(async (doc) => {
          const data = doc.data() || {};
          const message = { id: doc.id, ...data };
          const storedName = typeof data.createdByName === 'string' && data.createdByName.trim() ? data.createdByName.trim() : '';
          if (storedName) {
            message.creatorName = storedName;
            if (data.createdBy) cache.set(data.createdBy, storedName);
            return message;
          }
          const uid = typeof data.createdBy === 'string' ? data.createdBy : '';
          if (!uid) {
            message.creatorName = '';
            return message;
          }
          if (cache.has(uid)) {
            message.creatorName = cache.get(uid) || uid;
            return message;
          }
          try {
            const userSnap = await this.db.collection('users').doc(uid).get();
            const userData = userSnap.exists ? userSnap.data() || {} : {};
            const resolvedName = [userData.displayName, userData.name, userData.email].find((value) => typeof value === 'string' && value.trim()) || '';
            const finalName = resolvedName || uid;
            cache.set(uid, finalName);
            message.creatorName = finalName;
          } catch (fetchErr) {
            console.warn('No se pudo resolver el nombre del usuario', fetchErr);
            cache.set(uid, uid);
            message.creatorName = uid;
          }
          return message;
        })
      );
      this.state.dailyMessages = messages;
      this.renderDailyMessages();
    }, (err) => {
      console.error(err);
      this.showToast({ title: 'Error cargando mensajes diarios', message: err.message, variant: 'error' });
    });
};

AdminPanel.renderDailyMessages = function renderDailyMessages() {
  const list = document.getElementById('daily-messages-list');
  if (!list) return;
  if (!this.state.dailyMessages.length) {
    list.innerHTML = '<p class="text-sm text-zinc-400">No hay mensajes guardados.</p>';
    return;
  }
  list.innerHTML = this.state.dailyMessages
    .map((msg) => {
      const safeId = DOMPurify.sanitize(msg.id || '');
      const sanitized = DOMPurify.sanitize(msg.message || '');
      const formatted = sanitized.replace(/\n/g, '<br>') || '<span class="text-zinc-400">(Sin contenido)</span>';
      const createdAt = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
      const createdLabel = createdAt ? `${this.dayShortFmt.format(createdAt)} ${this.timeFmt.format(createdAt)}` : 'Sin fecha';
      const safeCreated = DOMPurify.sanitize(createdLabel);
      const rawCreator = typeof msg.creatorName === 'string' && msg.creatorName.trim()
        ? msg.creatorName
        : (msg.createdBy ? String(msg.createdBy) : '');
      const creator = rawCreator ? DOMPurify.sanitize(rawCreator) : '';
      const statusBadge = msg.isActive
        ? '<span class="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs">Activo</span>'
        : '<span class="px-2 py-1 rounded-md bg-zinc-700 text-zinc-300 text-xs">Inactivo</span>';
      const creatorLine = creator
        ? `<span class="text-xs text-zinc-400">Creado por: ${creator}</span>`
        : '';
      return `
        <article class="p-4 bg-zinc-900/70 border border-zinc-700 rounded-lg space-y-3" data-daily-id="${safeId}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-semibold text-white">${statusBadge}</h3>
            <span class="text-xs text-zinc-400">${safeCreated}</span>
          </div>
          <div class="text-sm leading-relaxed text-zinc-200">${formatted}</div>
          <div class="flex flex-wrap items-center gap-3">
            ${creatorLine}
            <button class="text-xs text-indigo-400 hover:text-indigo-300" data-daily-action="edit" data-id="${safeId}">Editar</button>
            <button class="text-xs text-amber-400 hover:text-amber-300" data-daily-action="toggle" data-id="${safeId}" data-active="${msg.isActive ? 'true' : 'false'}">
              ${msg.isActive ? 'Desactivar' : 'Activar'}
            </button>
            <button class="text-xs text-rose-400 hover:text-rose-300" data-daily-action="delete" data-id="${safeId}">Eliminar</button>
          </div>
        </article>`;
    })
    .join('');
};

AdminPanel.resetDailyMessageForm = function resetDailyMessageForm() {
  const idInput = document.getElementById('daily-message-id');
  const textArea = document.getElementById('daily-message-text');
  const activeInput = document.getElementById('daily-message-active');
  const statusEl = document.getElementById('daily-message-form-status');
  const submitBtn = document.getElementById('daily-message-submit');
  if (idInput) idInput.value = '';
  if (textArea) textArea.value = '';
  if (activeInput) activeInput.checked = true;
  if (submitBtn) submitBtn.textContent = 'Guardar Mensaje';
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
  }
};

AdminPanel.populateDailyMessageForm = function populateDailyMessageForm(msg) {
  const idInput = document.getElementById('daily-message-id');
  const textArea = document.getElementById('daily-message-text');
  const activeInput = document.getElementById('daily-message-active');
  const statusEl = document.getElementById('daily-message-form-status');
  const submitBtn = document.getElementById('daily-message-submit');
  if (!idInput || !textArea || !activeInput || !submitBtn) return;
  if (!msg) {
    this.resetDailyMessageForm();
    return;
  }
  idInput.value = msg.id || '';
  textArea.value = msg.message || '';
  activeInput.checked = !!msg.isActive;
  submitBtn.textContent = 'Actualizar Mensaje';
  if (statusEl) {
    const createdAt = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
    const label = createdAt ? `${this.dayShortFmt.format(createdAt)} ${this.timeFmt.format(createdAt)}` : 'Sin fecha';
    statusEl.textContent = `Editando mensaje (${label})`;
    statusEl.classList.remove('hidden');
  }
};

AdminPanel.handleDailyMessageListClick = function handleDailyMessageListClick(event) {
  const btn = event.target.closest('[data-daily-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  const action = btn.dataset.dailyAction;
  if (action === 'edit') {
    const msg = this.state.dailyMessages.find((m) => m.id === id);
    if (msg) this.populateDailyMessageForm(msg);
  } else if (action === 'toggle') {
    const active = btn.dataset.active === 'true';
    this.toggleDailyMessage(id, active);
  } else if (action === 'delete') {
    const confirmed = window.confirm('¿Eliminar este mensaje? Esta acción no se puede deshacer.');
    if (confirmed) this.deleteDailyMessage(id);
  }
};

AdminPanel.toggleDailyMessage = async function toggleDailyMessage(id, currentlyActive) {
  try {
    await this.db.collection('dailyMessages').doc(id).update({
      isActive: !currentlyActive,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    this.showToast({ title: !currentlyActive ? 'Mensaje activado' : 'Mensaje desactivado' });
  } catch (err) {
    console.error(err);
    this.showToast({ title: 'Error actualizando mensaje', message: err.message, variant: 'error' });
  }
};

AdminPanel.deleteDailyMessage = async function deleteDailyMessage(id) {
  try {
    await this.db.collection('dailyMessages').doc(id).delete();
    this.showToast({ title: 'Mensaje eliminado' });
  } catch (err) {
    console.error(err);
    this.showToast({ title: 'Error eliminando mensaje', message: err.message, variant: 'error' });
  }
};

AdminPanel.submitDailyMessage = async function submitDailyMessage(event) {
  event.preventDefault();
  const idInput = document.getElementById('daily-message-id');
  const textArea = document.getElementById('daily-message-text');
  const activeInput = document.getElementById('daily-message-active');
  if (!textArea || !activeInput) return;
  const docId = idInput?.value.trim();
  const message = textArea.value.trim();
  const isActive = !!activeInput.checked;
  if (!message) {
    this.showToast({ title: 'Escribe un mensaje', variant: 'warn' });
    return;
  }
  const payload = {
    message,
    isActive,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    if (docId) {
      await this.db.collection('dailyMessages').doc(docId).update(payload);
      this.showToast({ title: 'Mensaje actualizado' });
    } else {
      const createData = {
        ...payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: this.auth.currentUser?.uid || '',
        createdByName: this.auth.currentUser?.displayName || this.auth.currentUser?.email || ''
      };
      await this.db.collection('dailyMessages').add(createData);
      this.showToast({ title: 'Mensaje creado' });
    }
    this.resetDailyMessageForm();
  } catch (err) {
    console.error(err);
    this.showToast({ title: 'Error guardando mensaje', message: err.message, variant: 'error' });
  }
};
