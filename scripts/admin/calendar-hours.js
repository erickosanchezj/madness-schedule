// scripts/admin/calendar-hours.js
// Picks the first and last hour of the weekly calendar from this week's classes, so empty hours are hidden.
// Example: classes from 07:00 to 20:00 → the grid shows 07:00–20:00 instead of 06:00–22:00.
// RELEVANT FILES: scripts/admin/calendar.js, scripts/admin/views/week.js, styles/admin.css

Object.assign(AdminPanel, {

  // The grid never goes outside 06:00–22:00 (the range it always used before this file existed).
  DEFAULT_CALENDAR_START: 6,
  DEFAULT_CALENDAR_END: 22,

  // Sets calendarStartHour / calendarEndHour and redraws the hour labels. Runs at the start of
  // renderCalendarGrid(), so class blocks and the "now" line use the same hours.
  updateCalendarHours(){
    const times = this.state.classes
      .map(cls => ({ ...this.getLocalTimeParts(cls), duration: Number(cls.duration) || 60 }))
      .filter(t => Number.isInteger(t.hour));
    const earliest = times.length ? Math.min(...times.map(t => t.hour)) : this.DEFAULT_CALENDAR_START;
    // The hour the last class finishes, rounded up: a class from 19:00 to 20:00 ends the grid at 20:00.
    const latest = times.length
      ? Math.max(...times.map(t => Math.ceil((t.hour * 60 + t.minutes + t.duration) / 60)))
      : this.DEFAULT_CALENDAR_END;
    // Only hide hours: stay inside 06:00–22:00 and keep at least one visible hour.
    this.calendarEndHour = Math.min(Math.max(latest, this.DEFAULT_CALENDAR_START + 1), this.DEFAULT_CALENDAR_END);
    this.calendarStartHour = Math.min(Math.max(earliest, this.DEFAULT_CALENDAR_START), this.calendarEndHour - 1);

    const column = document.querySelector('.calendar-grid .time-column');
    if (column){
      const labels = [];
      for (let hour = this.calendarStartHour; hour <= this.calendarEndHour; hour++){
        labels.push(`<div class="time-slot">${String(hour).padStart(2, '0')}:00</div>`);
      }
      column.innerHTML = labels.join('');
    }
    // Day columns are exactly as tall as the visible hours (admin.css reads this variable).
    document.querySelector('.calendar-grid')
      ?.style.setProperty('--calendar-hours', String(this.calendarEndHour - this.calendarStartHour));
  },
});
