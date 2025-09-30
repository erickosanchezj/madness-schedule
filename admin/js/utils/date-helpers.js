/* /admin/js/utils/date-helpers.js */
/* Date utilities extracted from the legacy AdminPanel */
/* Provides shared formatting helpers for calendar and analytics modules */
/* RELEVANT FILES: admin/js/admin-core.js, admin/js/modules/calendar.js, admin/js/modules/analytics.js, admin/js/modules/bookings.js */

export class DateHelpers {
  constructor() {
    const baseConfig = { timeZone: 'America/Mexico_City' };
    this.timeFmt = new Intl.DateTimeFormat('es-MX', {
      ...baseConfig,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    this.timePartsFmt = new Intl.DateTimeFormat('es-MX', {
      ...baseConfig,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    this.dayFmt = new Intl.DateTimeFormat('es-MX', {
      ...baseConfig,
      weekday: 'long',
      day: '2-digit',
      month: 'short'
    });
    this.dayShortFmt = new Intl.DateTimeFormat('es-MX', {
      ...baseConfig,
      day: '2-digit',
      month: 'short'
    });
    this.weekdayNameFmt = new Intl.DateTimeFormat('es-MX', {
      ...baseConfig,
      weekday: 'long'
    });
    this.weekdayShortFmt = new Intl.DateTimeFormat('es-MX', {
      ...baseConfig,
      weekday: 'short'
    });
  }

  ymd(date) {
    if (!(date instanceof Date)) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  today() {
    return this.ymd(new Date());
  }

  tomorrow() {
    return this.ymd(new Date(Date.now() + 86400000));
  }

  yesterday() {
    return this.ymd(new Date(Date.now() - 86400000));
  }

  normalizeStr(value = '') {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  formatWeekdayLabel(dateStr = '') {
    if (!dateStr) return null;
    const base = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    const weekdayRaw = this.weekdayNameFmt.format(base) || '';
    const prettyWeekday = weekdayRaw ? `${weekdayRaw.charAt(0).toUpperCase()}${weekdayRaw.slice(1)}` : '';
    return `${prettyWeekday} - ${base.getDate()}`.trim();
  }

  formatWeekdayShortLabel(dateStr = '') {
    if (!dateStr) return '';
    const base = new Date(`${dateStr}T00:00:00-06:00`);
    if (Number.isNaN(base.getTime())) return '';
    const raw = this.weekdayShortFmt.format(base) || '';
    const cleaned = raw.replace('.', '');
    if (!cleaned) return '';
    return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
  }
}
