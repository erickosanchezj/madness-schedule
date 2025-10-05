// /scripts/admin/layout/panel-blacklist.js
// Blacklist management section
// Generated from admin layout extraction to keep files small
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

export const panelBlacklistHTML = /* html */ `
<section class="mt-8 p-6 bg-zinc-800 rounded-lg" aria-labelledby="blacklist-title">
        <h2 id="blacklist-title" class="text-2xl font-bold mb-2">Gestión de Lista Negra</h2>
        <p class="text-sm text-zinc-400 mb-4">Revisa usuarios bloqueados por cancelaciones tardías y rehabilítalos cuando sea necesario.</p>
        <div class="flex flex-wrap gap-2">
          <button id="list-blacklisted-btn" class="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-md">Listar usuarios en lista negra</button>
        </div>
        <p id="blacklisted-users-feedback" class="text-xs text-zinc-400 mt-3 hidden"></p>
        <div id="blacklisted-users-container" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"></div>
      </section>
`;
