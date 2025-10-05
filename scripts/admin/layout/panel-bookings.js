// /scripts/admin/layout/panel-bookings.js
// Bookings summary list for each week day
// Generated from admin layout extraction to keep files small
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

export const panelBookingsHTML = /* html */ `
<section class="mt-8 p-6 bg-zinc-800 rounded-lg" aria-labelledby="reservas-title">
        <h2 id="reservas-title" class="text-2xl font-bold mb-4">Reservas de la Semana</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
          <div class="day-column" data-day="monday">
            <h3 class="text-lg font-semibold text-emerald-400 mb-3 border-b border-zinc-700 pb-2">Lunes</h3>
            <div id="monday-bookings-list" class="space-y-4 text-sm"></div>
          </div>
          <div class="day-column" data-day="tuesday">
            <h3 class="text-lg font-semibold text-emerald-400 mb-3 border-b border-zinc-700 pb-2">Martes</h3>
            <div id="tuesday-bookings-list" class="space-y-4 text-sm"></div>
          </div>
          <div class="day-column" data-day="wednesday">
            <h3 class="text-lg font-semibold text-emerald-400 mb-3 border-b border-zinc-700 pb-2">Miércoles</h3>
            <div id="wednesday-bookings-list" class="space-y-4 text-sm"></div>
          </div>
          <div class="day-column" data-day="thursday">
            <h3 class="text-lg font-semibold text-emerald-400 mb-3 border-b border-zinc-700 pb-2">Jueves</h3>
            <div id="thursday-bookings-list" class="space-y-4 text-sm"></div>
          </div>
          <div class="day-column" data-day="friday">
            <h3 class="text-lg font-semibold text-emerald-400 mb-3 border-b border-zinc-700 pb-2">Viernes</h3>
            <div id="friday-bookings-list" class="space-y-4 text-sm"></div>
          </div>
          <div class="day-column" data-day="saturday">
            <h3 class="text-lg font-semibold text-emerald-400 mb-3 border-b border-zinc-700 pb-2">Sábado</h3>
            <div id="saturday-bookings-list" class="space-y-4 text-sm"></div>
          </div>
          <div class="day-column" data-day="sunday">
            <h3 class="text-lg font-semibold text-emerald-400 mb-3 border-b border-zinc-700 pb-2">Domingo</h3>
            <div id="sunday-bookings-list" class="space-y-4 text-sm"></div>
          </div>
        </div>
      </section>
`;
