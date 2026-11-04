// scripts/admin/users.js
// User search, password reset and paginated user listing.
// Staff find members to manage them.
// RELEVANT FILES: scripts/admin/user-cards.js, scripts/admin/subscriptions.js, scripts/admin/init.js

Object.assign(AdminPanel, {

  // ---- USERS: Password reset ----
  async sendPasswordReset(){
    const input = document.getElementById('user-email-input');
    const email = input.value.trim();
    if (!email){ this.showToast({ title:'Falta correo', variant:'warn' }); return; }
    try{
      await this.auth.sendPasswordResetEmail(email);
      this.showToast({ title:'Correo enviado', message:`Revisa ${email}` });
      input.value='';
    }catch(e){
      this.showToast({ title:'No se pudo enviar', message:e.message, variant:'error' });
    }
  },

  // ---- USERS: Buscar por nombre o correo ----
  async findUsersByQuery(){
    const input = document.getElementById('find-user-query-input');
    const raw = (input.value||'').trim();
    const q = this.normalizeStr(raw);
    const container = document.getElementById('user-details-container');
    const hint = document.getElementById('user-results-hint');

    container.innerHTML=''; container.classList.add('hidden'); hint.classList.add('hidden');
    if (!raw){ this.showToast({ title:'Falta texto de búsqueda', variant:'warn' }); return; }

    try{
      const results = [];

      if (raw.includes('@')) {
        // correo exacto
        const snap = await this.db.collection('users').where('emailLower','==',q).limit(10).get();
        snap.forEach(d=>results.push(d));
        if (!results.length){
          const snap2 = await this.db.collection('users').where('email','==',raw).limit(10).get();
          snap2.forEach(d=>results.push(d));
        }
      } else {
        // Name search scans every user. displayNameLower is never stored, so a prefix
        // query always came back empty, and the old fallback stopped at 300 users.
        const all = await this.db.collection('users').get();
        all.forEach(d=>{
          const data=d.data()||{};
          const emailL=this.normalizeStr(data.email||'');
          const nameL=this.normalizeStr(data.displayName||'');
          if (emailL.includes(q) || nameL.includes(q)) results.push(d);
        });
      }

      if (!results.length){
        this.showToast({ title:'Sin resultados', message:`No encontramos "${raw}"`, variant:'warn' });
        return;
      }

      this.state.userSearchResults = results;
      this.state.userPage = 1;
      this.state.userPageStart = 1;
      this.state.userPageEnd = results.length;
      this.state.userHasPreviousPage = false;
      this.state.hasNextUserPage = false;
      this.state.lastUserDoc = null;
      this.renderUserCards();
      this.updateUserResultsHint();
      this.toggleUserPaginationControls(false);
    }catch(e){
      this.showToast({ title:'Error al buscar', message:e.message, variant:'error' });
    }
  },

  // ---- USERS: Listar primera página ----
  async startUsersPagination(){
    this.state.lastUserDoc = null;
    this.state.userPage = 1;
    this.state.userHasPreviousPage = false;
    this.state.hasNextUserPage = false;
    await this.listUsersPage();
  },
  async listUsersPage(){
    const hint = document.getElementById('user-results-hint');
    const container = document.getElementById('user-details-container');

    try{
      const shouldResetPage = !this.state.lastUserDoc;
      let query = this.db.collection('users')
        .orderBy(firebase.firestore.FieldPath.documentId())
        .limit(this.state.userPageSize);
      if (this.state.lastUserDoc){
        query = query.startAfter(this.state.lastUserDoc);
      }
      const snap = await query.get();
      if (snap.empty){
        if (shouldResetPage){
          this.showToast({ title:'Sin usuarios', variant:'warn' });
          this.toggleUserPaginationControls(false);
        } else {
          this.showToast({ title:'No hay más usuarios', variant:'warn' });
        }
        return;
      }

      if (container){
        container.innerHTML = '';
        container.classList.add('hidden');
      }
      if (hint) hint.classList.add('hidden');

      this.state.userSearchResults = snap.docs;
      this.state.userPage = shouldResetPage ? 1 : this.state.userPage + 1;
      this.state.userPageStart = ((this.state.userPage - 1) * this.state.userPageSize) + 1;
      this.state.userPageEnd = this.state.userPageStart + snap.docs.length - 1;
      this.state.userHasPreviousPage = this.state.userPage > 1;
      this.state.hasNextUserPage = snap.docs.length === this.state.userPageSize;
      this.renderUserCards();
      this.updateUserResultsHint();
      this.toggleUserPaginationControls(true);
      this.state.lastUserDoc = snap.docs[snap.docs.length - 1] || null;
    }catch(e){
      this.showToast({ title:'Error listando', message:e.message, variant:'error' });
    }
  },
  async listUsersPreviousPage(){
    if (this.state.userPage <= 1){
      this.showToast({ title:'Ya estás en la primera página', variant:'warn' });
      return;
    }
    this.state.lastUserDoc = null;
    const targetPage = this.state.userPage - 1;
    this.state.userPage = 1;
    this.state.userHasPreviousPage = false;
    this.state.hasNextUserPage = false;
    for (let i = 0; i < targetPage; i += 1){
      // Simple 80/20 approach: replay forward pagination to reach the previous page.
      // This avoids adding complex reverse cursors to the admin panel state.
      // eslint-disable-next-line no-await-in-loop
      await this.listUsersPage();
    }
  },
  async listAllUsers(){
    const hint = document.getElementById('user-results-hint');
    try{
      const snap = await this.db.collection('users').get();
      if (snap.empty){
        this.showToast({ title:'Sin usuarios', variant:'warn' });
        return;
      }
      this.state.userSearchResults = snap.docs;
      this.state.userPage = 1;
      this.state.userPageStart = 1;
      this.state.userPageEnd = snap.docs.length;
      this.state.lastUserDoc = null;
      this.state.hasNextUserPage = false;
      this.state.userHasPreviousPage = false;
      this.renderUserCards();
      if (hint){
        hint.textContent = `Mostrando 1-${snap.docs.length} de usuarios (vista completa).`;
        hint.classList.remove('hidden');
      }
      this.toggleUserPaginationControls(false);
    }catch(e){
      this.showToast({ title:'Error listando', message:e.message, variant:'error' });
    }
  },
  updateUserResultsHint(){
    const hint = document.getElementById('user-results-hint');
    if (!hint) return;
    if (!this.state.userPageStart || !this.state.userPageEnd){
      hint.classList.add('hidden');
      return;
    }
    hint.textContent = `Mostrando ${this.state.userPageStart}-${this.state.userPageEnd} de usuarios.`;
    hint.classList.remove('hidden');
  },
  toggleUserPaginationControls(show){
    const controls = document.getElementById('user-pagination-controls');
    const prevBtn = document.getElementById('user-prev-page-btn');
    const nextBtn = document.getElementById('user-next-page-btn');
    if (!controls) return;
    controls.classList.toggle('hidden', !show);
    if (prevBtn) prevBtn.disabled = !this.state.userHasPreviousPage;
    if (nextBtn) nextBtn.disabled = !this.state.hasNextUserPage;
  },

  renderUserCards(){
    const container = document.getElementById('user-details-container');
    if (!container) return;

    const docs = Array.isArray(this.state.userSearchResults)
      ? this.state.userSearchResults
      : [];

    if (!docs.length){
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }

    container.innerHTML = docs.map((doc, idx)=> this.userCardHTML(doc, idx)).join('');
    container.classList.remove('hidden');
    this.wireUserCardButtons();
  },
});
