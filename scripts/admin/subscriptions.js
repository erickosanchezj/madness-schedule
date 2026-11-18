// scripts/admin/subscriptions.js
// Members table: one live Firestore listener per filter, in-memory search and row rendering.
// Staff track monthly payments and TotalPass approvals; row buttons call subscription-actions.js.
// RELEVANT FILES: scripts/admin/subscription-actions.js, scripts/admin/views/reports.js, scripts/admin/users.js

Object.assign(AdminPanel, {

  // Opens one live listener for the selected filter.
  // Typing in the search box does NOT call this; see applySubscriptionSearch().
  listenSubscriptionUsers(){
    const filterEl = document.getElementById('subscription-filter');
    const loadingEl = document.getElementById('subscription-loading');
    const tbody = document.getElementById('subscription-users-list');
    const filter = filterEl?.value || 'all';

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
    } else if (filter === 'blacklisted') {
      query = query.where('blacklisted','==',true);
    }

    this.state.unsubSubscriptionUsers = query.onSnapshot(snapshot => {
      this.state.subscriptionAllUsers = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
      this.applySubscriptionSearch();
    }, err => {
      console.error('Error escuchando usuarios', err);
      if (loadingEl) loadingEl.classList.add('hidden');
      this.showToast({ title:'Error', message:err.message, variant:'error' });
    });
  },

  // Filters the users we already have in memory, so typing costs no Firestore reads.
  // normalizeStr drops accents, so "valeria" also finds "Valéria".
  applySubscriptionSearch(){
    const term = this.normalizeStr(document.getElementById('user-search')?.value || '');
    this.state.subscriptionUsers = this.state.subscriptionAllUsers.filter(user => !term
      || this.normalizeStr(user.displayName || '').includes(term)
      || this.normalizeStr(user.email || '').includes(term));
    this.renderSubscriptionUsers();
  },

  renderSubscriptionUsers(){
    const tbody = document.getElementById('subscription-users-list');
    const loading = document.getElementById('subscription-loading');
    if (!tbody) return;

    if (loading) loading.classList.add('hidden');

    if (!this.state.subscriptionUsers.length){
      // Search only looks inside the selected filter, so point staff to "Todos" when it is narrowed.
      const filtered = (document.getElementById('subscription-filter')?.value || 'all') !== 'all';
      const hint = filtered ? ' con este filtro. Elige "Todos los usuarios" para buscar a todos.' : '';
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-zinc-400">No se encontraron usuarios${hint}</td></tr>`;
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
          ? `No pagado (gracia hasta ${safeGraceLabel})`
          : 'No pagado (periodo de gracia)';
        statusClass = 'text-amber-400';
      } else if (subscriptionStatus === 'grace_period') {
        statusDisplay = 'Periodo de gracia';
        statusClass = 'text-amber-400';
      } else if (subscriptionStatus === 'unpaid') {
        statusDisplay = 'No pagado';
        statusClass = 'text-rose-400';
      }

      let actions = '';

      const subscriptionTypeOptions = ['monthly','totalpass','dropin'].map(type => {
        const label = type === 'monthly'
          ? 'Mensual'
          : type === 'totalpass'
            ? 'TotalPass'
            : 'Por clase';
        const disabled = type === subscriptionType ? ' disabled' : '';
        return `<option value="${type}"${disabled}>${label}</option>`;
      }).join('');

      if (subscriptionType === 'monthly' && subscriptionStatus !== 'paid') {
        actions += `<button onclick="AdminPanel.markUserAsPaid('${user.id}')" class="bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-3 rounded mr-2">Marcar como pagado</button>`;
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
          : 'Por clase';

      return `
        <tr>
          <td class="p-3">
            <button type="button" onclick="AdminPanel.openMemberCard('${user.id}')" class="admin-member-link font-medium text-left">${safeName}</button>${user.blacklisted ? ' <span class="admin-blocked-badge">Bloqueado</span>' : ''}
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
});
