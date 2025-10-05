// /scripts/admin/layout/panel-calendar.js
// Weekly calendar grid section
// Generated from admin layout extraction to keep files small
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

export const panelCalendarHTML = /* html */ `
<section aria-labelledby="week-title">
          <h2 id="week-title" class="text-2xl font-bold mb-4 text-emerald-400 border-b border-zinc-700 pb-2">Clases de la Semana</h2>
          <div class="calendar-container space-y-4">
            <div class="overflow-x-auto pb-2">
              <div class="min-w-[960px] space-y-2">
                <div class="calendar-header text-xs font-semibold uppercase tracking-wide text-zinc-400">
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
`;
