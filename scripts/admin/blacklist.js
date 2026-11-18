// scripts/admin/blacklist.js
// Blacklist actions: unlock one member, or reset everyone's strikes (danger zone).
// Blocked members stay blocked until staff unlock them; find them with the "En lista negra" filter.
// RELEVANT FILES: functions/index.js, scripts/admin/user-cards.js, scripts/admin/confirm-dialog.js

Object.assign(AdminPanel, {

  async whitelistUser(userId){
    if (!userId) return;
    try{
      await this.db.collection('users').doc(userId).set({
        blacklisted: false,
        lateCancellations: 0,
        blacklistedAt: firebase.firestore.FieldValue.delete()
      }, { merge:true });
      this.showToast({ title:'Usuario rehabilitado', message:'El usuario ya puede reservar de nuevo.' });
      await this.refreshOpenMemberCard(userId);
    }catch(e){
      this.showToast({ title:'No se pudo rehabilitar', message:e.message, variant:'error' });
    }
  },

  async resetAllStrikesForEveryone(){
    const btn = document.getElementById('reset-strikes-btn');
    // Typing RESET makes an accidental global reset very unlikely.
    const confirmed = await this.confirmDialog({
      title: 'Resetear strikes de todos',
      message: 'Pone en 0 los strikes de todos los miembros y desbloquea a todos los que están en lista negra. No se puede deshacer.',
      confirmLabel: 'Resetear todo',
      danger: true,
      requireText: 'RESET'
    });
    if (!confirmed) return;

    const originalText = btn ? btn.textContent : '';
    if (btn){
      btn.disabled = true;
      btn.textContent = 'Reiniciando…';
    }

    try{
      if (this.auth.currentUser){
        await this.auth.currentUser.getIdToken(true);
      }

      const callable = this.functions.httpsCallable('resetAllStrikes');
      const result = await callable();
      const updated = Number(result?.data?.updated || 0);
      const totalTargets = Number(result?.data?.totalTargets || 0);

      const message = totalTargets > 0
        ? `Se reiniciaron los strikes de ${updated} usuarios.`
        : 'No había strikes pendientes por reiniciar.';

      this.showToast({ title:'Strikes reiniciados', message });
    }catch(e){
      const message = e?.message || 'No se pudo reiniciar los strikes.';
      this.showToast({ title:'Error', message, variant:'error' });
    }finally{
      if (btn){
        btn.disabled = false;
        btn.textContent = originalText || 'Resetear strikes (todos)';
      }
    }
  },
});
