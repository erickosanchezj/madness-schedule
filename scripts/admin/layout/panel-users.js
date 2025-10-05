// /scripts/admin/layout/panel-users.js
// User management search tools
// Generated from admin layout extraction to keep files small
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

export const panelUsersHTML = /* html */ `
<section class="mt-8 p-6 bg-zinc-800 rounded-lg" aria-labelledby="usuarios-title">
        <h2 id="usuarios-title" class="text-2xl font-bold mb-4">Gestión de Usuarios</h2>

        <div>
          <label for="user-email-input" class="block text-sm font-medium text-zinc-300 mb-2">Reinicio de Contraseña</label>
          <div class="flex gap-2">
            <input type="email" id="user-email-input" class="flex-1 bg-zinc-700 text-white p-2 rounded-md" placeholder="Correo del usuario">
            <button id="send-reset-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Enviar</button>
          </div>
        </div>

        <hr class="border-zinc-700 my-6">

        <!-- Buscar por nombre/correo + listar -->
        <div>
          <label for="find-user-query-input" class="block text-sm font-medium text-zinc-300 mb-2">
            Buscar usuario (nombre o correo)
          </label>
          <div class="flex gap-2">
            <input type="text" id="find-user-query-input" class="flex-1 bg-zinc-700 text-white p-2 rounded-md"
                   placeholder="Ej: Valery, Erick o alguien@correo.com">
            <button id="find-user-btn" class="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md">Buscar</button>
            <button id="list-users-btn" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md">Listar</button>
          </div>

          <p id="user-results-hint" class="text-zinc-400 text-xs mt-2 hidden"></p>
          <div id="user-details-container" class="mt-4 hidden space-y-4"></div>
        </div>
      </section>
`;
