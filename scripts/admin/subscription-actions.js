// scripts/admin/subscription-actions.js
// Row actions of the members table: mark as paid, verify or reject TotalPass, change subscription type.
// Split from subscriptions.js to keep each file under 300 lines; each action asks first with confirmDialog().
// RELEVANT FILES: scripts/admin/subscriptions.js, scripts/admin/confirm-dialog.js, functions/index.js

Object.assign(AdminPanel, {

  async markUserAsPaid(userId){
    const user = this.state.subscriptionAllUsers.find(u => u.id === userId) || {};
    const ok = await this.confirmDialog({
      title: 'Marcar como pagado',
      message: `${user.displayName || user.email || 'Este usuario'} quedará como pagado para el mes actual.`,
      confirmLabel: 'Marcar pagado'
    });
    if (!ok) return;

    try {
      await this.db.collection('users').doc(userId).update({
        subscriptionStatus:'paid',
        subscriptionPaidDate: firebase.firestore.FieldValue.serverTimestamp(),
        subscriptionGraceUntil: firebase.firestore.FieldValue.delete()
      });

      this.showToast({ title:'Usuario actualizado', message:'El usuario ha sido marcado como pagado' });
    } catch (err) {
      this.showToast({ title:'Error', message:err.message, variant:'error' });
    }
  },

  async verifyTotalPass(userId, approve){
    const action = approve ? 'verificar' : 'rechazar';
    const ok = await this.confirmDialog({
      title: approve ? 'Verificar TotalPass' : 'Rechazar TotalPass',
      message: approve
        ? 'El usuario quedará como miembro TotalPass verificado.'
        : 'El usuario pasará a "Por clase" y su marca de TotalPass se quitará.',
      confirmLabel: approve ? 'Verificar' : 'Rechazar',
      danger: !approve
    });
    if (!ok) return;

    try {
      const updates = { totalPassVerified: approve };

      if (approve) {
        // TotalPass users stay in good standing without extra charges.
        updates.totalPass = true;
        updates.subscriptionType = 'totalpass';
        updates.subscriptionStatus = 'totalpass';
        updates.subscriptionGraceUntil = firebase.firestore.FieldValue.delete();
      } else {
        // Reset manual flag so we avoid repeated review requests.
        updates.totalPass = false;
        updates.subscriptionType = 'dropin';
        updates.subscriptionStatus = 'unpaid';
        updates.subscriptionGraceUntil = firebase.firestore.FieldValue.delete();
      }

      await this.db.collection('users').doc(userId).update(updates);

      this.showToast({
        title: approve ? 'TotalPass Verificado' : 'TotalPass Rechazado',
        message: approve ? 'El usuario ha sido verificado como TotalPass' : 'Se ha rechazado el estado TotalPass del usuario'
      });
    } catch (err) {
      this.showToast({ title:'Error', message:err.message, variant:'error' });
    }
  },

  async showSubscriptionTypeModal(userId, selectEl){
    const user = this.state.subscriptionUsers.find(u => u.id === userId);
    if (!user) {
      if (selectEl) selectEl.value = '';
      return;
    }

    if (selectEl && selectEl.value) {
      const newType = selectEl.value;
      const validTypes = ['monthly','totalpass','dropin'];
      if (!validTypes.includes(newType)) {
        this.showToast({ title:'Tipo inválido', message:'Debe ser: monthly, totalpass, o dropin', variant:'error' });
        selectEl.value = '';
        return;
      }

      const labels = {
        monthly:'Mensual',
        totalpass:'TotalPass',
        dropin:'Por Clase'
      };
      const targetLabel = labels[newType] || newType;
      const userLabel = user.displayName || user.email || 'este usuario';

      const confirmed = await this.confirmDialog({
        title: 'Cambiar tipo de suscripción',
        message: `${userLabel} pasará a ${targetLabel}.`,
        confirmLabel: 'Cambiar tipo'
      });
      if (!confirmed) {
        selectEl.value = '';
        return;
      }

      this.db.collection('users').doc(userId).update({ subscriptionType:newType }).then(() => {
        this.showToast({ title:'Tipo actualizado', message:`Tipo de suscripción cambiado a: ${newType}` });
      }).catch(err => {
        this.showToast({ title:'Error', message:err.message, variant:'error' });
      }).finally(() => {
        selectEl.value = '';
      });
      return;
    }
  },
});
