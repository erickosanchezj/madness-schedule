// scripts/admin/subscriptions.js
// Subscription table: live list, paid status, TotalPass review and type changes.
// Staff track monthly payments and TotalPass approvals.
// RELEVANT FILES: scripts/admin/views/reports.js, scripts/admin/users.js, functions/index.js

Object.assign(AdminPanel, {

  listenSubscriptionUsers(){
    const filterEl = document.getElementById('subscription-filter');
    const searchEl = document.getElementById('user-search');
    const loadingEl = document.getElementById('subscription-loading');
    const tbody = document.getElementById('subscription-users-list');
    const filter = filterEl?.value || 'all';
    const searchTerm = (searchEl?.value || '').toLowerCase();

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';

    if (this.state.unsubSubscriptionUsers){
      // Close previous listener so we do not leak real-time subscriptions.
      try { this.state.unsubSubscriptionUsers(); } catch(e) { console.error('No se pudo cerrar snapshot', e); }
    }

    let query = this.db.collection('users');

    if (filter === 'monthly') {
      query = query.where('subscriptionType','==','monthly');
    } else if (filter === 'monthly-unpaid') {
      query = query.where('subscriptionType','==','monthly')
        .where('subscriptionStatus','==','unpaid');
    } else if (filter === 'totalpass-pending') {
      query = query.where('totalPass','==',true).where('totalPassVerified','==',false);
    } else if (filter === 'unpaid') {
      query = query.where('subscriptionStatus','==','unpaid');
    }

    this.state.unsubSubscriptionUsers = query.onSnapshot(snapshot => {
      this.state.subscriptionUsers = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));

      if (searchTerm) {
        this.state.subscriptionUsers = this.state.subscriptionUsers.filter(user => {
          const name = (user.displayName || '').toLowerCase();
          const email = (user.email || '').toLowerCase();
          return name.includes(searchTerm) || email.includes(searchTerm);
        });
      }

      this.renderSubscriptionUsers();
    }, err => {
      console.error('Error escuchando usuarios', err);
      if (loadingEl) loadingEl.classList.add('hidden');
      this.showToast({ title:'Error', message:err.message, variant:'error' });
    });
  },

  renderSubscriptionUsers(){
    const tbody = document.getElementById('subscription-users-list');
    const loading = document.getElementById('subscription-loading');
    if (!tbody) return;

    if (loading) loading.classList.add('hidden');

    if (!this.state.subscriptionUsers.length){
      tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-zinc-400">No se encontraron usuarios</td></tr>';
      return;
    }

    tbody.innerHTML = this.state.subscriptionUsers.map(user => {
      const subscriptionType = user.subscriptionType || 'dropin';
      const totalPassSelfMarked = user.totalPass === true;
      const totalPassVerified = user.totalPassVerified === true;
      const subscriptionStatus = user.subscriptionStatus || 'unpaid';
      const paidRaw = user.subscriptionPaidDate;
      let paidDate = 'Nunca';
      let paidDateObj = null;
      if (paidRaw?.toDate) {
        paidDateObj = paidRaw.toDate();
      } else if (paidRaw instanceof Date && !Number.isNaN(paidRaw.getTime())) {
        paidDateObj = paidRaw;
      } else if (paidRaw) {
        const parsed = new Date(paidRaw);
        if (!Number.isNaN(parsed.getTime())) {
          paidDateObj = parsed;
        }
      }
      if (paidDateObj) {
        paidDate = this.fullDateFmt.format(paidDateObj);
      }
      // Compute five-day grace details so admins can see who is still within the window.
      const graceRaw = user.subscriptionGraceUntil;
      let graceUntil = null;
      if (graceRaw?.toDate) {
        graceUntil = graceRaw.toDate();
      } else if (graceRaw instanceof Date && !Number.isNaN(graceRaw.getTime())) {
        graceUntil = graceRaw;
      } else if (graceRaw) {
        const parsedGrace = new Date(graceRaw);
        if (!Number.isNaN(parsedGrace.getTime())) {
          graceUntil = parsedGrace;
        }
      }
      let graceLabel = '';
      let graceActive = false;
      if (graceUntil instanceof Date && !Number.isNaN(graceUntil.getTime())) {
        graceLabel = this.dayShortFmt.format(graceUntil);
        graceActive = graceUntil.getTime() > Date.now();
      }
      const safeGraceLabel = graceLabel ? DOMPurify.sanitize(graceLabel) : '';
      const safeName = DOMPurify.sanitize(user.displayName || 'Sin nombre');
      const safeEmail = DOMPurify.sanitize(user.email || '');

      let totalPassDisplay = 'No';
      let totalPassClass = 'text-zinc-400';
      if (totalPassVerified) {
        totalPassDisplay = '✓ Verificado';
        totalPassClass = 'text-green-400';
      } else if (totalPassSelfMarked) {
        totalPassDisplay = '⚠ Pendiente';
        totalPassClass = 'text-amber-400';
      }

      let statusDisplay = subscriptionStatus;
      let statusClass = 'text-zinc-400';
      if (subscriptionType === 'totalpass') {
        statusDisplay = 'TotalPass';
        statusClass = 'text-purple-400';
      } else if (subscriptionStatus === 'paid') {
        statusDisplay = 'Pagado';
        statusClass = 'text-green-400';
      } else if (graceActive) {
        statusDisplay = safeGraceLabel
          ? `No Pagado (Gracia hasta ${safeGraceLabel})`
          : 'No Pagado (Período de Gracia)';
        statusClass = 'text-amber-400';
      } else if (subscriptionStatus === 'grace_period') {
        statusDisplay = 'Período de Gracia';
        statusClass = 'text-amber-400';
      } else if (subscriptionStatus === 'unpaid') {
        statusDisplay = 'No Pagado';
        statusClass = 'text-rose-400';
      }

      let actions = '';

      const subscriptionTypeOptions = ['monthly','totalpass','dropin'].map(type => {
        const label = type === 'monthly'
          ? 'Mensual'
          : type === 'totalpass'
            ? 'TotalPass'
            : 'Por Clase';
        const disabled = type === subscriptionType ? ' disabled' : '';
        return `<option value="${type}"${disabled}>${label}</option>`;
      }).join('');

      if (subscriptionType === 'monthly' && subscriptionStatus !== 'paid') {
        actions += `<button onclick="AdminPanel.markUserAsPaid('${user.id}')" class="bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-3 rounded mr-2">Marcar como Pagado</button>`;
      }

      if (totalPassSelfMarked && !totalPassVerified) {
        actions += `<button onclick="AdminPanel.verifyTotalPass('${user.id}', true)" class="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-3 rounded mr-2">Verificar TotalPass</button>`;
        actions += `<button onclick="AdminPanel.verifyTotalPass('${user.id}', false)" class="bg-rose-600 hover:bg-rose-700 text-white text-xs py-1 px-3 rounded">Rechazar</button>`;
      }

      actions += `
        <select data-subscription-select="${user.id}" onchange="AdminPanel.showSubscriptionTypeModal('${user.id}', this)" class="bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-1 px-2 rounded ml-2">
          <option value="" selected disabled>Cambiar tipo</option>
          ${subscriptionTypeOptions}
        </select>`;

      const typeBadge = subscriptionType === 'monthly'
        ? 'bg-blue-600'
        : subscriptionType === 'totalpass'
          ? 'bg-purple-600'
          : 'bg-zinc-600';

      const typeLabel = subscriptionType === 'monthly'
        ? 'Mensual'
        : subscriptionType === 'totalpass'
          ? 'TotalPass'
          : 'Por Clase';

      return `
        <tr>
          <td class="p-3">
            <div class="font-medium">${safeName}</div>
            <div class="text-xs text-zinc-400">${safeEmail}</div>
          </td>
          <td class="p-3">
            <span class="px-2 py-1 rounded text-xs ${typeBadge}">${typeLabel}</span>
          </td>
          <td class="p-3 ${totalPassClass}">${totalPassDisplay}</td>
          <td class="p-3 ${statusClass}">${statusDisplay}</td>
          <td class="p-3 text-zinc-400">${paidDate}</td>
          <td class="p-3">${actions}</td>
        </tr>
      `;
    }).join('');

    lucide.createIcons({ attrs:{ 'aria-hidden':'true' } });
  },

  async markUserAsPaid(userId){
    if (!confirm('¿Marcar a este usuario como pagado para el mes actual?')) return;

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
    if (!confirm(`¿Confirmar ${action} el estado TotalPass de este usuario?`)) return;

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

  showSubscriptionTypeModal(userId, selectEl){
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

      const confirmed = confirm(`¿Cambiar tipo de suscripción de ${userLabel} a ${targetLabel}?`);
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
