/* /admin/js/utils/ui-components.js */
/* Template helpers that render small UI chunks */
/* Keeps HTML generation out of the core business logic */
/* RELEVANT FILES: admin/js/modules/calendar.js, admin/js/modules/bookings.js, admin/js/modules/analytics.js */

export const CalendarGridComponent = (weekDates = []) => `
  <div class="calendar-grid">
    <div class="time-column">
      ${Array.from({ length: 16 }, (_, idx) => {
        const hour = String(idx + 6).padStart(2, '0');
        return `<div class="time-slot">${hour}:00</div>`;
      }).join('')}
    </div>
    ${weekDates
      .map((day) => `
        <div class="day-grid" data-date="${day.date}" aria-label="${day.label}">
          <div class="empty-day-message">Sin clases registradas</div>
        </div>
      `)
      .join('')}
  </div>
`;

export const BookingListComponent = (bookings = []) => `
  <div class="space-y-2">
    ${bookings
      .map(
        (booking) => `
          <article class="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
            <header class="flex items-center justify-between">
              <p class="font-semibold">${booking.memberName}</p>
              <span class="text-xs text-zinc-400">${booking.status}</span>
            </header>
            <p class="text-sm text-zinc-300 mt-1">${booking.email}</p>
          </article>
        `
      )
      .join('') || '<p class="text-sm text-zinc-400">Sin reservaciones activas.</p>'}
  </div>
`;

export const AttendanceFormComponent = (attendees = []) => `
  <div class="space-y-2">
    ${attendees
      .map(
        (attendee) => `
          <div class="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-lg p-3">
            <div>
              <p class="font-semibold">${attendee.name}</p>
              <p class="text-xs text-zinc-400">${attendee.email}</p>
            </div>
            <div class="flex gap-2">
              <button class="attendance-btn px-3 py-1 rounded-md bg-zinc-700 hover:bg-emerald-600 transition" data-action="attended" data-id="${attendee.id}">Asistió</button>
              <button class="attendance-btn px-3 py-1 rounded-md bg-zinc-700 hover:bg-rose-600 transition" data-action="absent" data-id="${attendee.id}">Faltó</button>
            </div>
          </div>
        `
      )
      .join('') || '<p class="text-sm text-zinc-400">No hay asistentes registrados.</p>'}
  </div>
`;
