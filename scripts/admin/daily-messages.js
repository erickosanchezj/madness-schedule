// scripts/admin/daily-messages.js
// Daily announcement CRUD: list, edit, toggle, delete, save, optional expiry date and live preview.
// Staff write the messages shown in the member app.
// RELEVANT FILES: scripts/member/screens/agenda.js, scripts/admin/init.js, firestore.rules

Object.assign(AdminPanel, {

  listenDailyMessages(){
    if (this.state.unsubDailyMessages) { this.state.unsubDailyMessages(); this.state.unsubDailyMessages = null; }
    this.state.unsubDailyMessages = this.db.collection('dailyMessages')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(async (snap)=>{
        // We reuse cached user names to avoid repeated fetches.
        const cache = this.state.userCache instanceof Map ? this.state.userCache : new Map();
        this.state.userCache = cache;
        const messages = await Promise.all(snap.docs.map(async (doc)=>{
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
            const resolvedName = [userData.displayName, userData.name, userData.email].find(value => typeof value === 'string' && value.trim()) || '';
            const finalName = resolvedName || uid;
            cache.set(uid, finalName);
            message.creatorName = finalName;
          } catch (fetchErr) {
            // We fall back to the UID when the lookup fails.
            console.warn('No se pudo resolver el nombre del usuario', fetchErr);
            cache.set(uid, uid);
            message.creatorName = uid;
          }
          return message;
        }));
        this.state.dailyMessages = messages;
        this.renderDailyMessages();
      }, err=>{
        console.error(err);
        this.showToast({ title:'Error cargando mensajes diarios', message: err.message, variant:'error' });
      });
  },

  // A message with an expiry date hides itself after that day ends (Mexico City).
  isDailyMessageExpired(msg){
    const expires = msg?.expiresAt?.toDate ? msg.expiresAt.toDate() : null;
    return !!expires && expires.getTime() <= Date.now();
  },

  // Wires the live preview and the "Solo hoy" shortcut. Called once from init().
  setupDailyMessageForm(){
    document.getElementById('daily-message-text')?.addEventListener('input', () => this.renderDailyMessagePreview());
    document.getElementById('daily-message-today')?.addEventListener('click', () => {
      document.getElementById('daily-message-expires').value = this.dateHelper.today();
    });
  },

  // Shows the text the way members see it: same line breaks, same card look.
  renderDailyMessagePreview(){
    const preview = document.getElementById('daily-message-preview');
    if (!preview) return;
    const text = document.getElementById('daily-message-text')?.value.trim() || '';
    preview.innerHTML = text
      ? `<p>${DOMPurify.sanitize(text).replace(/\n/g, '<br>')}</p><span aria-hidden="true">✕</span>`
      : '<p class="text-zinc-500">Escribe un mensaje para verlo aquí.</p>';
  },

  renderDailyMessages(){
    const list = document.getElementById('daily-messages-list');
    if (!list) return;
    if (!this.state.dailyMessages.length){
      list.innerHTML = '<p class="text-sm text-zinc-400">No hay mensajes guardados.</p>';
      return;
    }
    list.innerHTML = this.state.dailyMessages.map(msg=>{
      const safeId = DOMPurify.sanitize(msg.id || '');
      const sanitized = DOMPurify.sanitize(msg.message || '');
      const formatted = sanitized.replace(/\n/g,'<br>') || '<span class="text-zinc-400">(Sin contenido)</span>';
      const createdAt = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
      const createdLabel = createdAt ? `${this.dayShortFmt.format(createdAt)} ${this.timeFmt.format(createdAt)}` : 'Sin fecha';
      const safeCreated = DOMPurify.sanitize(createdLabel);
      const rawCreator = typeof msg.creatorName === 'string' && msg.creatorName.trim()
        ? msg.creatorName
        : (msg.createdBy ? String(msg.createdBy) : '');
      const creator = rawCreator ? DOMPurify.sanitize(rawCreator) : '';
      const expired = this.isDailyMessageExpired(msg);
      const statusBadge = expired
        ? '<span class="px-2 py-1 rounded-md bg-zinc-700 text-zinc-300 text-xs">Vencido</span>'
        : msg.isActive
          ? '<span class="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs">Activo</span>'
          : '<span class="px-2 py-1 rounded-md bg-zinc-700 text-zinc-300 text-xs">Inactivo</span>';
      const expiresAt = msg.expiresAt?.toDate ? msg.expiresAt.toDate() : null;
      const expiresLine = expiresAt ? `<span>${expired ? 'Se ocultó' : 'Se oculta'} al terminar el ${DOMPurify.sanitize(this.dayShortFmt.format(expiresAt))}</span>` : '';
      const creatorLine = creator ? `<span class="text-xs text-zinc-500">Creado por: ${creator}</span>` : '';
      return `
        <article class="bg-zinc-900/60 border border-zinc-700 rounded-lg p-4 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 space-y-2">
              <p class="text-sm leading-relaxed text-zinc-100">${formatted}</p>
              <div class="flex flex-wrap gap-3 text-xs text-zinc-400">
                <span>${safeCreated}</span>
                ${creatorLine}
                ${expiresLine}
              </div>
            </div>
            ${statusBadge}
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-1 px-3 rounded-md" data-daily-action="edit" data-id="${safeId}">Editar</button>
            <button type="button" class="${msg.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-semibold py-1 px-3 rounded-md" data-daily-action="toggle" data-id="${safeId}" data-active="${msg.isActive?'true':'false'}">${msg.isActive ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-1 px-3 rounded-md" data-daily-action="delete" data-id="${safeId}">Eliminar</button>
          </div>
        </article>`;
    }).join('');
  },

  resetDailyMessageForm(){
    const idInput = document.getElementById('daily-message-id');
    const textArea = document.getElementById('daily-message-text');
    const activeInput = document.getElementById('daily-message-active');
    const statusEl = document.getElementById('daily-message-form-status');
    const submitBtn = document.getElementById('daily-message-submit');
    if (idInput) idInput.value = '';
    if (textArea) textArea.value = '';
    if (activeInput) activeInput.checked = true;
    const expiresInput = document.getElementById('daily-message-expires');
    if (expiresInput) expiresInput.value = '';
    this.renderDailyMessagePreview();
    if (statusEl){
      statusEl.textContent = '';
      statusEl.classList.add('hidden');
    }
    if (submitBtn) submitBtn.textContent = 'Guardar mensaje';
  },

  populateDailyMessageForm(msg){
    const idInput = document.getElementById('daily-message-id');
    const textArea = document.getElementById('daily-message-text');
    const activeInput = document.getElementById('daily-message-active');
    const statusEl = document.getElementById('daily-message-form-status');
    const submitBtn = document.getElementById('daily-message-submit');
    if (!idInput || !textArea || !activeInput || !submitBtn) return;
    if (!msg){
      this.resetDailyMessageForm();
      return;
    }
    idInput.value = msg.id || '';
    textArea.value = msg.message || '';
    activeInput.checked = !!msg.isActive;
    const expiresInput = document.getElementById('daily-message-expires');
    if (expiresInput) expiresInput.value = msg.expiresAt?.toDate ? this.dateHelper.ymd(msg.expiresAt.toDate()) : '';
    this.renderDailyMessagePreview();
    if (submitBtn) submitBtn.textContent = 'Actualizar mensaje';
    if (statusEl){
      const createdAt = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
      const label = createdAt ? `${this.dayShortFmt.format(createdAt)} ${this.timeFmt.format(createdAt)}` : 'Sin fecha';
      statusEl.textContent = `Editando mensaje (${label})`;
      statusEl.classList.remove('hidden');
    }
  },

  async handleDailyMessageListClick(event){
    const btn = event.target.closest('[data-daily-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    const action = btn.dataset.dailyAction;
    if (action === 'edit'){
      const msg = this.state.dailyMessages.find(m=>m.id===id);
      if (msg) this.populateDailyMessageForm(msg);
    } else if (action === 'toggle'){
      const active = btn.dataset.active === 'true';
      this.toggleDailyMessage(id, active);
    } else if (action === 'delete'){
      const confirmed = await this.confirmDialog({
        title: 'Eliminar mensaje',
        message: 'El mensaje se borrará y dejará de verse en la app. No se puede deshacer.',
        confirmLabel: 'Eliminar',
        danger: true
      });
      if (confirmed) this.deleteDailyMessage(id);
    }
  },

  async toggleDailyMessage(id, currentlyActive){
    try{
      await this.db.collection('dailyMessages').doc(id).update({
        isActive: !currentlyActive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.showToast({ title: !currentlyActive ? 'Mensaje activado' : 'Mensaje desactivado' });
    }catch(err){
      console.error(err);
      this.showToast({ title:'Error actualizando mensaje', message: err.message, variant:'error' });
    }
  },

  async deleteDailyMessage(id){
    try{
      await this.db.collection('dailyMessages').doc(id).delete();
      this.showToast({ title:'Mensaje eliminado' });
    }catch(err){
      console.error(err);
      this.showToast({ title:'Error eliminando mensaje', message: err.message, variant:'error' });
    }
  },

  async submitDailyMessage(event){
    event.preventDefault();
    const idInput = document.getElementById('daily-message-id');
    const textArea = document.getElementById('daily-message-text');
    const activeInput = document.getElementById('daily-message-active');
    if (!textArea || !activeInput) return;
    const docId = idInput?.value.trim();
    const message = textArea.value.trim();
    const isActive = !!activeInput.checked;
    if (!message){
      this.showToast({ title:'Escribe un mensaje', variant:'warn' });
      return;
    }
    const expiresDate = document.getElementById('daily-message-expires')?.value || '';
    if (expiresDate && expiresDate < this.dateHelper.today()){
      this.showToast({ title:'Esa fecha ya pasó', message:'Elige hoy o un día futuro, o deja el campo vacío.', variant:'warn' });
      return;
    }
    const payload = {
      message,
      isActive,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    // Last second of that day in Mexico City (UTC-6 all year since 2022).
    if (expiresDate) payload.expiresAt = new Date(`${expiresDate}T23:59:59-06:00`);
    else if (docId) payload.expiresAt = firebase.firestore.FieldValue.delete(); // editing: clear an old date
    try{
      if (docId){
        await this.db.collection('dailyMessages').doc(docId).update(payload);
        this.showToast({ title:'Mensaje actualizado' });
      } else {
        const createData = {
          ...payload,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: this.auth.currentUser?.uid || '',
          createdByName: this.auth.currentUser?.displayName || this.auth.currentUser?.email || ''
        };
        await this.db.collection('dailyMessages').add(createData);
        this.showToast({ title:'Mensaje creado' });
      }
      this.resetDailyMessageForm();
    }catch(err){
      console.error(err);
      this.showToast({ title:'Error guardando mensaje', message: err.message, variant:'error' });
    }
  },
});
