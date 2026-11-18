// scripts/admin/calendar-hours.js
// Picks the first hour of the weekly calendar from this week's classes, so empty early hours are hidden.
// Example: if the earliest class this week is at 07:00, the grid starts at 07:00 instead of 06:00.
// RELEVANT FILES: scripts/admin/calendar.js, scripts/admin/views/week.js, styles/admin.css

Object.assign(AdminPanel, {

  // The grid never starts earlier than this (same as before this file existed).
  DEFAULT_CALENDAR_START: 6,

  // Sets calendarStartHour and redraws the hour labels. Runs at the start of renderCalendarGrid(),
  // so class blocks and the "now" line are positioned from the same start hour.
  updateCalendarHours(){
    const hours = this.state.classes
      .map(cls => this.getLocalTimeParts(cls).hour)
      .filter(hour => Number.isInteger(hour));
    const earliest = hours.length ? Math.min(...hours) : this.DEFAULT_CALENDAR_START;
    // Only hide hours: never start before 06:00, and keep at least one visible hour.
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
