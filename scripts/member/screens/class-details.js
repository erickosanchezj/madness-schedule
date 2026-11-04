// scripts/member/screens/class-details.js
// Class details screen with the booking / waitlist call to action.
// Members book, join or leave the waitlist from here.
// RELEVANT FILES: scripts/member/render.js, scripts/member/actions.js, scripts/member/helpers.js

function getClassDetailsScreenHTML(classId){
  const cls = state.classes.find(c=>c.id===classId);
  if (!cls) return getAgendaScreenHTML();
  const enrolledRaw = Number(cls.enrolledCount||0);
  const capacityRaw = Number(cls.capacity||0);
  const enrolled = Number.isFinite(enrolledRaw) ? Math.max(0, enrolledRaw) : 0;
  const capacityValue = Number.isFinite(capacityRaw) ? Math.max(0, capacityRaw) : 0;
  const availableSpots = capacityValue-enrolled;
  const isBooked = state.myBookings.some(b=>b.classId===cls.id);
  const holdUserId = cls.waitlistHoldUserId;
  const holdExpiresRaw = cls.waitlistHoldExpiresAt;
  const holdExpiresAt = holdExpiresRaw?.toDate ? holdExpiresRaw.toDate() : (holdExpiresRaw ? new Date(holdExpiresRaw) : null);
  const holdActive = holdUserId && holdExpiresAt && holdExpiresAt.getTime()>Date.now();
  const holdForMe = holdActive && holdUserId===state.currentUser?.uid;
  const effectiveAvailable = holdActive && !holdForMe ? 0 : availableSpots;
  const subscriptionType = typeof state.subscriptionType === 'string' ? state.subscriptionType : 'monthly';
  const subscriptionStatus = typeof state.subscriptionStatus === 'string' ? state.subscriptionStatus : 'unpaid';
  const graceUntilDate = state.subscriptionGraceUntil instanceof Date && !Number.isNaN(state.subscriptionGraceUntil.getTime())
    ? state.subscriptionGraceUntil
    : null;
  const withinGrace = graceUntilDate ? Date.now()<=graceUntilDate.getTime() : false;
  const isMonthlyBlocked = subscriptionType==='monthly' && subscriptionStatus!=='paid' && !withinGrace;
  const graceDeadlineMessage = `Tu periodo de gracia terminó el ${formatGraceDeadline(graceUntilDate)}. Paga para seguir reservando.`;
  const waitEntry = state.waitlistEntries.find(w=>w.classId===cls.id);
  const notified = waitEntry && waitEntry.notifiedAt && (!waitEntry.expiresAt || asDate(waitEntry.expiresAt).getTime()>Date.now());
  const durationMin = Number(cls.duration||60);
  const startFromClass = cls.startAt?.toDate ? cls.startAt.toDate() : null;
  const ymdUTC = cls.classDate || startFromClass?.toISOString().slice(0,10) || dateHelper.today;
  const hhmmUTC = cls.time || startFromClass?.toISOString().slice(11,16) || '00:00';
  const timeRange = timeHelper.range(ymdUTC, hhmmUTC, durationMin);
  const startLocal = startFromClass || new Date(`${ymdUTC}T${hhmmUTC}:00Z`);
  let dateContext = '';
  if (!Number.isNaN(startLocal.getTime())){
    const ymdLocal = dateHelper.getYYYYMMDD(startLocal);
    const baseLabel = startLocal.toLocaleDateString('es-MX', {
      timeZone: MX_TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).replace(/,/g, '');
    const prettyLabel = baseLabel.split(' ').map(word => {
      if (word.toLowerCase()==='de') return 'de';
      return word ? word.charAt(0).toUpperCase()+word.slice(1) : word;
    }).join(' ');
    dateContext = ymdLocal===dateHelper.today ? `Hoy, ${prettyLabel}` : ymdLocal===dateHelper.tomorrow ? `Mañana, ${prettyLabel}` : prettyLabel;
  }
  const safeName = DOMPurify.sanitize(cls.name || '');
  const safeInstructor = DOMPurify.sanitize(cls.instructor || 'Por asignar');
  const safeDateContext = DOMPurify.sanitize(dateContext);
  const safeTimeRange = DOMPurify.sanitize(timeRange);
  const safeId = DOMPurify.sanitize(cls.id);
  const durationLabel = (()=>{
    if (!Number.isFinite(durationMin) || durationMin<=0) return 'Duración no definida';
    const hours = Math.floor(durationMin/60);
    const minutes = durationMin%60;
    if (hours && minutes) return `${hours} h ${minutes} min`;
    return hours ? `${hours} h` : `${minutes} min`;
  })();
  const occupancyLabel = capacityValue>0 ? `${enrolled}/${capacityValue} ocupados` : 'Capacidad no definida';
  const bookingButton = (action, label) => `
    <button data-action="${action}" data-class-id="${safeId}" class="w-full btn-primary class-detail-booking-button">
      <span>${label}</span><i data-lucide="chevron-right" class="w-5 h-5" aria-hidden="true"></i>
    </button>`;
  let buttonHTML = bookingButton('confirm-booking', 'Reservar Ahora');
  if (isBooked) {
    buttonHTML = `<button class="w-full class-detail-booking-button bg-zinc-700 text-zinc-400 font-bold" disabled>Ya estás inscrito</button>`;
  } else if (effectiveAvailable<=0 && !notified) {
    if (waitEntry) {
      const pos = DOMPurify.sanitize(String(waitEntry.position||1));
      buttonHTML = `<div class="space-y-2"><p class="text-center text-sm">Posición en lista de espera: ${pos}</p><button data-action="leave-waitlist" data-class-id="${safeId}" class="w-full class-detail-booking-button bg-rose-800 text-rose-100 font-bold">Salir de la lista de espera</button></div>`;
    } else {
      buttonHTML = bookingButton('join-waitlist', 'Unirse a lista de espera');
    }
  } else if (holdActive && holdForMe) {
    buttonHTML = `<div class="space-y-2"><p class="text-center text-sm text-amber-300">Tienes 5 minutos para tomar este lugar.</p>${bookingButton('confirm-booking', 'Reservar Ahora')}</div>`;
  }
  if (isMonthlyBlocked) {
    buttonHTML = `<div class="space-y-3"><div class="rounded-2xl border border-rose-700 bg-rose-900/60 p-4 text-sm text-rose-100"><p class="font-semibold">Suscripción mensual no pagada.</p><p class="mt-1 text-rose-200">${graceDeadlineMessage}</p></div><button class="w-full class-detail-booking-button bg-zinc-700 text-zinc-500 font-bold" disabled>Reserva bloqueada</button></div>`;
  }
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
          <h1 class="class-detail-title">${safeName}</h1>
          <div class="class-detail-pills">
            <div class="class-detail-pill"><i data-lucide="clock-3" class="w-5 h-5" aria-hidden="true"></i><span>${safeTimeRange}</span></div>
            ${safeDateContext ? `<div class="class-detail-pill"><i data-lucide="calendar-days" class="w-5 h-5" aria-hidden="true"></i><span>${safeDateContext}</span></div>` : ''}
          </div>
        </div>
      </header>
      <div class="class-detail-body">
        <section aria-labelledby="class-details" class="class-detail-card">
          <h2 id="class-details">Detalles</h2>
          <ul>
            <li class="class-detail-row">
              <span class="class-detail-icon"><i data-lucide="user-round" class="w-7 h-7" aria-hidden="true"></i></span>
              <div><p class="class-detail-label">Instructor</p><p class="class-detail-value">${safeInstructor}</p></div>
            </li>
            <li class="class-detail-row">
              <span class="class-detail-icon"><i data-lucide="clock-3" class="w-7 h-7" aria-hidden="true"></i></span>
              <div><p class="class-detail-label">Duración</p><p class="class-detail-value">${durationLabel}</p></div>
            </li>
            <li class="class-detail-row">
              <span class="class-detail-icon"><i data-lucide="users-round" class="w-7 h-7" aria-hidden="true"></i></span>
              <div class="min-w-0">
                <p class="class-detail-label">Lugares</p>
                <p class="class-detail-value">${holdActive && !holdForMe ? 'Reservado para lista de espera' : occupancyLabel}</p>
                ${capacityValue > 0 ? `<meter class="class-detail-progress" aria-label="Ocupación de la clase" min="0" max="${capacityValue}" value="${Math.min(enrolled, capacityValue)}">${occupancyLabel}</meter>` : ''}
              </div>
            </li>
          </ul>
        </section>
      </div>
      </div>
      <div class="class-detail-feedback"></div>
      <div class="class-detail-cta"><div>${buttonHTML}</div></div>
    </div>`;
}
