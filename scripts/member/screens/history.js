// scripts/member/screens/history.js
// History screen: TotalPass token card, this month's summary with a 14-day strip, and finished classes grouped by day.
// Shows members their attendance at a glance and lets TotalPass members send today's token.
// RELEVANT FILES: scripts/member/screens/class-helpers.js, scripts/member/interactions.js, styles/member-screens.css, docs/mockups/history-mockup.html

const DAY_MS = 24 * 60 * 60 * 1000;

// Attendance of one booking: 'att' (attended), 'abs' (absence recorded) or 'none' (staff did not take attendance).
function historyStatus(booking){
  const raw = state.attendanceRecords?.[booking.classId]?.status
    ?? (typeof booking.attendanceStatus === 'string' ? booking.attendanceStatus : '');
  const status = String(raw).trim().toLowerCase();
  return status === 'attended' ? 'att' : status === 'absent' ? 'abs' : 'none';
}

// "YYYY-MM-DD" of the Mexico City day `daysAgo` days before today (UTC noon keeps the date stable).
function historyYMD(daysAgo){
  const [y, m, d] = dateHelper.today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - daysAgo, 12)).toISOString().slice(0, 10);
}

// Monday of the week that contains a "YYYY-MM-DD" day, as "YYYY-MM-DD".
function historyWeek(ymd){
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

// Weeks in a row with at least one attended class. The current week does not break it while it is still empty.
function historyStreak(items){
  const weeks = new Set(items.filter(item => item.status === 'att').map(item => historyWeek(item.ymd)));
  const cursor = new Date(`${historyWeek(dateHelper.today)}T12:00:00Z`);
  if (!weeks.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 7);
  let streak = 0;
  while (weeks.has(cursor.toISOString().slice(0, 10))){ streak += 1; cursor.setUTCDate(cursor.getUTCDate() - 7); }
  return streak;
}

function getHistoryScreenHTML(){
  const now = Date.now();
  const month = new Date().toLocaleDateString('es-MX', { timeZone: MX_TZ, month: 'long' });
  const header = `<header class="agenda-hello"><h1 class="heading-display">Tu historial</h1><time>${DOMPurify.sanitize(month)}</time></header>`;
  const wrap = body => `<div class="history-screen screen-layout p-6 space-y-6">${header}${body}</div>`;
  if (state.errors.bookings) return wrap('<div class="card-panel p-4" role="alert"><p>No pudimos cargar tu historial. Revisa tu conexión.</p><button type="button" data-action="retry-agenda" class="btn-primary px-4 mt-3">Reintentar</button></div>');
  if (state.loading?.bookings) return wrap(skeletonLoaders.bookingCard());

  // Finished bookings (class already ended), newest first.
  const finished = state.myBookings.filter(Boolean).map(booking => {
    const start = classStart(booking);
    if (Number.isNaN(start.getTime())) return null;
    const related = state.classes.find(cls => cls.id === booking.classId);
    const end = start.getTime() + classDuration(booking, related) * 60000;
    return { booking, related, start, end, ymd: dateHelper.getYYYYMMDD(start), status: historyStatus(booking) };
  }).filter(item => item && now > item.end).sort((a, b) => b.start - a.start);

  if (!finished.length){
    return wrap(`
      <div class="history-panel history-empty">
        <p>Todavía no tienes clases terminadas.</p>
        <button type="button" data-action="navigate" data-screen="agenda" class="btn-primary px-4">Reservar una clase</button>
      </div>`);
  }

  const todays = finished.filter(item => item.ymd === dateHelper.today);
  const recent = finished.filter(item => now - item.start.getTime() <= 14 * DAY_MS);
  return wrap(`${historyTokenHTML(todays)}${historySummaryHTML(finished)}${historyListHTML(recent)}`);
}

// TotalPass: send today's token after a finished class (opens WhatsApp, see interactions.js).
function historyTokenHTML(todays){
  if (!state.isTotalPass || !todays.length) return '';
  const last = todays[0];
  const name = DOMPurify.sanitize(last.booking.className || last.related?.name || 'tu clase');
  return `
      <section class="history-token" aria-labelledby="token-title">
        <h2 id="token-title" class="agenda-eyebrow">TotalPass</h2>
        <p>Terminaste <b>${name} de las ${timeFmt.format(last.start)}</b>. Envía tu token para que tu visita cuente.</p>
        <button type="button" data-action="send-totalpass-daily" data-class-id="${DOMPurify.sanitize(last.booking.classId || '')}" class="w-full btn-primary">Enviar token del día</button>
      </section>`;
}

// "Este mes": classes attended, bookings, absences, streak and one mark per day for the last 14 days.
function historySummaryHTML(finished){
  const monthKey = dateHelper.today.slice(0, 7);
  const thisMonth = finished.filter(item => item.ymd.startsWith(monthKey));
  const attended = thisMonth.filter(item => item.status === 'att').length;
  const absent = thisMonth.filter(item => item.status === 'abs').length;
  const streak = historyStreak(finished);
  const words = { att: 'asististe', abs: 'falta', none: 'sin registro' };

  // One mark per day, oldest first. Several classes: the number goes inside; the color is the best result of the day.
  const strip = Array.from({ length: 14 }, (_, i) => historyYMD(13 - i)).map(ymd => {
    const day = finished.filter(item => item.ymd === ymd);
    const statuses = day.map(item => item.status);
    const top = statuses.includes('att') ? 'att' : statuses.includes('abs') ? 'abs' : statuses.length ? 'none' : '';
    const date = new Date(`${ymd}T12:00:00Z`);
    const letter = date.toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'narrow' });
    const label = `${DOMPurify.sanitize(shortDate(date))}: ${day.length ? `${day.length} ${day.length === 1 ? 'clase' : 'clases'}, ${statuses.map(s => words[s]).join(', ')}` : 'sin clase'}`;
    return `<li class="${ymd === dateHelper.today ? 'is-today' : ''}" title="${label}">
          <span class="history-dot${top ? ` is-${top}` : ''}" aria-hidden="true">${day.length > 1 ? day.length : ''}</span><span aria-hidden="true">${letter}</span><span class="sr-only">${label}</span></li>`;
  }).join('');

  return `
      <section aria-labelledby="month-title">
        <h2 id="month-title" class="agenda-eyebrow">Este mes</h2>
        <div class="history-panel">
          <p class="history-big"><b>${attended}</b><span>${attended === 1 ? 'clase a la que asististe' : 'clases a las que asististe'}</span></p>
          <ul class="class-facts history-facts">
            <li class="class-fact"><small>Reservas</small><b>${thisMonth.length}</b></li>
            <li class="class-fact"><small>Faltas</small><b>${absent}</b></li>
            <li class="class-fact"><small>Racha</small><b>${streak ? `${streak} sem.` : '—'}</b></li>
          </ul>
          <ul class="history-strip" aria-label="Asistencia de los últimos 14 días">${strip}</ul>
          <p class="history-legend" aria-hidden="true"><span><i class="is-att"></i>Asististe</span><span><i class="is-abs"></i>Falta</span><span><i class="is-none"></i>Sin registro</span><span><i></i>Sin clase</span></p>
        </div>
      </section>`;
}

// Finished classes of the last 14 days, grouped by day ("Hoy", "Ayer", "lun 16 nov"), same rows as the Agenda.
// Status words match the legend above (Asististe, Falta, Sin registro); color already marks the result, so no ✓ / ✕.
function historyListHTML(recent){
  const chips = { att: ['ok', 'Asististe'], abs: ['full', 'Falta'], none: ['none', 'Sin registro'] };
  const yesterday = historyYMD(1);
  const days = [...new Set(recent.map(item => item.ymd))];
  const groups = days.map(ymd => {
    const items = recent.filter(item => item.ymd === ymd);
    const title = ymd === dateHelper.today ? 'Hoy' : ymd === yesterday ? 'Ayer' : shortDate(items[0].start);
    const rows = items.map(({ booking, related, start, status }) => {
      const name = DOMPurify.sanitize(booking.className || related?.name || '');
      const instructor = DOMPurify.sanitize(related?.instructor || '');
      const cover = related ? coverHelper.forClass(related) : coverHelper.forClassName(booking.className || '');
      const [tone, text] = chips[status];
      return `
          <div class="schedule-row history-row">
            <time class="schedule-time">${timeFmt.format(start)}</time>
            <span class="schedule-card">
              <img src="${cover}" alt="" loading="lazy" decoding="async">
              <span class="schedule-info">
                <span class="schedule-name">${name}${instructor ? ` <span>· ${instructor}</span>` : ''}</span>
                <span class="schedule-status is-${tone}">${text}</span>
              </span>
            </span>
          </div>`;
    }).join('');
    return `<div><h3 class="history-day">${DOMPurify.sanitize(title)}</h3><div class="schedule-list">${rows}</div></div>`;
  }).join('');
  return `
      <section aria-labelledby="recent-title">
        <h2 id="recent-title" class="agenda-eyebrow">Últimos 14 días</h2>
        ${groups ? `<div class="history-groups">${groups}</div>` : '<div class="card-panel p-5 text-center text-zinc-400">No terminaste clases en los últimos 14 días.</div>'}
      </section>`;
}
