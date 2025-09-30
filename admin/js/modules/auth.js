/* /admin/js/modules/auth.js */
/* Handles Firebase authentication for the admin area */
/* Splits auth logic from the monolithic legacy AdminPanel */
/* RELEVANT FILES: admin/js/admin-core.js, admin/js/utils/firebase-config.js, admin/index.html, admin/js/modules/users.js */

import { firebaseConfig } from '../utils/firebase-config.js';
import { UIHelpers } from '../utils/ui-helpers.js';

export class AuthModule {
  constructor() {
    this.auth = null;
    this.turnstileToken = null;
  }

  async init() {
    if (!window.firebase) {
      throw new Error('Firebase SDK no encontrado');
    }

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }

    this.auth = window.firebase.auth();
    return this.auth;
  }

  async login(email, password) {
    if (!this.auth) await this.init();
    if (!email || !password) {
      throw new Error('Correo y contraseña son obligatorios');
    }

    try {
      await this.auth.signInWithEmailAndPassword(email, password);
      UIHelpers.showToast({ title: 'Bienvenido', message: 'Sesión iniciada correctamente.' });
    } catch (err) {
      const message = err?.message || 'No pudimos iniciar sesión.';
      UIHelpers.showToast({ title: 'Error de acceso', message, variant: 'error', timeout: 5000 });
      throw err;
    }
  }

  async logout() {
    if (!this.auth) return;
    await this.auth.signOut();
    UIHelpers.showToast({ title: 'Sesión cerrada', message: 'Vuelve pronto.' });
  }

  onAuthStateChanged(callback) {
    if (!this.auth) return () => {};
    return this.auth.onAuthStateChanged(callback);
  }
}
