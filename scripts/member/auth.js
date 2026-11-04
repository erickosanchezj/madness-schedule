// scripts/member/auth.js
// Sign-in gate and the login/registration screen.
// Creates the profile on first sign-in and switches between auth and app views.
// RELEVANT FILES: scripts/member/main.js, scripts/member/listeners.js, scripts/member/push.js

// Listens for sign-in/sign-out. Started by main.js after Firestore persistence is on.
function startAuthGate(){
  auth.onAuthStateChanged(async user => {
    loadingSpinner.classList.remove('hidden');
    if (user) {
      // Crea doc de usuario si no existe
      const userRef = db.collection('users').doc(user.uid);
      const docSnap = await userRef.get();
      const existingData = docSnap.exists ? docSnap.data() : {};
      applyUserData(existingData);

      if (!docSnap.exists){
        try{
          await userRef.set({
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            subscriptionType: 'monthly',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }catch(e){
          console.error('Error creando perfil:', e);
          alert('Hubo un problema al configurar tu perfil. Intenta de nuevo.');
          auth.signOut();
          return;
        }
      }
      state.currentUser = user;
      authContainer.style.display = 'none';
      appContainer.style.display = 'flex';

      // Push setup is independent of agenda loading; it registers the SW when needed.
      void ensureFreshFcmToken(user.uid).then(() => {
        if (state.currentUser?.uid === user.uid && state.currentScreen === 'profile') scheduleRender();
      }).catch(e => console.warn('FCM token refresh failed:', e?.message||e));
      // También al volver a la pestaña (una vez)
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && auth.currentUser) {
          try { await ensureFreshFcmToken(auth.currentUser.uid); } catch {}
        }
      }, { once:true });
      if (!resumeRefreshHandlersAttached) {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') refreshAgendaListenersOnResume();
        });
        window.addEventListener('pageshow', refreshAgendaListenersOnResume);
        window.addEventListener('focus', refreshAgendaListenersOnResume);
        resumeRefreshHandlersAttached = true;
      }

      if (AGENDA_SCREENS.includes(state.currentScreen)) {
        lastAgendaResumeRefreshAt = Date.now();
        attachAgendaListeners();
      }
      scheduleRender();
    } else {
      state.currentUser = null;
      detachListeners();
      appContainer.style.display = 'none';
      authContainer.style.display = 'flex';
      renderAuthScreen();
    }
    loadingSpinner.classList.add('hidden');
  });
}

// ---- Auth gate

// ---- UI (auth / render / acciones) — *tu lógica original con mínimos cambios* ----
function renderAuthScreen(isLogin=true){
  authContainer.innerHTML = `
    <div class="auth-panel w-full max-w-md mx-auto">
      <img class="auth-mark" src="./images/icon-192x192.png" alt="" width="64" height="64">
      <h1 class="text-4xl font-bold text-white mb-2 heading-display">Madness - Reserva de clases</h1>
      <p class="text-zinc-400 mb-8">${isLogin ? 'Inicia sesión para continuar' : 'Crea una cuenta para empezar'}</p>
      <div class="space-y-4">
        <label class="field-label" for="email-input">Correo electrónico</label>
        <input autocomplete="email" inputmode="email" type="email" id="email-input" placeholder="Correo electrónico" class="w-full bg-zinc-800 text-white p-3 rounded-md border border-zinc-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        <label class="field-label" for="password-input">Contraseña</label>
        <input autocomplete="${isLogin ? 'current-password' : 'new-password'}" type="password" id="password-input" placeholder="Contraseña" class="w-full bg-zinc-800 text-white p-3 rounded-md border border-zinc-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        
        <div id="turnstile-widget"></div>

      </div>
      <button id="auth-button" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md mt-6">${isLogin ? 'Iniciar Sesión' : 'Registrarse'}</button>
      <p class="text-center text-zinc-400 mt-6">
        ${isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
        <a id="auth-toggle" href="#" class="font-semibold text-indigo-400 hover:underline">${isLogin ? 'Regístrate' : 'Inicia Sesión'}</a>
      </p>
    </div>`;
  
    // 2. ADDED: Manually render the widget after the HTML is on the page
    const authButton = document.getElementById('auth-button');
    const widgetContainer = document.getElementById('turnstile-widget');

    // Disable the button until Turnstile is fully ready to avoid ReferenceErrors on slow networks
    authButton.disabled = true;

    const enableAuthButton = () => { authButton.disabled = false; };

    const renderTurnstileWhenReady = () => {
      if (!widgetContainer || widgetContainer.dataset.rendered === '1'){
        enableAuthButton();
        return;
      }

      const api = window.turnstile;
      if (api?.render){
        api.render(widgetContainer, {
          sitekey: '0x4AAAAAABwCDMFGoF_Z-wjY'
        });
        widgetContainer.dataset.rendered = '1';
        enableAuthButton();
        return;
      }

      // Retry shortly after to give the async script time to load before enabling auth
      setTimeout(renderTurnstileWhenReady, 250);
    };

    renderTurnstileWhenReady();

    authButton.onclick = () => app.handleAuth(isLogin);
    document.getElementById('auth-toggle').onclick = (e)=>{ e.preventDefault(); renderAuthScreen(!isLogin); };
    lucide.createIcons();
  }
