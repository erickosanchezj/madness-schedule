// scripts/admin/reels.js
// Reels editor: live list, create/edit with phone preview, activate, reorder, duplicate and delete.
// Staff manage several reels; the member app plays the active ones in this order (scripts/member/feedback.js).
// RELEVANT FILES: scripts/admin/views/reels.js, scripts/reel-template.js, scripts/member/feedback.js, firestore.rules

Object.assign(AdminPanel, {

  // Form field id → reel field name.
  REEL_FIELDS: {
    'reel-eyebrow': 'eyebrow', 'reel-title': 'title', 'reel-highlight': 'highlight',
    'reel-description': 'description', 'reel-cta-text': 'ctaText', 'reel-cta-url': 'ctaUrl', 'reel-footer': 'footer',
  },

  // Wires the buttons once (called from init). Data starts with listenReels() after login.
  setupReelEditor(){
    const form = document.getElementById('reel-form');
    document.getElementById('reel-new-btn').onclick = () => this.openReelEditor(null);
    document.getElementById('reel-cancel-btn').onclick = () => this.closeReelEditor();
    form.addEventListener('input', () => this.renderReelPreview());
    form.addEventListener('submit', event => { event.preventDefault(); this.saveReel(); });
    document.getElementById('reels-list').addEventListener('click', event => {
      const btn = event.target.closest('[data-reel-action]');
      if (btn) this.handleReelAction(btn.dataset.reelAction, btn.dataset.id);
    });
  },

  listenReels(){
    this.stopReels();
    this.state.unsubReels = this.db.collection('reels').onSnapshot(snap => {
      this.state.reels = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      this.renderReelList();
    }, err => {
      console.error('No se pudieron cargar los reels', err);
      document.getElementById('reels-list').innerHTML = '<p class="text-sm text-rose-300">No se pudieron cargar los reels.</p>';
    });
  },

  stopReels(){
    if (this.state.unsubReels) this.state.unsubReels();
    this.state.unsubReels = null;
    this.state.reels = [];
    this.closeReelEditor();
  },

  renderReelList(){
    const list = document.getElementById('reels-list');
    const reels = this.state.reels;
    if (!reels.length){
      list.innerHTML = '<p class="text-sm text-zinc-400">Aún no hay reels, así que no se muestra ninguno. Crea uno con "Nuevo reel" (empieza con el texto del reel original).</p>';
      return;
    }
    const btn = 'bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-1 px-3 rounded-md text-sm';
    list.innerHTML = reels.map((reel, i) => {
      const id = DOMPurify.sanitize(reel.id);
      const name = DOMPurify.sanitize(`${reel.title || ''} ${reel.highlight || ''}`.replace(/\s+/g, ' ').trim() || 'Sin título');
      const badge = reel.active
        ? '<span class="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs">Activo</span>'
        : '<span class="px-2 py-1 rounded-md bg-zinc-700 text-zinc-300 text-xs">Inactivo</span>';
      return `
        <article class="admin-reel-row">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-zinc-500 text-sm">${i + 1}.</span>
            <p class="font-semibold truncate">${name}</p>
            ${badge}
            <span class="text-xs text-zinc-400">${window.madnessReel.seconds(reel)} s</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="${btn}" data-reel-action="up" data-id="${id}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="${btn}" data-reel-action="down" data-id="${id}" aria-label="Bajar" ${i === reels.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="${btn}" data-reel-action="edit" data-id="${id}">Editar</button>
            <button type="button" class="${btn}" data-reel-action="duplicate" data-id="${id}">Duplicar</button>
            <button type="button" class="${btn}" data-reel-action="toggle" data-id="${id}">${reel.active ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="${btn}" data-reel-action="delete" data-id="${id}">Eliminar</button>
          </div>
        </article>`;
    }).join('');
  },

  async handleReelAction(action, id){
    const reels = this.state.reels;
    const i = reels.findIndex(r => r.id === id);
    const reel = reels[i];
    if (!reel) return;
    const col = this.db.collection('reels');
    const now = firebase.firestore.FieldValue.serverTimestamp();
    try {
      if (action === 'edit') return this.openReelEditor(reel);
      if (action === 'toggle') return await col.doc(id).update({ active: !reel.active, updatedAt: now });
      if (action === 'up' || action === 'down'){
        // Swap the order numbers of this reel and its neighbour in one batch.
        const other = reels[action === 'up' ? i - 1 : i + 1];
        if (!other) return;
        const batch = this.db.batch();
        batch.update(col.doc(reel.id), { order: other.order, updatedAt: now });
        batch.update(col.doc(other.id), { order: reel.order, updatedAt: now });
        return await batch.commit();
      }
      if (action === 'duplicate'){
        const { id: _id, ...copy } = reel;
        await col.add({ ...this.cleanReel(copy), active: false, order: this.nextReelOrder(), updatedAt: now });
        return this.showToast({ title: 'Reel duplicado', message: 'La copia quedó inactiva al final de la lista.' });
      }
      if (action === 'delete'){
        const ok = await this.confirmDialog({
          title: 'Eliminar reel', message: 'El reel se borrará y dejará de mostrarse. No se puede deshacer.',
          confirmLabel: 'Eliminar', danger: true
        });
        if (ok) await col.doc(id).delete();
      }
    } catch (e) {
      this.showToast({ title: 'No se pudo guardar el cambio', message: e.message, variant: 'error' });
    }
  },

  nextReelOrder(){
    return this.state.reels.reduce((max, r) => Math.max(max, Number(r.order) || 0), 0) + 1;
  },

  // Only the fields the Firestore rule accepts, trimmed, with seconds as a whole number.
  cleanReel(reel){
    const clean = {};
    Object.values(this.REEL_FIELDS).forEach(key => { clean[key] = String(reel[key] ?? '').trim(); });
    clean.seconds = window.madnessReel.seconds(reel);
    return clean;
  },

  // reel = null → new reel, pre-filled with the original reel's text.
  openReelEditor(reel){
    this.state.editingReelId = reel?.id || null;
    const source = reel || window.madnessReel.defaults;
    Object.entries(this.REEL_FIELDS).forEach(([inputId, key]) => { document.getElementById(inputId).value = source[key] ?? ''; });
    document.getElementById('reel-seconds').value = window.madnessReel.seconds(source);
    document.getElementById('reel-active').checked = !!reel?.active;
    document.getElementById('reel-form-title').textContent = reel ? 'Editar reel' : 'Nuevo reel';
    const form = document.getElementById('reel-form');
    form.hidden = false;
    this.renderReelPreview();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('reel-title').focus({ preventScroll: true });
  },

  closeReelEditor(){
    this.state.editingReelId = null;
    const form = document.getElementById('reel-form');
    if (form) form.hidden = true;
  },

  readReelForm(){
    const reel = {};
    Object.entries(this.REEL_FIELDS).forEach(([inputId, key]) => { reel[key] = document.getElementById(inputId).value; });
    reel.seconds = document.getElementById('reel-seconds').value;
    return this.cleanReel(reel);
  },

  // Draws the phone preview with the shared template, so it matches the member app.
  renderReelPreview(){
    const reel = this.readReelForm();
    document.getElementById('reel-preview-copy').innerHTML = window.madnessReel.copyHTML(reel);
    document.getElementById('reel-preview-action').hidden = !reel.ctaUrl;
    document.getElementById('reel-preview-cta').textContent = reel.ctaText || 'Abrir enlace';
    document.getElementById('reel-preview-footer').textContent = reel.footer;
    document.getElementById('reel-preview-seconds').textContent = `${reel.seconds} s`;
    lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
  },

  async saveReel(){
    const reel = this.readReelForm();
    if (!reel.title){ this.showToast({ title: 'Falta el título', variant: 'warn' }); return; }
    if (reel.ctaUrl && !/^https:\/\//.test(reel.ctaUrl)){
      this.showToast({ title: 'Enlace no válido', message: 'Debe empezar con https://', variant: 'warn' });
      return;
    }
    const id = this.state.editingReelId;
    const current = this.state.reels.find(r => r.id === id);
    const data = {
      ...reel,
      active: document.getElementById('reel-active').checked,
      order: current ? Number(current.order) || 0 : this.nextReelOrder(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const btn = document.getElementById('reel-save-btn');
    btn.disabled = true;
    try {
      // set() without merge: the document holds exactly the fields the rule allows.
      if (id) await this.db.collection('reels').doc(id).set(data);
      else await this.db.collection('reels').add(data);
      this.showToast({ title: id ? 'Reel actualizado' : 'Reel creado', message: data.active ? 'Ya se muestra a los miembros.' : 'Está inactivo: actívalo para mostrarlo.' });
      this.closeReelEditor();
    } catch (e) {
      this.showToast({ title: 'No se pudo guardar el reel', message: e.message, variant: 'error' });
    } finally {
      btn.disabled = false;
    }
  },
});
