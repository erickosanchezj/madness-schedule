// scripts/member/screens/history.js
// History screen: classes finished today and in the last 14 days, with attendance.
// Shows members their attendance and the TotalPass token button.
// RELEVANT FILES: scripts/member/render.js, scripts/member/helpers.js, scripts/member/interactions.js

function getHistoryScreenHTML(){
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const completed = state.myBookings
    .filter(Boolean)
    .map(booking => {
      const startObj = booking.startAt
        ? asDate(booking.startAt)
        : (booking.classDate ? new Date(`${booking.classDate}T${booking.time||'00:00'}:00Z`) : null);
      if (!startObj || Number.isNaN(startObj.getTime())) return null;
      const relatedClass = state.classes.find(cls => cls.id === booking.classId);
      const durationRaw = booking.duration ?? relatedClass?.duration;
      const durationValue = Number(durationRaw);
      const durationMinutes = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : 60;
      const endTime = startObj.getTime() + durationMinutes * 60000;
      const ymdLocal = dateHelper.getYYYYMMDD(startObj);
      return { booking, relatedClass, startObj, endTime, ymdLocal };
    })
    .filter(Boolean)
    .filter(item => now > item.endTime)
    .sort((a, b) => b.startObj.getTime() - a.startObj.getTime());

  const todayYMD = dateHelper.today;
  const todays = completed.filter(item => item.ymdLocal === todayYMD);
  const recent = completed.filter(item => (now - item.startObj.getTime()) <= fourteenDaysMs);
  const recentPast = recent.filter(item => item.ymdLocal !== todayYMD);

  const renderCard = ({ booking, relatedClass, startObj, ymdLocal }) => {
    const className = booking.className || relatedClass?.name || '';
    const cover = relatedClass ? coverHelper.forClass(relatedClass) : coverHelper.forClassName(className);
    const safeClassName = DOMPurify.sanitize(className);
    const hhmm = timeFmt.format(startObj);
    const dayLabel = dateHelper.human(ymdLocal);
    const safeDayLabel = DOMPurify.sanitize(dayLabel);
    const attendance = (() => {
      const classId = booking.classId;
      if (classId && state.attendanceRecords?.[classId]) return state.attendanceRecords[classId];
      if (typeof booking.attendanceStatus === 'string') return { status: booking.attendanceStatus.trim().toLowerCase() };
      return null;
    })();
    const badge = (() => {
      const status = attendance?.status || '';
      const normalized = status.toLowerCase();
      if (normalized === 'attended'){
        return `<span class="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-300">Asististe</span>`;
      }
      if (normalized === 'absent'){
        return `<span class="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-300">Falta registrada</span>`;
      }
      return `<span class="inline-flex items-center gap-1 rounded-full border border-zinc-600/60 bg-zinc-700/60 px-3 py-1 text-xs font-medium text-zinc-300">Sin registro</span>`;
    })();
    return `
      <div class="card-panel p-4 flex items-center gap-4">
        <img src="${cover}" alt="${safeClassName}" class="w-16 h-16 rounded-lg object-cover bg-zinc-700" loading="lazy" decoding="async">
        <div class="flex-1">
          <p class="font-bold text-lg">${safeClassName}</p>
          <p class="text-zinc-400 text-sm">${safeDayLabel} • ${hhmm}</p>
          <div class="mt-2">${badge}</div>
        </div>
      </div>`;
  };

  const todayList = todays.length
    ? todays.map(renderCard).join('')
    : `<div class="card-panel p-5 text-center text-zinc-400">Aún no terminas clases hoy.</div>`;

  const tokenButton = (state.isTotalPass && todays.length)
    ? (() => {
        const firstId = todays[0].booking.classId ? DOMPurify.sanitize(todays[0].booking.classId) : '';
        const dataAttr = firstId ? ` data-class-id="${firstId}"` : '';
        return `<button data-action="send-totalpass-daily"${dataAttr} class="w-full btn-primary py-3 rounded-lg text-zinc-900 font-bold">Enviar Token del Día</button>`;
      })()
    : '';

  let historyList = '';
  if (recentPast.length) {
    historyList = recentPast.map(renderCard).join('');
  } else if (todays.length) {
    historyList = `<div class="card-panel p-5 text-center text-zinc-400">No hay clases anteriores en los últimos 14 días.</div>`;
  } else {
    historyList = `<div class="card-panel p-5 text-center text-zinc-400">No hay clases completadas en los últimos 14 días.</div>`;
  }

  return `
    <div class="screen-layout p-6 space-y-6">
      <header class="screen-header">
        <h1 class="text-3xl font-bold tracking-tight heading-display">Historial</h1>
        <p class="text-zinc-400">Revisa las clases que ya terminaste.</p>
      </header>
      <section aria-labelledby="terminadas-hoy">
        <h2 id="terminadas-hoy" class="text-xl font-semibold mb-3">Clases Terminadas Hoy</h2>
        <div class="space-y-4">
          ${todayList}
          ${tokenButton ? `<div>${tokenButton}</div>` : ''}
        </div>
      </section>
      <section aria-labelledby="historial-reciente">
        <h2 id="historial-reciente" class="text-xl font-semibold mb-3">Últimos 14 días</h2>
        <div class="space-y-4">${historyList}</div>
      </section>
    </div>`;
}
