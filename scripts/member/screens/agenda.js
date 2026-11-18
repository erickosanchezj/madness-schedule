// scripts/member/screens/agenda.js
// Agenda screen: greeting, daily message, the next booked class, and the Hoy/Mañana schedule as compact rows.
// The home screen where members see their next class and find a class to book (rows open the class screen).
// RELEVANT FILES: scripts/member/screens/class-helpers.js, scripts/member/screens/class-details.js, styles/member-screens.css, docs/mockups/agenda-mockup.html

function getAgendaScreenHTML(){
  const dataError = label => `<div class="card-panel p-4" role="alert"><p>No pudimos cargar ${label}. Revisa tu conexión.</p><button type="button" data-action="retry-agenda" class="btn-primary px-4 mt-3">Reintentar</button></div>`;
  const firstName = DOMPurify.sanitize((state.currentUser?.displayName || '').trim().split(/\s+/)[0] || '');

  return `
    <div class="agenda-screen screen-layout p-6 space-y-6">
      <header class="agenda-hello">
        <h1 class="heading-display">${firstName ? `Hola, ${firstName}` : 'Hola'}</h1>
        <time>${DOMPurify.sanitize(shortDate(new Date()))}</time>
      </header>
      ${agendaDailyMessageHTML()}
      ${agendaNextClassHTML(dataError)}
      ${agendaScheduleHTML(dataError)}
    </div>`;
}

// Admin daily message (one at a time; several rotate with a pause button).
function agendaDailyMessageHTML(){
  const message = state.dailyMessage && state.dailyMessage.message ? state.dailyMessage : null;
  if (!message) return '';
  const formatted = DOMPurify.sanitize(message.message || '').replace(/\n/g, '<br>');
  return `
      <section aria-live="polite" class="announcement card-panel p-4 flex items-start gap-3" data-message-id="${DOMPurify.sanitize(message.id || '')}">
        <div class="flex-1 text-sm leading-relaxed text-zinc-100">${formatted}</div>${dailyMessageRotation.messages.length > 1 ? `<button type="button" data-action="pause-messages" aria-pressed="${dailyMessageRotation.paused}" class="text-sm">${dailyMessageRotation.paused ? 'Reanudar' : 'Pausar'}</button>` : ''}
        <button type="button" aria-label="Cerrar anuncio" data-action="dismiss-message" class="text-zinc-400 hover:text-zinc-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </section>`;
}

// "Tu próxima clase": one big card for the next booking; any other bookings get one line each.
function agendaNextClassHTML(dataError){
  let body;
  if (state.errors.bookings) body = dataError('tus reservas');
  else if (state.loading?.bookings) body = skeletonLoaders.bookingCard();
  else {
    const now = Date.now();
    // Bookings that have not ended yet, soonest first.
    const upcoming = state.myBookings.filter(Boolean).filter(b => {
      const related = state.classes.find(cls => cls.id === b.classId);
      return now <= classStart(b).getTime() + classDuration(b, related) * 60000;
    }).sort((a, b) => classStart(a) - classStart(b));

    if (!upcoming.length){
      body = `
        <div class="card-panel p-5 text-center space-y-4">
          <p class="text-zinc-300">Aún no tienes reservas. ¡Anímate a agendar una clase!</p>
          <button data-action="scroll-to-schedule" class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold btn-primary rounded-lg text-zinc-900">Ver Horario</button>
        </div>`;
    } else {
      const [next, ...rest] = upcoming;
      const related = state.classes.find(cls => cls.id === next.classId);
      const start = classStart(next);
      const minutes = classDuration(next, related);
      const countdown = todayCountdown(start, minutes);
      const id = DOMPurify.sanitize(next.classId);
      const name = DOMPurify.sanitize(next.className || related?.name || '');
      const instructor = DOMPurify.sanitize(related?.instructor || '');
      const day = dayWord(start) || shortDate(start);
      const meta = [day, instructor ? `con ${instructor}` : '', `${minutes} min`].filter(Boolean).join(' · ');
      const others = rest.map(b => {
        const s = classStart(b);
        const label = `${DOMPurify.sanitize(b.className || '')} ${(dayWord(s) || shortDate(s)).toLowerCase()} ${timeFmt.format(s)}`;
        return `<button type="button" data-action="navigate-details" data-class-id="${DOMPurify.sanitize(b.classId)}" class="agenda-more">
          <span>${rest.length === 1 ? '+1 reserva' : 'Reserva'}: <b>${label}</b></span><i data-lucide="chevron-right" aria-hidden="true"></i></button>`;
      }).join('');
      body = `
        <article class="next-class" style="background-image:url('${coverHelper.forClassName(next.className)}')">
          ${countdown ? `<span class="next-class-pill">${countdown}</span>` : ''}
          <h3 class="next-class-title">${name} · ${timeFmt.format(start)}</h3>
          <p class="next-class-meta">${meta}</p>
          <div class="next-class-actions">
            <button type="button" data-action="navigate-details" data-class-id="${id}" class="btn-primary next-class-btn">Ver detalle</button>
            ${countdown !== 'En curso' ? `<button type="button" data-action="cancel-booking" data-class-id="${id}" class="next-class-cancel">Cancelar</button>` : ''}
          </div>
        </article>
        ${others}`;
    }
  }
  return `
      <section class="booking-section" aria-labelledby="mis-reservas">
        <h2 id="mis-reservas" class="agenda-eyebrow">Tu próxima clase</h2>
        ${body}
      </section>`;
}

// "Horario": Hoy/Mañana chips and one compact row per class, with free spots. Rows open the class screen.
function agendaScheduleHTML(dataError){
  const now = Date.now();
  const isToday = state.scheduleFilter === 'today';
  const targetYMD = isToday ? dateHelper.today : dateHelper.tomorrow;
  const classes = state.classes
    .filter(cls => dateHelper.getYYYYMMDD(classStart(cls)) === targetYMD)
    .filter(cls => !isToday || now <= classStart(cls).getTime() + classDuration(cls) * 60000) // hide today's finished classes
    .sort((a, b) => classStart(a) - classStart(b));

  let rows;
  if (state.errors.classes) rows = dataError('el horario');
  else if (state.loading?.classes) rows = Array(3).fill(0).map(() => skeletonLoaders.classCard()).join('');
  else if (!classes.length) rows = `<div class="card-panel p-5 text-center text-zinc-400">No hay más clases por ${isToday ? 'hoy' : 'mañana'}.</div>`;
  else rows = classes.map(cls => {
    const start = classStart(cls);
    const status = classRowStatus(classBookingState(cls));
    const soon = todayCountdown(start, classDuration(cls));
    // Only a "soon" tag (under an hour, or running); the time column already says when.
    const soonTag = (soon === 'En curso' || (/ min$/.test(soon) && !/ h/.test(soon))) ? soon.replace('Empieza ', '') : '';
    const name = DOMPurify.sanitize(cls.name || '');
    const instructor = DOMPurify.sanitize(cls.instructor || '');
    const hhmm = timeFmt.format(start);
    return `
      <button type="button" data-action="navigate-details" data-class-id="${DOMPurify.sanitize(cls.id)}"
        class="schedule-row${status.tone === 'mine' ? ' is-booked' : ''}" aria-label="${name} a las ${hhmm}. ${status.text}">
        <time class="schedule-time">${hhmm}</time>
        <span class="schedule-card">
          <img src="${coverHelper.forClass(cls)}" alt="" loading="lazy" decoding="async">
          <span class="schedule-info">
            <span class="schedule-name">${name}${instructor ? ` <span>· ${instructor}</span>` : ''}</span>
            <span class="schedule-status is-${status.tone}">${status.text}</span>${soonTag ? `<span class="schedule-soon">${soonTag}</span>` : ''}
          </span>
          <i data-lucide="chevron-right" class="schedule-chev" aria-hidden="true"></i>
        </span>
      </button>`;
  }).join('');

  const chip = (filter, label, date) => `
          <button data-action="set-filter" data-filter="${filter}" class="day-chip" aria-pressed="${state.scheduleFilter === filter}">
            <small>${label}</small><b>${date.toLocaleDateString('es-MX', { timeZone: MX_TZ, day: 'numeric' })}</b>
          </button>`;
  return `
      <section class="schedule-section" aria-labelledby="horario">
        <h2 id="horario" class="agenda-eyebrow">Horario</h2>
        <div class="day-chips" role="group" aria-label="Filtrar horario">
          ${chip('today', 'Hoy', new Date())}${chip('tomorrow', 'Mañana', new Date(Date.now() + 86400000))}
        </div>
        <div class="schedule-list">${rows}</div>
      </section>`;
}
