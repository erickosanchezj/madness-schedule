// scripts/member/screens/class-helpers.js
// Shared helpers for the Agenda and class screens: start time, booking state and short date/countdown labels.
// Both screens used to repeat the same booking/waitlist/hold logic; it now lives here once.
// RELEVANT FILES: scripts/member/screens/agenda.js, scripts/member/screens/class-details.js, scripts/member/helpers.js

// Start time of a class or a booking (startAt when present, else classDate + time in UTC).
function classStart(item){
  if (item?.startAt) return asDate(item.startAt);
  return new Date(`${item?.classDate}T${item?.time || '00:00'}:00Z`);
}

// Duration in minutes; 60 when missing or invalid.
function classDuration(item, fallbackClass){
  const value = Number(item?.duration ?? fallbackClass?.duration);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

// "mié 18 nov" in Mexico City time.
function shortDate(date){
  const part = options => date.toLocaleDateString('es-MX', { timeZone: MX_TZ, ...options }).replace('.', '');
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })}`;
}

// "Hoy", "Mañana" or "" for other days.
function dayWord(date){
  const ymd = dateHelper.getYYYYMMDD(date);
  return ymd === dateHelper.today ? 'Hoy' : ymd === dateHelper.tomorrow ? 'Mañana' : '';
}

// Countdown for today's classes only ("Empieza en 6 h 20 min", "En curso"); tomorrow's date line is enough.
function todayCountdown(start, durationMin){
  if (dayWord(start) !== 'Hoy') return '';
  const minutes = Math.round((start.getTime() - Date.now()) / 60000);
  if (minutes < 0) return minutes > -durationMin ? 'En curso' : '';
  if (minutes === 0) return 'Empieza ahora';
  if (minutes < 60) return `Empieza en ${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `Empieza en ${h} h${m ? ` ${m} min` : ''}`;
}

// Everything a screen needs to decide what to show for one class and the signed-in member.
// A freed spot can be held for one waitlisted member (waitlistHold*); for everyone else it counts as full.
function classBookingState(cls){
  const enrolledRaw = Number(cls.enrolledCount || 0);
  const capacityRaw = Number(cls.capacity || 0);
  const enrolled = Number.isFinite(enrolledRaw) ? Math.max(0, enrolledRaw) : 0;
  const capacity = Number.isFinite(capacityRaw) ? Math.max(0, capacityRaw) : 0;
  const available = capacity - enrolled;
  const isBooked = state.myBookings.some(b => b.classId === cls.id);
  const waitEntry = state.waitlistEntries.find(w => w.classId === cls.id);
  // Notified waitlist members can book even if the class shows full, until their window expires.
  const notified = !!(waitEntry && waitEntry.notifiedAt && (!waitEntry.expiresAt || asDate(waitEntry.expiresAt).getTime() > Date.now()));
  const holdRaw = cls.waitlistHoldExpiresAt;
  const holdExpiresAt = holdRaw?.toDate ? holdRaw.toDate() : (holdRaw ? new Date(holdRaw) : null);
  const holdActive = !!(cls.waitlistHoldUserId && holdExpiresAt && holdExpiresAt.getTime() > Date.now());
  const holdForMe = holdActive && cls.waitlistHoldUserId === state.currentUser?.uid;
  const effectiveAvailable = holdActive && !holdForMe ? 0 : available;
  return { enrolled, capacity, available, isBooked, waitEntry, notified, holdActive, holdForMe, effectiveAvailable };
}

// One short status for a class row: text + tone (ok | low | full | warn | turn | mine).
function classRowStatus(s){
  if (s.isBooked) return { text: '✓ Reservada', tone: 'mine' };
  if (s.effectiveAvailable <= 0 && !s.notified){
    if (s.waitEntry) return { text: `En lista · posición ${Number(s.waitEntry.position) || 1}`, tone: 'warn' };
    if (s.holdActive && !s.holdForMe) return { text: 'Apartado', tone: 'warn' };
    return { text: 'Lleno · lista de espera', tone: 'full' };
  }
  if (s.notified || s.holdForMe) return { text: '¡Tu turno! Reserva ya', tone: 'turn' };
  if (s.capacity <= 0) return { text: 'Ver clase', tone: 'ok' };
  return s.available <= 4
    ? { text: `Quedan ${s.available}`, tone: 'low' }
    : { text: `${s.available} lugares`, tone: 'ok' };
}
