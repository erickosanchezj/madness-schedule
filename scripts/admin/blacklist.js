// scripts/admin/blacklist.js
// Blacklist: list blocked members, unlock one, or reset all strikes.
// Blocked members stay blocked until staff unlock them here.
// RELEVANT FILES: functions/index.js, scripts/admin/user-cards.js, scripts/admin/init.js

Object.assign(AdminPanel, {

  // ---- USERS: Lista negra ----
  async listBlacklistedUsers(){
    const container = document.getElementById('blacklisted-users-container');
    const feedback = document.getElementById('blacklisted-users-feedback');
    if (!container) return;

    const loadingHtml = Array(3).fill(0).map(() => `
  <div class="p-4 bg-zinc-700/50 rounded-lg border border-zinc-600/50 animate-pulse">
    <div class="h-5 bg-zinc-600/50 rounded w-3/4 mb-2"></div>
    <div class="h-4 bg-zinc-600/50 rounded w-1/2"></div>
  </div>
`).join('');
    container.innerHTML = loadingHtml;
    if (feedback){
      feedback.textContent = 'Cargando usuarios bloqueados…';
      feedback.classList.remove('hidden');
    }

    try{
      const snap = await this.db.collection('users').where('blacklisted','==',true).get();
      if (snap.empty){
        container.innerHTML = '<div class="p-4 bg-zinc-900 rounded-lg text-sm text-zinc-400">No hay usuarios en lista negra.</div>';
        if (feedback){
          feedback.textContent = 'Sin usuarios bloqueados.';
          feedback.classList.remove('hidden');
        }
        this.state.blacklistedUsers = [];
        return;
      }

      this.state.blacklistedUsers = snap.docs;
      container.innerHTML = snap.docs.map(doc => this.blacklistCardHTML(doc)).join('');
      if (feedback){
        feedback.textContent = `Usuarios bloqueados: ${snap.size}`;
        feedback.classList.remove('hidden');
      }
      this.wireBlacklistButtons();
    }catch(e){
      container.innerHTML = '<div class="p-4 bg-zinc-900 rounded-lg text-sm text-rose-400">No se pudo cargar la lista negra.</div>';
      if (feedback){
        feedback.textContent = 'Error al cargar la lista negra.';
        feedback.classList.remove('hidden');
      }
      this.showToast({ title:'Error al listar lista negra', message:e.message, variant:'error' });
    }
  },

  blacklistCardHTML(userDoc){
    const data = userDoc.data() || {};
    const safeName = DOMPurify.sanitize(data.displayName || 'Usuario sin nombre');
    const safeEmail = DOMPurify.sanitize(data.email || 'Sin correo');
    const strikesRaw = Number(data.lateCancellations);
    const strikes = Number.isFinite(strikesRaw) ? Math.max(0, strikesRaw) : 0;
    const safeStrikes = DOMPurify.sanitize(String(strikes));
    let formattedDate = 'Sin fecha registrada';
    const rawDate = data.blacklistedAt;
    let dateObj = null;
    if (rawDate?.toDate) dateObj = rawDate.toDate();
    else if (rawDate instanceof Date) dateObj = rawDate;
    if (dateObj instanceof Date && !Number.isNaN(dateObj.getTime())){
      formattedDate = new Intl.DateTimeFormat('es-MX',{ dateStyle:'medium', timeStyle:'short', timeZone:'America/Mexico_City' }).format(dateObj);
    }
    const safeDate = DOMPurify.sanitize(formattedDate);
    const safeUid = DOMPurify.sanitize(userDoc.id);
    return `
      <div class="p-4 bg-zinc-700/50 rounded-lg border border-zinc-600/50 space-y-2" data-user-card="${safeUid}">
        <div>
          <h3 class="text-lg font-semibold">${safeName}</h3>
          <p class="text-sm text-zinc-300">${safeEmail}</p>
        </div>
        <p class="text-sm text-zinc-400">Strikes: ${safeStrikes} / 3</p>
        <p class="text-xs text-zinc-500">Fecha de bloqueo: ${safeDate}</p>
        <button data-action="whitelist-user" data-user-id="${safeUid}" class="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-md text-sm">Rehabilitar Usuario</button>
      </div>`;
  },

  wireBlacklistButtons(){
    document.querySelectorAll('[data-action="whitelist-user"]').forEach(btn=>{
      btn.onclick = () => this.whitelistUser(btn.dataset.userId);
    });
  },

  async whitelistUser(userId){
    if (!userId) return;
    try{
      await this.db.collection('users').doc(userId).set({
        blacklisted: false,
        lateCancellations: 0,
        blacklistedAt: firebase.firestore.FieldValue.delete()
      }, { merge:true });
      this.showToast({ title:'Usuario rehabilitado', message:'El usuario ya puede reservar de nuevo.' });
      await this.listBlacklistedUsers();
    }catch(e){
      this.showToast({ title:'No se pudo rehabilitar', message:e.message, variant:'error' });
    }
  },

  async resetAllStrikesForEveryone(){
    const btn = document.getElementById('reset-strikes-btn');
    // Ask for confirmation to avoid accidental global resets.
    const confirmed = confirm('Esto reiniciará todos los strikes y desbloqueará a cualquiera en lista negra. ¿Continuar?');
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
      await this.listBlacklistedUsers();
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
