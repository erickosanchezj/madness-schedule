// scripts/admin/weekly-bookings.js
// Per-day booking and waitlist lists, and the manual-booking list in the modal.
// Shows who is booked or waiting for each class.
// RELEVANT FILES: scripts/admin/listeners.js, scripts/admin/manual-bookings.js, scripts/admin/calendar.js

Object.assign(AdminPanel, {

  renderDailyBookings(){
    const dayContainers = {
      1: document.getElementById('monday-bookings-list'),
      2: document.getElementById('tuesday-bookings-list'),
      3: document.getElementById('wednesday-bookings-list'),
      4: document.getElementById('thursday-bookings-list'),
      5: document.getElementById('friday-bookings-list'),
      6: document.getElementById('saturday-bookings-list'),
      0: document.getElementById('sunday-bookings-list')
    };

    Object.values(dayContainers).forEach(container => {
      if (container) container.innerHTML = '';
    });

    const groupedByDay = {};
    const sorted = [...this.state.classes].sort((a,b)=>{
      const sa = new Date(`${a.classDate}T${a.time}:00Z`).getTime();
      const sb = new Date(`${b.classDate}T${b.time}:00Z`).getTime();
      return sa - sb;
    });

    for (const cls of sorted){
      const localDateStr = cls.localDate || cls.classDate;
      if (!localDateStr) continue;
      const localDate = new Date(`${localDateStr}T00:00:00`);
      const dayOfWeek = Number.isNaN(localDate.getTime()) ? null : localDate.getDay();
      if (dayOfWeek === null) continue;
      if (!groupedByDay[dayOfWeek]) groupedByDay[dayOfWeek] = [];
      groupedByDay[dayOfWeek].push(cls);
    }

    Object.entries(dayContainers).forEach(([dayKey, container]) => {
      if (!container) return;
      const classesArr = groupedByDay[dayKey] || [];
      if (!classesArr.length){
        container.innerHTML = '<p class="text-zinc-500 text-sm">No hay reservas.</p>';
        return;
      }

      const blocks = classesArr.map(cls=>{
        const attendees = this.state.bookingsMap.get(cls.id)||[];
        const manualBookings = attendees.filter(booking=>booking.isManualBooking);
        const regularBookings = attendees.filter(booking=>!booking.isManualBooking);
        const waiters = (this.state.waitlistsMap.get(cls.id)||[])
          .sort((a,b)=>(a.position||0)-(b.position||0))
          .map(w=>w.userName||w.userId||'Anónimo');
        const enrolled = Number(cls.enrolledCount||0);
        const cap = Number(cls.capacity||0);
        const manualLabel = manualBookings.length === 1 ? 'Whatsapp booking' : 'Whatsapp bookings';
        const manualRow = manualBookings.length
          ? `<li class="text-zinc-400 ml-4">- ${manualBookings.length} ${manualLabel}</li>`
          : '';
        const names = regularBookings.map(booking=>{
          const safeName = DOMPurify.sanitize(booking.userName || 'Anónimo');
          return `<li class="text-zinc-400 ml-4">- ${safeName}</li>`;
        }).join('');
        const waitNames = waiters.map(n=>`<li class="text-zinc-400 ml-4">- ${DOMPurify.sanitize(n)}</li>`).join('');
        const safeTime = DOMPurify.sanitize(cls.localTime || cls.time || '');
        const safeName = DOMPurify.sanitize(cls.name || '');
        const waitHTML = waiters.length ? `
            <p class="text-sm text-amber-400 mt-2">Lista de espera (${waiters.length})</p>
            <ul class="list-none">${waitNames}</ul>
        ` : '';
        return `
          <div class="mb-3">
            <p class="font-bold">${safeTime} - ${safeName} (${enrolled} de ${cap})</p>
            <ul class="list-none">${manualRow}${names}</ul>
            ${waitHTML}
          </div>`;
      });

      container.innerHTML = blocks.join('') || '<p class="text-zinc-500 text-sm">No hay reservas.</p>';
    });
  },

  // Render manual bookings so admins can free spots quickly.
  renderManualBookingsList(classId){
    const listEl = document.getElementById('manual-bookings-existing');
    if (!listEl){
      return;
    }

    if (!classId){
      listEl.innerHTML = '<p class="text-xs text-zinc-400">Selecciona una clase para revisar las reservas manuales.</p>';
      return;
    }

    const bookings = this.state.bookingsMap.get(classId) || [];
    const manualBookings = bookings.filter(b=>b.isManualBooking);

    if (!manualBookings.length){
      listEl.innerHTML = '<p class="text-xs text-zinc-400">No hay reservas manuales activas.</p>';
      return;
    }

    const rows = manualBookings.map(booking=>{
      const safeName = DOMPurify.sanitize(booking.userName || 'Reserva WhatsApp');
      const createdAtDate = booking.createdAt?.toDate ? booking.createdAt.toDate() : (booking.createdAt ? new Date(booking.createdAt) : null);
      const createdAtStr = createdAtDate && !Number.isNaN(createdAtDate.getTime()) ? this.timeFmt.format(createdAtDate) : '';
      const createdAtHtml = createdAtStr ? `<p class="text-[11px] text-zinc-500">Reservada a las ${createdAtStr}</p>` : '';
      return `
        <div class="flex items-center justify-between bg-zinc-800/70 border border-zinc-600 rounded-lg px-3 py-2">
          <div>
            <p class="text-sm text-zinc-100">${safeName}</p>
            ${createdAtHtml}
          </div>
          <button
            class="text-xs font-semibold text-rose-300 hover:text-rose-200"
            data-manual-booking-id="${booking.id}"
            data-manual-class-id="${classId}"
          >Liberar lugar</button>
        </div>`;
    });

    listEl.innerHTML = rows.join('');
    listEl.querySelectorAll('[data-manual-booking-id]').forEach(btn=>{
      btn.onclick = (evt)=>{
        const target = evt.currentTarget;
        const bookingId = target?.dataset?.manualBookingId;
        const clsId = target?.dataset?.manualClassId || classId;
        if (bookingId && clsId){
          const shouldDelete = confirm('¿Liberar este lugar manual?');
          if (shouldDelete){
            this.deleteManualBooking(clsId, bookingId);
          }
        }
      };
    });
  },
});
