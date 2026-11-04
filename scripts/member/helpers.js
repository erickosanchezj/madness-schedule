// scripts/member/helpers.js
// Date, time, countdown, skeleton and cover-image helpers for the member app.
// Keeps formatting identical on every screen (Mexico City time).
// RELEVANT FILES: scripts/member/screens/agenda.js, scripts/member/screens/history.js, scripts/member/state.js

// ---- Helpers (fechas, UI, etc.)
const MX_TZ = 'America/Mexico_City';
const ymdFmt = new Intl.DateTimeFormat('en-CA',{ timeZone: MX_TZ, year:'numeric', month:'2-digit', day:'2-digit' });
const timeFmt = new Intl.DateTimeFormat('es-MX',{ timeZone: MX_TZ, hour:'2-digit', minute:'2-digit', hour12:false });
const dateHelper = {
  getYYYYMMDD(date){ return ymdFmt.format(date); },
  get today(){ return this.getYYYYMMDD(new Date()); },
  get tomorrow(){ return this.getYYYYMMDD(new Date(Date.now()+86400000)); },
  human(ymd){
    if (!ymd) return '';
    const parts = ymd.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return '';
    const [year, month, day] = parts;
    // Use UTC noon so timezone conversion never rolls back to the previous day.
    const dt=new Date(Date.UTC(year, month-1, day, 12, 0, 0));
    return dt.toLocaleDateString('es-MX',{ timeZone: MX_TZ, weekday:'long',day:'2-digit',month:'short' });
  }
};
const timeHelper = {
  range(ymd, hhmm, durationMin=60){
    const start=new Date(`${ymd}T${hhmm}:00Z`);
    const end=new Date(start.getTime()+Number(durationMin||60)*60000);
    return `${timeFmt.format(start)}–${timeFmt.format(end)}`;
  }
};
function formatGraceDeadline(graceDate){
  const fallback = '10 de cada mes';
  if (!(graceDate instanceof Date) || Number.isNaN(graceDate.getTime())) return fallback;
  // Grace is stored as the first blocked moment, so show the last allowed day instead.
  const lastAllowedDay = new Date(graceDate.getTime() - 24 * 60 * 60 * 1000);
  return lastAllowedDay.toLocaleDateString('es-MX', { timeZone: MX_TZ, day: 'numeric', month: 'long' });
}
// Skeleton loader helpers mimic the layout of real content so loading feels smoother.
const skeletonLoaders = {
  classCard(){
    return `
      <div class="bg-zinc-800 rounded-lg p-4 mb-4 animate-pulse">
<div class="h-4 bg-zinc-700/50 rounded w-3/4 mb-3"></div>
<div class="h-3 bg-zinc-700/50 rounded w-1/2 mb-2"></div>
<div class="h-3 bg-zinc-700/50 rounded w-2/3"></div>
      </div>
    `;
  },
  bookingCard(){
    return `
      <div class="bg-zinc-800 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
<div class="w-16 h-16 rounded-lg bg-zinc-700"></div>
<div class="flex-1 space-y-2">
  <div class="h-4 bg-zinc-700/60 rounded w-3/4"></div>
  <div class="h-3 bg-zinc-700/50 rounded w-1/2"></div>
  <div class="h-3 bg-zinc-700/40 rounded w-1/3"></div>
</div>
      </div>
    `;
  }
};
const asDate = (x) => x?.toDate ? x.toDate() : new Date(x);
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function timeUntilLabel(ymd, hhmm){
  if(!ymd||!hhmm) return '';
  const start=new Date(`${ymd}T${hhmm}:00Z`).getTime();
  const now=Date.now();
  const diff=start-now;
  if (diff>4*60*60*1000) return '';
  const min=Math.round(diff/60000);
  if (min<=-120) return 'finalizada';
  if (min<0) return 'en curso';
  if (min===0) return 'empieza ahora';
  if (min<60) return `empieza en ${min} min`;
  const h=Math.floor(min/60), r=min%60;
  return r===0 ? `empieza en ${h} h` : `empieza en ${h} h ${r} min`;
}

function getCountdownClass(ymd, hhmm, defaultClass='text-orange-300'){
  if(!ymd||!hhmm) return defaultClass;
  const startTs=new Date(`${ymd}T${hhmm}:00Z`).getTime();
  if(Number.isNaN(startTs)) return defaultClass;
  const diff=startTs-Date.now();
  if(diff<0) return defaultClass;
  return diff<=FIFTEEN_MINUTES_MS ? 'text-amber-300' : defaultClass;
}

const coverHelper = {
  byName(name=''){
    const n=name.toLowerCase();
    if (n.includes('trx')) return 'images/trx.png';
    if (n.includes('yoga')) return 'images/yoga.png';
    if (n.includes('hiit')) return 'images/HIIT.png';
    if (n.includes('capoeira')) return 'images/capoeira.png';
    if (n.includes('funcional')||n.includes('functional')) return 'images/functional.png';
    return null;
  },
  forClassName(name){
    return this.byName(name)||'images/icon-192x192.png';
  },
  forClass(cls){
    return this.byName(cls.name)||cls.image||'images/icon-192x192.png';
  }
};
