// scripts/member/screens/agenda.js
// Agenda screen: announcements, upcoming bookings and the today/tomorrow schedule.
// The home screen where members find and open classes.
// RELEVANT FILES: scripts/member/render.js, scripts/member/helpers.js, scripts/member/interactions.js

// --- AGENDA (igual que tu implementación, con mínimos cambios)
function getAgendaScreenHTML(){
  const now = Date.now();
  const isLoadingBookings = state.loading?.bookings;
  const dataError = label => `<div class="card-panel p-4" role="alert"><p>No pudimos cargar ${label}. Revisa tu conexión.</p><button type="button" data-action="retry-agenda" class="btn-primary px-4 mt-3">Reintentar</button></div>`;
  const reservasHTML = (() => {
    if (state.errors.bookings) return dataError('tus reservas');
    if (isLoadingBookings) {
      return Array(2).fill(0).map(() => skeletonLoaders.bookingCard()).join('');
    }

    const upcoming = state.myBookings.filter(Boolean).filter(b=>{
      const startObj = b.startAt ? asDate(b.startAt) : new Date(`${b.classDate}T${b.time||'00:00'}:00Z`);
      const relatedClass = state.classes.find(cls=>cls.id===b.classId);
      const durationRaw = b.duration ?? relatedClass?.duration;
      const durationValue = Number(durationRaw);
      const durationMinutes = Number.isFinite(durationValue) && durationValue>0 ? durationValue : 60;
      const endTime = startObj.getTime() + durationMinutes*60000;
      return now <= endTime;
    }).sort((a,b)=>{
      const ta = a.startAt ? asDate(a.startAt).getTime() : new Date(`${a.classDate}T${a.time||'00:00'}:00Z`).getTime();
      const tb = b.startAt ? asDate(b.startAt).getTime() : new Date(`${b.classDate}T${b.time||'00:00'}:00Z`).getTime();
      return ta - tb;
    });

    if (!upcoming.length) {
      return `
    <div class="card-panel p-5 text-center space-y-4">
      <p class="text-zinc-300">Aún no tienes reservas. ¡Anímate a agendar una clase!</p>
      <button data-action="scroll-to-schedule" class="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold btn-primary rounded-lg text-zinc-900">Ver Horario</button>
    </div>`;
    }

    return upcoming.map(b=>{
      const startObj = b.startAt ? asDate(b.startAt) : new Date(`${b.classDate}T${b.time||'00:00'}:00Z`);
      const ymdUTC = b.classDate || startObj.toISOString().slice(0,10);
      const hhmmUTC = b.time || startObj.toISOString().slice(11,16);
      const hhmm = timeFmt.format(startObj);
      const ymdLocal = dateHelper.getYYYYMMDD(startObj);
      const dayText = ymdLocal===dateHelper.today ? 'Hoy' : ymdLocal===dateHelper.tomorrow ? 'Mañana' : dateHelper.human(ymdLocal);
      const cover = coverHelper.forClassName(b.className);
      const timeStatus = timeUntilLabel(ymdUTC, hhmmUTC);
      const countdownClass = getCountdownClass(ymdUTC, hhmmUTC, 'text-orange-400');
      const showCancelButton = timeStatus !== 'en curso';
      const safeClassName = DOMPurify.sanitize(b.className || '');
      const safeDayText = DOMPurify.sanitize(dayText);
      const safeClassId = DOMPurify.sanitize(b.classId);
      const safeTimeStatus = DOMPurify.sanitize(timeStatus);
      return `
      <div class="card-panel p-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <img src="${cover}" alt="${safeClassName}" class="w-16 h-16 rounded-lg object-cover bg-zinc-700" loading="lazy" decoding="async">
          <div>
            <p class="font-bold text-lg">${safeClassName}</p>
            <p class="text-zinc-400 text-sm">${safeDayText} • ${hhmm}</p>
            <p class="${countdownClass} text-xs mt-0.5">${safeTimeStatus}</p>
          </div>
        </div>
        ${showCancelButton ? `<button type="button" data-action="cancel-booking" data-class-id="${safeClassId}" class="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-rose-400 border border-rose-400 rounded-lg hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-500/40">Cancelar</button>` : ''}
      </div>`;
    }).join('');
  })();

  const targetYMD = state.scheduleFilter==='today' ? dateHelper.today : dateHelper.tomorrow;
  const filtered = state.classes
    .filter(cls=>{
      const start = cls.startAt?.toDate ? cls.startAt.toDate() : new Date(`${cls.classDate}T${cls.time}:00Z`);
      const ymd = dateHelper.getYYYYMMDD(start);
      return ymd===targetYMD;
    })
    .filter(cls=>{
      if (state.scheduleFilter!=='today') return true;
      const start = cls.startAt?.toDate ? cls.startAt.toDate() : new Date(`${cls.classDate}T${cls.time}:00Z`);
      const durationValue = Number(cls.duration);
      const durationMinutes = Number.isFinite(durationValue) && durationValue>0 ? durationValue : 60;
      const endTime = start.getTime() + durationMinutes*60000;
      return now <= endTime;
    })
    .sort((a, b) => {
      const startA = a.startAt?.toDate ? a.startAt.toDate() : new Date(`${a.classDate}T${a.time}:00Z`);
      const startB = b.startAt?.toDate ? b.startAt.toDate() : new Date(`${b.classDate}T${b.time}:00Z`);
      return startA.getTime() - startB.getTime();
    });

  const isLoadingClasses = state.loading?.classes;
  const classesHTML = state.errors.classes ? dataError('el horario') : isLoadingClasses
    ? Array(3).fill(0).map(() => skeletonLoaders.classCard()).join('')
    : (() => {
      if (!filtered.length) {
        return `<div class="card-panel p-5 text-center text-zinc-400">No hay más clases por ${state.scheduleFilter==='today'?'hoy':'mañana'}.</div>`;
      }
      return filtered.map(cls=>{
        const enrolled = Number(cls.enrolledCount||0);
        const available = Number(cls.capacity||0)-enrolled;
        const isBooked = state.myBookings.some(b=>b.classId===cls.id);
        const waitEntry = state.waitlistEntries.find(w=>w.classId===cls.id); // check if user already in waitlist
        const notified = waitEntry && waitEntry.notifiedAt && (!waitEntry.expiresAt || asDate(waitEntry.expiresAt).getTime()>Date.now()); // notified users can book even if class shows full
        const holdUserId = cls.waitlistHoldUserId;
        const holdExpiresRaw = cls.waitlistHoldExpiresAt;
        const holdExpiresAt = holdExpiresRaw?.toDate ? holdExpiresRaw.toDate() : (holdExpiresRaw ? new Date(holdExpiresRaw) : null);
        const holdActive = holdUserId && holdExpiresAt && holdExpiresAt.getTime()>Date.now();
        const holdForMe = holdActive && holdUserId===state.currentUser?.uid;
        const effectiveAvailable = holdActive && !holdForMe ? 0 : available;
        const safeId = DOMPurify.sanitize(cls.id);
        let badge = `<div class="flex items-center justify-end gap-2">
      <!-- <span class="text-[10px] font-semibold normal-case text-emerald-300">Lugares disponibles</span> -->
      <span class="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold bg-emerald-500/50 text-emerald-100 rounded-md">Ver clase</span>
    </div>`;
        if (isBooked) {
          badge = `<span class="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-indigo-300 border border-indigo-400/70 rounded-md bg-transparent">Reservada</span>`;
        } else if (effectiveAvailable<=0 && !notified) {
          // class full: show join or leave waitlist options
          if (waitEntry) {
            const pos = DOMPurify.sanitize(String(waitEntry.position||1));
            badge = `<div><p class=\"text-xs text-amber-400\">Posición ${pos}</p><button data-action=\"leave-waitlist\" data-class-id=\"${safeId}\" class=\"mt-1 text-xs text-rose-400 hover:text-rose-300\">Salir</button></div>`;
          } else if (holdActive && !holdForMe) {
            // A freed spot is held for the next waitlisted member for 5 minutes. The server rejects
            // joining the waitlist meanwhile, so show "Apartado"; tapping it explains (held-spot).
            badge = `<button type="button" data-action="held-spot" class="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-amber-300 border border-amber-400/60 rounded-md bg-transparent">Apartado</button>`;
          } else {
            badge = `<button data-action=\"join-waitlist\" data-class-id=\"${safeId}\" class=\"inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold btn-primary text-zinc-900 rounded-md\">Unirse a lista de espera</button>`;
          }
        } else if (effectiveAvailable<=0 && notified) {
          // user has been notified of a free spot
          badge = `<span class="text-xs bg-amber-500/50 text-amber-300 px-2 py-1 rounded-md">Tu turno</span>`;
        } else if (holdActive && holdForMe) {
          badge = `<span class="text-xs bg-amber-500/50 text-amber-300 px-2 py-1 rounded-md">Tu turno</span>`;
        }
        const ymdUTC = cls.classDate || targetYMD;
        const hhmmUTC = cls.time || cls.startAt.toDate().toISOString().slice(11,16);
        const startLocal = new Date(`${ymdUTC}T${hhmmUTC}:00Z`);
        const hhmm = timeFmt.format(startLocal);
        const ymdLocal = dateHelper.getYYYYMMDD(startLocal);
        const dayText = ymdLocal===dateHelper.today ? 'Hoy' : ymdLocal===dateHelper.tomorrow ? 'Mañana' : dateHelper.human(ymdLocal);
        const safeName = DOMPurify.sanitize(cls.name || '');
        const safeInstructor = DOMPurify.sanitize(cls.instructor || '');
        const safeDayText = DOMPurify.sanitize(dayText);
        const countdownClass = getCountdownClass(ymdUTC, hhmmUTC);
        return `
      <div role="group" data-action="navigate-details" data-class-id="${safeId}" class="class-row card-panel p-4 flex items-center gap-4 cursor-pointer">
        <img src="${coverHelper.forClass(cls)}" alt="${safeName}" class="w-16 h-16 rounded-lg object-cover bg-zinc-700" loading="lazy" decoding="async">
        <div class="flex-1">
          <button type="button" data-action="navigate-details" data-class-id="${safeId}" class="class-title font-bold text-lg">${safeName}</button>
          <p class="text-zinc-400 text-sm">con ${safeInstructor}</p>
          <p class="text-sm mt-1 text-orange-400">${safeDayText} • ${hhmm}</p>
          <p class="${countdownClass} text-xs mt-0.5">${timeUntilLabel(ymdUTC, hhmmUTC)}</p>
        </div>
        <div class="class-row-action text-right">${badge}</div>
      </div>`;
      }).join('');
    })();
  const activeDailyMessage = state.dailyMessage && state.dailyMessage.message ? state.dailyMessage : null;
  const dailyMessageHTML = activeDailyMessage ? (()=>{
    const safeId = DOMPurify.sanitize(activeDailyMessage.id || '');
    const sanitized = DOMPurify.sanitize(activeDailyMessage.message || '');
    const formatted = sanitized.replace(/\n/g,'<br>');
    return `
      <section aria-live="polite" class="announcement card-panel p-4 flex items-start gap-3" data-message-id="${safeId}">
        <div class="flex-1 text-sm leading-relaxed text-zinc-100">${formatted}</div>${dailyMessageRotation.messages.length > 1 ? `<button type="button" data-action="pause-messages" aria-pressed="${dailyMessageRotation.paused}" class="text-sm">${dailyMessageRotation.paused ? 'Reanudar' : 'Pausar'}</button>` : ''}
        <button type="button" aria-label="Cerrar anuncio" data-action="dismiss-message" class="text-zinc-400 hover:text-zinc-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </section>`;
  })() : '';

  return `
    <div class="agenda-screen screen-layout p-6 space-y-6">
      <header class="screen-header">
        <h1 class="text-3xl font-bold tracking-tight heading-display">Tu Agenda</h1>
        <p class="text-zinc-400">Tus reservas próximas y el horario.</p>
      </header>
      ${dailyMessageHTML}
      <section class="booking-section" aria-labelledby="mis-reservas">
        <h2 id="mis-reservas" class="text-xl font-semibold mb-3">Tus Reservas</h2>
        <div class="space-y-4">${reservasHTML}</div>
      </section>
      <section class="schedule-section" aria-labelledby="horario">
        <div class="flex items-center justify-between mb-3">
          <h2 id="horario" class="text-xl font-semibold">Horario</h2>
          <div class="segmented-control" role="group" aria-label="Filtrar horario">
            <button data-action="set-filter" data-filter="today" class="px-4 py-1 text-sm font-semibold ${state.scheduleFilter==='today'?'btn-primary text-zinc-900':'text-zinc-200'}" aria-pressed="${state.scheduleFilter==='today'}">Hoy</button>
            <button data-action="set-filter" data-filter="tomorrow" class="px-4 py-1 text-sm font-semibold ${state.scheduleFilter==='tomorrow'?'btn-primary text-zinc-900':'text-zinc-200'}" aria-pressed="${state.scheduleFilter==='tomorrow'}">Mañana</button>
          </div>
        </div>
        <div class="space-y-4">${classesHTML}</div>
      </section>
    </div>`;
}
