/* /admin/js/modules/users.js */
/* User management helpers for the admin panel */
/* Provides password reset and lookup logic extracted from AdminPanel */
/* RELEVANT FILES: admin/js/admin-core.js, admin/js/modules/auth.js, admin/js/utils/ui-helpers.js, admin/index.html */

import { DateHelpers } from '../utils/date-helpers.js';
import { UIHelpers } from '../utils/ui-helpers.js';

export class UserModule {
  constructor(db, auth) {
    this.db = db;
    this.auth = auth;
    this.dateHelpers = new DateHelpers();
  }

  async sendPasswordReset(email) {
    if (!email) {
      UIHelpers.showToast({ title: 'Correo requerido', message: 'Ingresa un correo para enviar el reset.', variant: 'warn' });
      return;
    }

    try {
      await this.auth.sendPasswordResetEmail(email);
      UIHelpers.showToast({ title: 'Correo enviado', message: 'El usuario recibirá instrucciones en su bandeja.' });
    } catch (err) {
      const message = err?.message || 'No pudimos enviar el correo.';
      UIHelpers.showToast({ title: 'Error', message, variant: 'error', timeout: 6000 });
      throw err;
    }
  }

  async findUsersByQuery(query) {
    const cleanQuery = this.dateHelpers.normalizeStr(query);
    if (!cleanQuery) return [];

    const snap = await this.db.collection('users').orderBy('normalizedEmail').startAt(cleanQuery).endAt(`${cleanQuery}\uf8ff`).limit(10).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
