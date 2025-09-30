/* /admin/js/modules/calendar.js */
/* Calendar data handling and rendering for the admin view */
/* Replaces the calendar chunk inside the old AdminPanel */
/* RELEVANT FILES: admin/js/admin-core.js, admin/js/utils/date-helpers.js, admin/js/utils/ui-components.js, admin/css/admin-calendar.css */

import { APP_CONSTANTS } from '../utils/firebase-config.js';
import { DateHelpers } from '../utils/date-helpers.js';
import { CalendarGridComponent } from '../utils/ui-components.js';

export class CalendarModule {
  constructor(db, state) {
    this.db = db;
    this.state = state;
    this.dateHelpers = new DateHelpers();
    this.unsubscribe = null;
  }

  getWeekRange(baseDate = new Date()) {
    const day = baseDate.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diffToMonday);
    const weekDates = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return {
        date: this.dateHelpers.ymd(d),
        label: this.dateHelpers.formatWeekdayLabel(this.dateHelpers.ymd(d))
      };
    });
    return weekDates;
  }

  async loadWeek(baseDate = new Date()) {
    this.state.weekDates = this.getWeekRange(baseDate);
    const start = this.state.weekDates[0]?.date;
    const end = this.state.weekDates.at(-1)?.date;
    if (!start || !end) return;

    if (this.unsubscribe) {
      this.unsubscribe();
    }

    const query = this.db
      .collection('classes')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .orderBy('date')
      .orderBy('startTime');

    this.unsubscribe = query.onSnapshot((snap) => {
      this.state.classes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      this.state.weeklySchedule = this.groupClassesByDay(this.state.classes);
      this.renderWeeklyCalendar();
    });
  }

  groupClassesByDay(classes = []) {
    const grouped = {};
    classes.forEach((cls) => {
      const key = cls.date || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(cls);
    });
    return grouped;
  }

  renderWeeklyCalendar() {
    const container = document.getElementById('calendar-grid');
    if (!container) return;

    const calendarMarkup = CalendarGridComponent(
      this.state.weekDates.map((day) => ({
        date: day.date,
        label: day.label
      }))
    );

    container.innerHTML = calendarMarkup;

    this.state.weekDates.forEach((day) => {
      const dayGrid = container.querySelector(`.day-grid[data-date="${day.date}"]`);
      if (!dayGrid) return;
      const classes = this.state.weeklySchedule[day.date] || [];
      if (!classes.length) return;
      dayGrid.innerHTML = '';
      classes.forEach((cls) => {
        const el = this.createClassBlock(cls);
        dayGrid.appendChild(el);
      });
    });
  }

  createClassBlock(cls) {
    const block = document.createElement('button');
    block.type = 'button';
    block.className = 'class-block text-left';
    block.dataset.classId = cls.id;
    block.innerHTML = `
      <div class="class-meta">
        <span>${cls.startTime || '--:--'}</span>
        <span>${cls.capacity || APP_CONSTANTS.FACILITY_MAX_CAPACITY} lugares</span>
      </div>
      <p class="font-semibold text-sm">${cls.title || 'Clase sin título'}</p>
      <p class="text-xs text-zinc-300">${cls.instructor || 'Instructor por confirmar'}</p>
    `;

    block.addEventListener('click', () => {
      const event = new CustomEvent('admin:class:selected', { detail: cls });
      window.dispatchEvent(event);
    });

    return block;
  }

  detach() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
