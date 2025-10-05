// /scripts/admin/admin-bookings.js
// Builds the per-day booking lists shown in the admin dashboard
// Keeps roster rendering isolated from the calendar grid logic
// RELEVANT FILES: scripts/admin/admin-state.js, scripts/admin/admin-data-sources.js, scripts/admin/admin-calendar-grid.js

import { AdminPanel } from './admin-state.js';

AdminPanel.renderDailyBookings = function renderDailyBookings() {
  const dayContainers = {
    1: document.getElementById('monday-bookings-list'),
    2: document.getElementById('tuesday-bookings-list'),
    3: document.getElementById('wednesday-bookings-list'),
    4: document.getElementById('thursday-bookings-list'),
    5: document.getElementById('friday-bookings-list'),
    6: document.getElementById('saturday-bookings-list'),
    0: document.getElementById('sunday-bookings-list')
  };

  Object.values(dayContainers).forEach((container) => {
    if (container) container.innerHTML = '';
  });

  const groupedByDay = {};
  const sorted = [...this.state.classes].sort((a, b) => {
    const sa = new Date(`${a.classDate}T${a.time}:00Z`).getTime();
    const sb = new Date(`${b.classDate}T${b.time}:00Z`).getTime();
    return sa - sb;
  });

  sorted.forEach((cls) => {
    const localDateStr = cls.localDate || cls.classDate;
    if (!localDateStr) return;
    const localDate = new Date(`${localDateStr}T00:00:00`);
    const dayOfWeek = Number.isNaN(localDate.getTime()) ? null : localDate.getDay();
    if (dayOfWeek === null) return;
    if (!groupedByDay[dayOfWeek]) groupedByDay[dayOfWeek] = [];
    groupedByDay[dayOfWeek].push(cls);
  });

  Object.entries(dayContainers).forEach(([dayKey, container]) => {
    if (!container) return;
    const classesArr = groupedByDay[dayKey] || [];
    if (!classesArr.length) {
      container.innerHTML = '<p class="text-zinc-500 text-sm">No hay reservas.</p>';
      return;
    }

    const blocks = classesArr.map((cls) => {
      const attendees = this.state.bookingsMap.get(cls.id) || [];
      const waiters = (this.state.waitlistsMap.get(cls.id) || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((w) => w.userName || w.userId || 'Anónimo');
      const enrolled = Number(cls.enrolledCount || 0);
      const cap = Number(cls.capacity || 0);
      const names = attendees
        .map((booking) => {
          const safeName = DOMPurify.sanitize(booking.userName || 'Anónimo');
          const manualBadge = booking.isManualBooking
            ? '<span class="ml-2 inline-flex items-center gap-1 text-emerald-300 text-xs" title="Reserva manual (WhatsApp)">📱</span>'
            : '';
          return `<li class="text-zinc-400 ml-4 flex items-center">- <span>${safeName}</span>${manualBadge}</li>`;
        })
        .join('');
      const waitNames = waiters.map((n) => `<li class="text-zinc-400 ml-4">- ${DOMPurify.sanitize(n)}</li>`).join('');
      const safeTime = DOMPurify.sanitize(cls.localTime || cls.time || '');
      const safeName = DOMPurify.sanitize(cls.name || '');
      const waitHTML = waiters.length
        ? `
            <p class="text-sm text-amber-400 mt-2">Lista de espera (${waiters.length})</p>
            <ul class="list-none">${waitNames}</ul>
        `
        : '';
      return `
        <div class="mb-3">
          <p class="font-bold">${safeTime} - ${safeName} (${enrolled} de ${cap})</p>
          <ul class="list-none">${names}</ul>
          ${waitHTML}
        </div>`;
    });

    container.innerHTML = blocks.join('') || '<p class="text-zinc-500 text-sm">No hay reservas.</p>';
  });
};
