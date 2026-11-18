// scripts/admin/banner.js
// Editor for the banner above the member bottom menu: on/off, main text, link text and URL, with a live preview.
// Lets staff change or hide "Queremos escucharte" without touching index.html (applied by scripts/member/banner.js).
// RELEVANT FILES: admin.html, scripts/member/banner.js, styles/member-feedback.css, firestore.rules

Object.assign(AdminPanel, {

  // Today's banner from index.html; shown in the form until staff save something.
  BANNER_DEFAULTS: {
    enabled: true,
    title: 'Queremos escucharte',
    linkText: 'Responder formulario',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSfe_odZeI0RBcS9WPdyUgabFLQSelxqHenmeGho4Gq5-a376Q/viewform',
  },

  // Wires the form once (called from init). Data starts with listenBanner() after login.
  setupBannerEditor(){
    const form = document.getElementById('banner-form');
    form.addEventListener('input', () => {
      this.state.bannerDirty = true; // don't overwrite what staff are typing with a live update
      this.renderBannerPreview();
    });
    form.addEventListener('submit', event => { event.preventDefault(); this.saveBanner(); });
  },

  listenBanner(){
    this.stopBanner();
    this.setBannerStatus('Cargando…');
    this.state.unsubBanner = this.db.collection('appSettings').doc('feedbackBanner').onSnapshot(snap => {
      if (this.state.bannerDirty) return;
      this.fillBannerForm(snap.exists ? { ...this.BANNER_DEFAULTS, ...snap.data() } : this.BANNER_DEFAULTS);
      this.setBannerStatus(snap.exists ? '' : 'Aún no se ha guardado: los miembros ven este banner.');
    }, err => {
      console.error('No se pudo cargar el banner', err);
      this.setBannerStatus('No se pudo cargar la configuración del banner.');
    });
  },

  stopBanner(){
    if (this.state.unsubBanner) this.state.unsubBanner();
    this.state.unsubBanner = null;
    this.state.bannerDirty = false;
  },

  setBannerStatus(text){
    const el = document.getElementById('banner-status');
    if (el) el.textContent = text;
  },

  fillBannerForm(settings){
    document.getElementById('banner-enabled').checked = settings.enabled !== false;
    document.getElementById('banner-text').value = settings.title || '';
    document.getElementById('banner-link-text').value = settings.linkText || '';
    document.getElementById('banner-url').value = settings.url || '';
    this.renderBannerPreview();
  },

  readBannerForm(){
    return {
      enabled: document.getElementById('banner-enabled').checked,
      title: document.getElementById('banner-text').value.trim(),
      linkText: document.getElementById('banner-link-text').value.trim(),
      url: document.getElementById('banner-url').value.trim(),
    };
  },

  // Same markup and classes as the member banner, so the preview matches the app.
  renderBannerPreview(){
    const settings = this.readBannerForm();
    document.getElementById('banner-preview-title').textContent = settings.title || 'Texto principal';
    document.getElementById('banner-preview-link').textContent = settings.linkText;
    document.getElementById('banner-preview-link').parentElement.hidden = !settings.linkText;
    document.getElementById('banner-preview').classList.toggle('is-off', !settings.enabled);
    document.getElementById('banner-preview-off').hidden = settings.enabled;
  },

  async saveBanner(){
    const settings = this.readBannerForm();
    if (!settings.title){ this.showToast({ title: 'Falta el texto principal', variant: 'warn' }); return; }
    if (!/^https:\/\//.test(settings.url)){
      this.showToast({ title: 'Enlace no válido', message: 'Debe empezar con https://', variant: 'warn' });
      return;
    }
    const btn = document.getElementById('banner-save-btn');
    btn.disabled = true;
    try {
      // set() without merge: the document holds exactly the four fields the rule allows.
      await this.db.collection('appSettings').doc('feedbackBanner').set(settings);
      this.state.bannerDirty = false;
      this.setBannerStatus('');
      this.showToast({ title: 'Banner guardado', message: settings.enabled ? 'Los miembros ya ven el cambio.' : 'El banner quedó oculto para los miembros.' });
    } catch (e) {
      this.showToast({ title: 'No se pudo guardar el banner', message: e.message, variant: 'error' });
    } finally {
      btn.disabled = false;
    }
  },
});
