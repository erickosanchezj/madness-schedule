// /scripts/admin/layout/panel-notifications.js
// Recent notifications feed section
// Generated from admin layout extraction to keep files small
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

export const panelNotificationsHTML = /* html */ `
<section class="mt-8 p-6 bg-zinc-800 rounded-lg" aria-labelledby="notifs-title">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 id="notifs-title" class="text-2xl font-bold">Últimas 10 notificaciones</h2>
          <button
            type="button"
            class="toggle-section inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            data-toggle-target="recent-notifs"
            data-expanded-label="Colapsar"
            data-collapsed-label="Expandir"
            aria-controls="recent-notifs"
            aria-expanded="false"
          >
            <span data-toggle-label>Expandir</span>
          </button>
        </div>
        <ul id="recent-notifs" class="space-y-2 text-sm hidden"></ul>
      </section>
`;
