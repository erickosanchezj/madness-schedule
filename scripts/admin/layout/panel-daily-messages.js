// /scripts/admin/layout/panel-daily-messages.js
// Daily message management form
// Generated from admin layout extraction to keep files small
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

export const panelDailyMessagesHTML = /* html */ `
<section class="mt-8 p-6 bg-zinc-800 rounded-lg" aria-labelledby="daily-message-title">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 id="daily-message-title" class="text-2xl font-bold">Mensaje del Día</h2>
        </div>
        <form id="daily-message-form" class="space-y-4">
          <input type="hidden" id="daily-message-id">
          <div>
            <label for="daily-message-text" class="block text-sm font-medium text-zinc-300 mb-2">Mensaje para los alumnos</label>
            <textarea id="daily-message-text" class="w-full bg-zinc-700 text-white p-3 rounded-md h-28" placeholder="Ej: Está lloviendo hoy, maneja con cuidado." required></textarea>
            <p id="daily-message-form-status" class="text-xs text-indigo-300 mt-2 hidden"></p>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" id="daily-message-active" class="w-4 h-4 accent-indigo-600" checked>
            Mostrar mensaje en la app
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="submit" id="daily-message-submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">Guardar Mensaje</button>
            <button type="button" id="daily-message-reset" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md">Limpiar</button>
          </div>
        </form>
        <div id="daily-messages-list" class="mt-6 space-y-4 text-sm"></div>
      </section>
`;
