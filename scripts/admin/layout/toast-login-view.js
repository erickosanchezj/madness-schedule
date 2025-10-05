// /scripts/admin/layout/toast-login-view.js
// Initial toast container and login screen markup for the admin app
// Injected dynamically so admin.html stays compact
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-bootstrap.js

export const toastLoginViewHTML = /* html */ `
<div id="toast-container" class="fixed top-4 left-1/2 -translate-x-1/2 z-[60] space-y-2" aria-live="polite" aria-atomic="true"></div>

    <div id="login-screen" class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-zinc-800 p-8 rounded-lg shadow-lg w-full max-w-sm">
        <h1 class="text-2xl font-bold text-center mb-6">Acceso de Administrador</h1>
        <input type="email" id="email-input" class="w-full bg-zinc-700 text-white p-3 rounded-md mb-4" placeholder="Correo de Admin" autocomplete="email">
        <input type="password" id="password-input" class="w-full bg-zinc-700 text-white p-3 rounded-md mb-4" placeholder="Contraseña" autocomplete="current-password">
        <div class="cf-turnstile mb-4" data-sitekey="0x4AAAAAABwCDMFGoF_Z-wjY"></div>
        <button id="login-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md">Entrar</button>
        <p id="error-message" class="text-rose-400 text-center mt-4 hidden"></p>
      </div>
    </div>

    
`;
