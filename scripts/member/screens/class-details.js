// scripts/member/screens/class-details.js
// Class screen: photo hero, three fact tiles, description, the 2-hour cancellation rule and one action area.
// Members book, cancel, join or leave the waitlist, or take a freed spot from here.
// RELEVANT FILES: scripts/member/screens/class-helpers.js, scripts/member/actions.js, styles/member-screens.css, docs/mockups/class-mockup.html

function getClassDetailsScreenHTML(classId){
  const cls = state.classes.find(c => c.id === classId);
  if (!cls) return getAgendaScreenHTML();
  const s = classBookingState(cls);
  const start = classStart(cls);
  const minutes = classDuration(cls);
  const hhmm = timeFmt.format(start);
  const countdown = todayCountdown(start, minutes);
  const safeId = DOMPurify.sanitize(cls.id);
  const safeName = DOMPurify.sanitize(cls.name || '');
  const day = [dayWord(start), shortDate(start)].filter(Boolean).join(' ');
  // The hero shows the start time only; the Duración tile gives the length.
  const durationLabel = minutes % 60 === 0 && minutes >= 120 ? `${minutes / 60} h` : `${minutes} min`;
  const spotsLabel = s.holdActive && !s.holdForMe ? 'Apartado'
    : s.capacity <= 0 ? '—' : s.available > 0 ? `Quedan ${s.available}` : 'Llena';
  const description = DOMPurify.sanitize(cls.description || '').trim().replace(/\n/g, '<br>');

  // Cancelling 2 h or less before class adds a strike (same rule as the server, functions/index.js).
  // Short sentences, no parentheticals: what blocks bookings is explained in Perfil.
  const cancelBy = new Date(start.getTime() - TWO_HOURS_MS);
  const lateNow = Date.now() >= cancelBy.getTime();
  const policy = lateNow
    ? (s.isBooked
      ? 'Faltan menos de 2 h. Si cancelas, cuenta como strike.'
      : 'Faltan menos de 2 h. Si reservas y luego cancelas, cuenta como strike.')
    : s.isBooked
      ? `Puedes cancelar sin strike hasta las ${timeFmt.format(cancelBy)}. Después cuenta como strike.`
      : `Si reservas, puedes cancelar sin strike hasta las ${timeFmt.format(cancelBy)}.`;

  return `
    <div class="class-detail-screen">
      <div class="class-detail-toolbar">
        <button data-action="navigate" data-screen="agenda" class="class-detail-back text-white" aria-label="Volver a la agenda">
          <i data-lucide="arrow-left" class="w-7 h-7" aria-hidden="true"></i>
        </button>
      </div>
      <div class="class-detail-content">
        <header class="class-detail-hero">
          <img src="${coverHelper.forClass(cls)}" class="class-detail-hero-image" alt="${safeName}">
          <div class="class-detail-hero-content">
            ${countdown ? `<span class="class-pill">${countdown}</span>` : ''}
            <h1 class="class-detail-title">${safeName}</h1>
            <p class="class-meta">${DOMPurify.sanitize(day)} · ${hhmm}</p>
          </div>
        </header>
        <div class="class-detail-body class-body">
          <ul class="class-facts" aria-label="Detalles de la clase">
            <li class="class-fact"><small>Instructor</small><b>${DOMPurify.sanitize(cls.instructor || 'Por asignar')}</b></li>
            <li class="class-fact"><small>Duración</small><b>${durationLabel}</b></li>
            <li class="class-fact"><small>Lugares</small><b>${spotsLabel}</b>
              ${s.capacity > 0 ? `<meter class="class-detail-progress" aria-label="Ocupación de la clase" min="0" max="${s.capacity}" value="${Math.min(s.enrolled, s.capacity)}">${s.enrolled}/${s.capacity}</meter>` : ''}</li>
          </ul>
          ${description ? `<section class="class-about" aria-labelledby="class-about-title"><h2 id="class-about-title">Sobre la clase</h2><p>${description}</p></section>` : ''}
          <p class="class-policy">${policy}</p>
        </div>
      </div>
      <div class="class-detail-feedback"></div>
      <div class="class-detail-cta"><div class="class-cta">${classActionHTML(cls, s, safeId, hhmm, countdown)}</div></div>
    </div>`;
}

// The action area. Same checks as the old screen, with one change: a booked class is checked first, so it
// always shows "Cancelar reserva" (before, an unpaid monthly member saw "Reserva bloqueada" even when booked).
function classActionHTML(cls, s, safeId, hhmm, countdown){
  const status = (tone, text) => `<p class="class-status is-${tone}">${text}</p>`;
  const primary = (action, label) => `
    <button data-action="${action}" data-class-id="${safeId}" class="w-full btn-primary class-detail-booking-button">
      <span>${label}</span><i data-lucide="chevron-right" class="w-5 h-5" aria-hidden="true"></i>
    </button>`;

  if (s.isBooked){
    return status('mine', 'Reservada')
      + (countdown !== 'En curso' ? `<button data-action="cancel-booking" data-class-id="${safeId}" class="w-full class-detail-booking-button class-btn-outline">Cancelar reserva</button>` : '');
  }

  // Monthly members who did not pay (and are past the grace period) cannot book.
  const type = typeof state.subscriptionType === 'string' ? state.subscriptionType : 'monthly';
  const paid = typeof state.subscriptionStatus === 'string' ? state.subscriptionStatus : 'unpaid';
  const grace = state.subscriptionGraceUntil instanceof Date && !Number.isNaN(state.subscriptionGraceUntil.getTime()) ? state.subscriptionGraceUntil : null;
  const withinGrace = grace ? Date.now() <= grace.getTime() : false;
  if (type === 'monthly' && paid !== 'paid' && !withinGrace){
    return `<div class="class-alert" role="alert"><p class="font-semibold">Pago vencido</p><p>Tu periodo de gracia terminó el ${formatGraceDeadline(grace)}. Paga para seguir reservando.</p></div>
      <button class="w-full class-detail-booking-button class-btn-disabled" disabled>Reserva bloqueada</button>`;
  }

  if (s.effectiveAvailable <= 0 && !s.notified){
    if (s.waitEntry){
      return status('warn', `Posición ${DOMPurify.sanitize(String(s.waitEntry.position || 1))} en la lista`)
        + `<button data-action="leave-waitlist" data-class-id="${safeId}" class="w-full class-detail-booking-button class-btn-outline">Salir de la lista</button>`;
    }
    if (s.holdActive && !s.holdForMe){
      // A freed spot is held for the next waitlisted member (5 min); joining is rejected meanwhile.
      return `<button type="button" data-action="held-spot" class="w-full class-detail-booking-button class-btn-held">Apartado</button>`
        + status('warn', 'Un lugar está apartado para la lista de espera unos minutos.');
    }
    return primary('join-waitlist', 'Unirme a la lista de espera')
      + status('warn', 'Si se libera un lugar te avisamos y tendrás 5 min para tomarlo.');
  }
  if (s.notified || s.holdForMe){
    return status('ok', 'Se liberó un lugar. Tienes 5 minutos para tomarlo.') + primary('confirm-booking', 'Tomar mi lugar');
  }
  // No "N lugares disponibles" line: the Lugares tile above already shows it.
  return primary('confirm-booking', `Reservar a las ${hhmm}`);
}
