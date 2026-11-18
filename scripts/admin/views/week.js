// scripts/admin/views/week.js
// Markup for "Clases de la Semana" and "Reservas de la Semana".
// Moved out of admin.html to keep it short; inserted before AdminPanel starts.
// RELEVANT FILES: admin.html, scripts/admin/calendar.js, scripts/admin/weekly-bookings.js

// Replaces the placeholder in admin.html (inside the "Semana" tab).
document.querySelector('[data-view="week"]').outerHTML = `
      <div class="space-y-6">
        <section class="admin-card" aria-labelledby="week-title">
          <h2 id="week-title" class="admin-card-title">Clases de la semana</h2>
          <div class="calendar-container space-y-4">
            <div class="overflow-x-auto pb-2">
              <div class="lg:min-w-[960px] space-y-2">
                <div class="calendar-header text-xs font-semibold normal-case text-zinc-400">
                  <div class="text-right pr-2">Hora</div>
                  <div class="day-label">Lunes</div>
                  <div class="day-label">Martes</div>
                  <div class="day-label">Miércoles</div>
                  <div class="day-label">Jueves</div>
                  <div class="day-label">Viernes</div>
                  <div class="day-label">Sábado</div>
                  <div class="day-label">Domingo</div>
                </div>
                <div class="calendar-grid">
                  <div class="time-column">
                    <div class="time-slot">06:00</div>
                    <div class="time-slot">07:00</div>
                    <div class="time-slot">08:00</div>
                    <div class="time-slot">09:00</div>
                    <div class="time-slot">10:00</div>
                    <div class="time-slot">11:00</div>
                    <div class="time-slot">12:00</div>
                    <div class="time-slot">13:00</div>
                    <div class="time-slot">14:00</div>
                    <div class="time-slot">15:00</div>
                    <div class="time-slot">16:00</div>
                    <div class="time-slot">17:00</div>
                    <div class="time-slot">18:00</div>
                    <div class="time-slot">19:00</div>
                    <div class="time-slot">20:00</div>
                    <div class="time-slot">21:00</div>
                    <div class="time-slot">22:00</div>
                  </div>
                  <div id="monday-grid" class="day-grid" data-day-index="1" aria-label="Clases del lunes"></div>
                  <div id="tuesday-grid" class="day-grid" data-day-index="2" aria-label="Clases del martes"></div>
                  <div id="wednesday-grid" class="day-grid" data-day-index="3" aria-label="Clases del miércoles"></div>
                  <div id="thursday-grid" class="day-grid" data-day-index="4" aria-label="Clases del jueves"></div>
                  <div id="friday-grid" class="day-grid" data-day-index="5" aria-label="Clases del viernes"></div>
                  <div id="saturday-grid" class="day-grid" data-day-index="6" aria-label="Clases del sábado"></div>
                  <div id="sunday-grid" class="day-grid" data-day-index="0" aria-label="Clases del domingo"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="admin-card" aria-labelledby="reservas-title">
        <h2 id="reservas-title" class="admin-card-title">Reservas de la semana</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <details class="day-column group" data-day="monday">
            <summary class="flex items-center justify-between font-semibold mb-3 border-b border-zinc-700 pb-2 cursor-pointer select-none">
              <span>Lunes</span>
              <span class="toggle-indicator text-sm text-zinc-400" aria-hidden="true">&#9662;</span>
            </summary>
            <div id="monday-bookings-list" class="space-y-4 text-sm pt-2"></div>
          </details>
          <details class="day-column group" data-day="tuesday">
            <summary class="flex items-center justify-between font-semibold mb-3 border-b border-zinc-700 pb-2 cursor-pointer select-none">
              <span>Martes</span>
              <span class="toggle-indicator text-sm text-zinc-400" aria-hidden="true">&#9662;</span>
            </summary>
            <div id="tuesday-bookings-list" class="space-y-4 text-sm pt-2"></div>
          </details>
          <details class="day-column group" data-day="wednesday">
            <summary class="flex items-center justify-between font-semibold mb-3 border-b border-zinc-700 pb-2 cursor-pointer select-none">
              <span>Miércoles</span>
              <span class="toggle-indicator text-sm text-zinc-400" aria-hidden="true">&#9662;</span>
            </summary>
            <div id="wednesday-bookings-list" class="space-y-4 text-sm pt-2"></div>
          </details>
          <details class="day-column group" data-day="thursday">
            <summary class="flex items-center justify-between font-semibold mb-3 border-b border-zinc-700 pb-2 cursor-pointer select-none">
              <span>Jueves</span>
              <span class="toggle-indicator text-sm text-zinc-400" aria-hidden="true">&#9662;</span>
            </summary>
            <div id="thursday-bookings-list" class="space-y-4 text-sm pt-2"></div>
          </details>
          <details class="day-column group" data-day="friday">
            <summary class="flex items-center justify-between font-semibold mb-3 border-b border-zinc-700 pb-2 cursor-pointer select-none">
              <span>Viernes</span>
              <span class="toggle-indicator text-sm text-zinc-400" aria-hidden="true">&#9662;</span>
            </summary>
            <div id="friday-bookings-list" class="space-y-4 text-sm pt-2"></div>
          </details>
          <details class="day-column group" data-day="saturday">
            <summary class="flex items-center justify-between font-semibold mb-3 border-b border-zinc-700 pb-2 cursor-pointer select-none">
              <span>Sábado</span>
              <span class="toggle-indicator text-sm text-zinc-400" aria-hidden="true">&#9662;</span>
            </summary>
            <div id="saturday-bookings-list" class="space-y-4 text-sm pt-2"></div>
          </details>
          <details class="day-column group" data-day="sunday">
            <summary class="flex items-center justify-between font-semibold mb-3 border-b border-zinc-700 pb-2 cursor-pointer select-none">
              <span>Domingo</span>
              <span class="toggle-indicator text-sm text-zinc-400" aria-hidden="true">&#9662;</span>
            </summary>
            <div id="sunday-bookings-list" class="space-y-4 text-sm pt-2"></div>
          </details>
        </div>
      </section>
`;
