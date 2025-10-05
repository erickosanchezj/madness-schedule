// /scripts/admin/admin-auth.js
// Implements admin login/logout flows with Cloudflare Turnstile verification
// Keeps authentication helpers modular so bootstrap logic stays clean
// RELEVANT FILES: scripts/admin/admin-bootstrap.js, firebase-config.js, functions/index.js

import { AdminPanel } from './admin-state.js';

AdminPanel.login = function login() {
  const turnstileToken = turnstile.getResponse();
  const email = document.getElementById('email-input').value.trim();
  const pass = document.getElementById('password-input').value;
  const errEl = document.getElementById('error-message');
  errEl.classList.add('hidden');
  if (!turnstileToken) {
    errEl.textContent = 'Por favor, completa la verificación de seguridad.';
    errEl.classList.remove('hidden');
    return;
  }
  this.auth.signInWithEmailAndPassword(email, pass).catch((err) => {
    errEl.textContent = `Error: ${err.message}`;
    errEl.classList.remove('hidden');
    turnstile.reset();
  });
};

AdminPanel.logout = function logout() {
  this.stopCurrentTimeTicker();
  this.auth.signOut();
  this.showToast({ title: 'Sesión cerrada' });
};
