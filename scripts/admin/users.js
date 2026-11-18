// scripts/admin/users.js
// Opens and closes the member detail card, and sends password reset emails.
// The members table (subscriptions.js) is the only member list; this shows one member in detail.
// RELEVANT FILES: scripts/admin/user-cards.js, scripts/admin/subscriptions.js, scripts/admin/views/reports.js

Object.assign(AdminPanel, {

  // ---- Password reset for the member shown in the card ----
  async sendPasswordReset(email){
    if (!email){ this.showToast({ title:'Este usuario no tiene correo', variant:'warn' }); return; }
    if (!confirm(`¿Enviar correo de reinicio de contraseña a ${email}?`)) return;
    try{
      await this.auth.sendPasswordResetEmail(email);
      this.showToast({ title:'Correo enviado', message:`Revisa ${email}` });
    }catch(e){
      this.showToast({ title:'No se pudo enviar', message:e.message, variant:'error' });
    }
  },

  // Shows the detail card for a member from the table.
  // The table already holds the user's data, so this costs no extra Firestore read.
  openMemberCard(userId){
    const user = this.state.subscriptionAllUsers.find(u => u.id === userId);
    if (!user) return;
    const { id, ...data } = user;
    // userCardHTML and the strike/token actions expect a Firestore-like doc: { id, data() }.
    this.state.userSearchResults = [{ id, data: () => data }];
    this.renderUserCards();
    const container = document.getElementById('user-details-container');
    container?.scrollIntoView({ behavior:'smooth', block:'start' });
    container?.querySelector('[data-action="close-member"]')?.focus();
  },

  // Re-reads one member after a change (strikes, unlock) and redraws their open card.
  async refreshOpenMemberCard(userId){
    const fresh = await this.db.collection('users').doc(userId).get();
    const index = this.state.userSearchResults.findIndex(doc => doc.id === userId);
    if (index !== -1) this.state.userSearchResults.splice(index, 1, fresh);
    this.renderUserCards();
  },

  closeMemberCard(){
    this.state.userSearchResults = [];
    this.renderUserCards();
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

    const closeBtn = `
      <div class="flex justify-end">
        <button type="button" data-action="close-member" class="text-sm font-semibold text-indigo-400 hover:text-indigo-300">Cerrar detalle</button>
      </div>`;
    container.innerHTML = closeBtn + docs.map((doc, idx)=> this.userCardHTML(doc, idx)).join('');
    container.classList.remove('hidden');
    this.wireUserCardButtons();
  },
});
