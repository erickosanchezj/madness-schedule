// /scripts/admin/admin-layout.js
// Injects the admin interface markup before bootstrapping behaviour modules
// Keeps admin.html lean while still providing a structured DOM for the app
// RELEVANT FILES: admin.html, scripts/admin/admin-main.js, scripts/admin/layout/panel-view.js

import { toastLoginViewHTML } from './layout/toast-login-view.js';
import { panelViewHTML } from './layout/panel-view.js';
import { modalViewHTML } from './layout/modal-view.js';

export function loadLayout() {
  const root = document.getElementById('app-root');
  if (!root) throw new Error('No se encontró el contenedor #app-root en admin.html');
  root.innerHTML = [toastLoginViewHTML, panelViewHTML, modalViewHTML].join('\n');
}
