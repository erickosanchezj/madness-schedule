// scripts/admin/user-cards.js
// User cards: devices, direct push, token prune and the 3-strikes button.
// Per-member actions shown after a search or listing.
// RELEVANT FILES: scripts/admin/users.js, scripts/admin/blacklist.js, functions/index.js

Object.assign(AdminPanel, {

  // ---- USERS: Render tarjeta + cableado ----
  userCardHTML(userDoc, indexBase=0){
    const userData = userDoc.data() || {};
    const tokenEntries = userData.fcmTokens ? Object.entries(userData.fcmTokens) : [];
    const safeName = DOMPurify.sanitize(userData.displayName || 'Usuario sin nombre');
    const safeEmail = DOMPurify.sanitize(userData.email || '');
    const strikesRaw = Number(userData.lateCancellations);
    const strikesCount = Number.isFinite(strikesRaw) ? Math.max(0, strikesRaw) : 0;
    const safeStrikes = DOMPurify.sanitize(String(strikesCount));
    const safeUid = DOMPurify.sanitize(userDoc.id);
    const strikesBtnLabel = strikesCount >= 3 ? 'Ya tiene 3 Strikes' : '3 Strikes';
    const strikesBtnDisabled = strikesCount >= 3 ? ' disabled' : '';
    const strikesBtnClass = strikesCount >= 3
      ? 'bg-zinc-600 text-zinc-300 cursor-not-allowed'
      : 'bg-rose-600 hover:bg-rose-700 text-white';
    const head = `
      <div class="p-4 bg-zinc-700/50 rounded-lg">
        <h4 class="font-bold">${safeName}</h4>
        <p class="text-sm text-zinc-400">${safeEmail}</p>
        <p class="text-xs text-amber-300 mt-1">Strikes: ${safeStrikes} / 3</p>
        <div class="mt-3">
          <button data-action="set-three-strikes" data-user-id="${safeUid}"${strikesBtnDisabled}
                  class="${strikesBtnClass} font-semibold py-2 px-3 rounded-md text-sm">
            ${strikesBtnLabel}
          </button>
        </div>
    `;
    if (!tokenEntries.length){
      return head + `<p class="text-sm text-zinc-400 mt-3">Sin dispositivos registrados.</p></div>`;
    }
    const bodies = tokenEntries.map(([token, rawMeta],i)=>{
      const safeToken = DOMPurify.sanitize(token);
      const displayToken = DOMPurify.sanitize(safeToken.substring(0,30));
      const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : null;

      let registeredAtStr = '';
      if (meta?.registeredAt){
        const dateObj = meta.registeredAt.toDate ? meta.registeredAt.toDate() : new Date(meta.registeredAt);
        if (dateObj instanceof Date && !Number.isNaN(dateObj.getTime())){
          registeredAtStr = new Intl.DateTimeFormat('es-MX',{ dateStyle:'short', timeStyle:'short' }).format(dateObj);
        }
      }

      const metaRows = [];
      if (meta?.userAgent){
        const ua = DOMPurify.sanitize(String(meta.userAgent));
        metaRows.push(`<p class="text-xs text-zinc-400 break-words">UA: ${ua}</p>`);
      }
      if (meta?.platform){
        const platform = DOMPurify.sanitize(String(meta.platform));
        metaRows.push(`<p class="text-xs text-zinc-400">Plataforma: ${platform}</p>`);
      }
      if (registeredAtStr){
        const safeRegistered = DOMPurify.sanitize(registeredAtStr);
        metaRows.push(`<p class="text-xs text-zinc-500">Registrado: ${safeRegistered}</p>`);
      }
      const screenInfo = meta?.screen || meta?.screenResolution;
      if (screenInfo){
        const safeScreen = DOMPurify.sanitize(String(screenInfo));
        metaRows.push(`<p class="text-xs text-zinc-500">Pantalla: ${safeScreen}</p>`);
      }
      if (meta?.timezone){
        const safeTz = DOMPurify.sanitize(String(meta.timezone));
        metaRows.push(`<p class="text-xs text-zinc-500">Zona horaria: ${safeTz}</p>`);
      }
      if (meta?.browser){
        const safeBrowser = DOMPurify.sanitize(String(meta.browser));
        metaRows.push(`<p class="text-xs text-zinc-500">Navegador: ${safeBrowser}</p>`);
      }
      if (meta?.language){
        const safeLang = DOMPurify.sanitize(String(meta.language));
        metaRows.push(`<p class="text-xs text-zinc-500">Idioma: ${safeLang}</p>`);
      }
      if (!metaRows.length){
        metaRows.push('<p class="text-xs text-zinc-500">Sin metadata disponible.</p>');
      }

      return `
      <div class="token-row p-3 bg-zinc-900 rounded-lg border border-zinc-700 mt-3">
        <p class="text-xs text-zinc-400 font-mono break-all">Dispositivo ${i+1}: ${displayToken}...</p>
        <div class="mt-2 space-y-1">${metaRows.join('')}</div>
        <div class="mt-3 space-y-2">
          <input type="text" id="noti-title-${indexBase}_${i}" aria-label="Título de la notificación" class="w-full bg-zinc-700 text-white p-2 rounded-md text-sm" placeholder="Título de la notificación">
          <textarea id="noti-body-${indexBase}_${i}" aria-label="Cuerpo de la notificación" class="w-full bg-zinc-700 text-white p-2 rounded-md text-sm h-16" placeholder="Cuerpo del mensaje"></textarea>
          <div class="flex gap-2">
            <button data-token="${safeToken}" data-index="${indexBase}_${i}" data-uid="${safeUid}"
                    class="send-noti-btn flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-md text-sm">
              Enviar a este Dispositivo
            </button>
            <button data-token="${safeToken}" data-uid="${safeUid}"
                    class="prune-token-btn px-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-md text-sm">
              Prune
            </button>
          </div>
        </div>
      </div>
    `;}).join('');
    return head + `<div class="mt-4 space-y-4">${bodies}</div></div>`;
  },

  wireUserCardButtons(){
    document.querySelectorAll('.send-noti-btn').forEach(btn=>{
      btn.onclick = (event)=> this.sendDirectNotification(event);
    });
    document.querySelectorAll('.prune-token-btn').forEach(btn=>{
      btn.onclick = (event)=> this.pruneTokenManually(event);
    });
    document.querySelectorAll('[data-action="set-three-strikes"]').forEach(btn=>{
      btn.onclick = () => this.setUserToThreeStrikes(btn.dataset.userId);
    });
  },

  async setUserToThreeStrikes(userId){
    if (!userId) return;

    const targetDoc = this.state.userSearchResults.find(doc => doc.id === userId);
    const targetData = targetDoc?.data() || {};
    const userLabel = targetData.displayName || targetData.email || 'este usuario';
    const currentStrikesRaw = Number(targetData.lateCancellations);
    const currentStrikes = Number.isFinite(currentStrikesRaw) ? Math.max(0, currentStrikesRaw) : 0;

    if (currentStrikes >= 3){
      this.showToast({ title:'Sin cambios', message:'Este usuario ya tiene 3 strikes.', variant:'warn' });
      return;
    }

    const confirmed = confirm(`¿Dar 3 strikes a ${userLabel}? El usuario quedará bloqueado para reservar.`);
    if (!confirmed) return;

    try{
      await this.db.collection('users').doc(userId).set({
        lateCancellations: 3,
        blacklisted: true,
        blacklistedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      const refreshedDoc = await this.db.collection('users').doc(userId).get();
      const index = this.state.userSearchResults.findIndex(doc => doc.id === userId);
      if (index !== -1){
        this.state.userSearchResults.splice(index, 1, refreshedDoc);
      }
      this.renderUserCards();

      const blacklistContainer = document.getElementById('blacklisted-users-container');
      if (blacklistContainer && blacklistContainer.innerHTML.trim()){
        await this.listBlacklistedUsers();
      }

      this.showToast({
        title:'3 strikes aplicados',
        message: currentStrikes > 0
          ? `Se agregaron ${3 - currentStrikes} strikes restantes y el usuario quedó bloqueado.`
          : 'El usuario quedó con 3 strikes y fue bloqueado para reservar.'
      });
    }catch(e){
      this.showToast({ title:'No se pudieron aplicar los strikes', message:e.message, variant:'error' });
    }
  },

  // ---- USERS: Envío + AUTOPRUNE ----
  async sendDirectNotification(event){
    const btn = event.target;
    const { token, index, uid } = btn.dataset;
    const title = document.getElementById(`noti-title-${index}`)?.value.trim();
    const body  = document.getElementById(`noti-body-${index}`)?.value.trim();

    if (!title || !body){
      this.showToast({ title:'Faltan datos', message:'El título y el cuerpo son requeridos.', variant:'warn' });
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try{
      if (this.auth.currentUser) await this.auth.currentUser.getIdToken(true);
      const send = this.functions.httpsCallable('sendDirectNotification');
      const result = await send({ token, title, body });

      if (result.data?.success){
        this.showToast({ title:'Notificación enviada', message:'Dispositivo notificado ✅' });
      } else {
        throw new Error(result.data?.error || 'El servidor devolvió un error.');
      }
    }catch(e){
      const msg = String(e?.message || e);
      this.showToast({ title:'Error al enviar', message: msg, variant:'error' });

      // Heurística de token inválido/no registrado
      const looksInvalid = /not[-\s]?registered|unregistered|invalid[-\s]?registration|registration[-\s]?token|mismatch/i.test(msg);
      if (looksInvalid && uid && token){
        const ok = confirm('Este token parece inválido. ¿Quieres eliminarlo del perfil del usuario?');
        if (ok){
          try{
            await this.db.collection('users').doc(uid).set({
              fcmTokens: { [token]: firebase.firestore.FieldValue.delete() }
            }, { merge:true });
            this.showToast({ title:'Token eliminado', message:'Se removió el token inválido.' });
          }catch(pruneErr){
            this.showToast({ title:'No se pudo eliminar token', message: pruneErr.message, variant:'error' });
          }
        }
      }
    }finally{
      btn.disabled = false;
      btn.textContent = 'Enviar a este Dispositivo';
    }
  },

  async pruneTokenManually(event){
    const btn = event.target;
    const { token, uid } = btn.dataset;
    if (!uid || !token) return;
    const ok = confirm('¿Eliminar este token del usuario?');
    if (!ok) return;
    btn.disabled = true;
    try{
      await this.db.collection('users').doc(uid).set({
        fcmTokens: { [token]: firebase.firestore.FieldValue.delete() }
      }, { merge:true });
      this.showToast({ title:'Token eliminado' });
      const freshDoc = await this.db.collection('users').doc(uid).get();
      const idx = this.state.userSearchResults.findIndex(d=>d.id===uid);
      if (idx !== -1) this.state.userSearchResults[idx] = freshDoc;
      const card = btn.closest('.p-4');
      if (card){
        card.outerHTML = this.userCardHTML(freshDoc, idx === -1 ? 0 : idx);
        this.wireUserCardButtons();
      }
    }catch(e){
      this.showToast({ title:'No se pudo eliminar', message:e.message, variant:'error' });
    }finally{
      btn.disabled = false;
    }
  },
});
