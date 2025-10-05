// /scripts/admin/admin-calendar-grid.js
// Renders the time-grid calendar for the admin weekly schedule view
// Separates calendar layout logic so other modules can focus on data prep and modals
// RELEVANT FILES: scripts/admin/admin-state.js, scripts/admin/admin-data-sources.js, scripts/admin/admin-classes.js

import { AdminPanel } from './admin-state.js';

AdminPanel.isClassRunningNow = function isClassRunningNow(cls) {
  if (!cls || !cls.classDate || !cls.time) return false;
  const todayStr = this.dateHelper.today();
  if (cls.localDate !== todayStr) return false;
  const start = new Date(`${cls.classDate}T${cls.time}:00Z`).getTime();
  const end = start + (Number(cls.duration || 60) * 60000);
  const now = Date.now();
  return now >= start && now <= end;
};

AdminPanel.getLocalTimeParts = function getLocalTimeParts(cls) {
  if (!cls) return { hour: null, minutes: null };
  const localMatch = /^(\d{2}):(\d{2})/.exec(cls.localTime || '');
  if (localMatch) {
    return { hour: Number(localMatch[1]), minutes: Number(localMatch[2]) };
  }
  if (cls.classDate && cls.time) {
    const base = new Date(`${cls.classDate}T${cls.time}:00Z`);
    if (!Number.isNaN(base.getTime())) {
      const parts = this.timePartsFmt.formatToParts(base);
      const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
      const minutes = Number(parts.find((p) => p.type === 'minute')?.value || '0');
      if (!Number.isNaN(hour) && !Number.isNaN(minutes)) {
        return { hour, minutes };
      }
    }
  }
  return { hour: null, minutes: null };
};

AdminPanel.getCalendarDayContainers = function getCalendarDayContainers() {
  return {
    1: document.getElementById('monday-grid'),
    2: document.getElementById('tuesday-grid'),
    3: document.getElementById('wednesday-grid'),
    4: document.getElementById('thursday-grid'),
    5: document.getElementById('friday-grid'),
    6: document.getElementById('saturday-grid'),
    0: document.getElementById('sunday-grid')
  };
};

AdminPanel.highlightTodayColumn = function highlightTodayColumn() {
  const todayStr = this.dateHelper.today();
  const today = new Date(`${todayStr}T00:00:00-06:00`);
  const dow = Number.isNaN(today.getTime()) ? -1 : today.getUTCDay();
  const headerOrder = [1, 2, 3, 4, 5, 6, 0];
  const headerLabels = document.querySelectorAll('.calendar-header .day-label');
  headerLabels.forEach((label, index) => {
    const labelDay = headerOrder[index] ?? null;
    if (dow >= 0 && labelDay === dow) label.classList.add('today-label');
    else label.classList.remove('today-label');
  });
  document.querySelectorAll('.day-grid').forEach((grid) => {
    const index = Number(grid.dataset.dayIndex);
    if (index === dow) grid.classList.add('today-column');
    else grid.classList.remove('today-column');
  });
};

AdminPanel.updateCurrentTimeIndicator = function updateCurrentTimeIndicator() {
  const calendarGrid = document.querySelector('.calendar-grid');
  if (!calendarGrid) return;

  const existing = calendarGrid.querySelector('.current-time-line');
  if (existing) existing.remove();

  const todayStr = this.dateHelper.today();
  if (!todayStr) return;

  const today = new Date(`${todayStr}T00:00:00-06:00`);
  const dow = Number.isNaN(today.getTime()) ? null : today.getUTCDay();
  const timeParts = this.timePartsFmt.formatToParts(new Date());
  const hourPart = timeParts.find((p) => p.type === 'hour');
  const minutePart = timeParts.find((p) => p.type === 'minute');
  const hour = hourPart ? Number(hourPart.value) : NaN;
  const minutes = minutePart ? Number(minutePart.value) : NaN;
  if (!Number.isFinite(hour) || !Number.isFinite(minutes)) return;

  const minutesFromStart = ((hour * 60) + minutes) - (this.calendarStartHour * 60);
  const totalMinutes = (this.calendarEndHour - this.calendarStartHour) * 60;
  if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return;

  const hourHeightRaw = getComputedStyle(document.documentElement).getPropertyValue('--hour-height');
  const hourHeight = Number.parseFloat(hourHeightRaw) || 64;
  const offsetPx = (minutesFromStart / 60) * hourHeight;

  const line = document.createElement('div');
  line.className = 'current-time-line';
  line.style.top = `${offsetPx}px`;
  line.setAttribute('aria-hidden', 'true');
  if (dow !== null) {
    const dayContainers = this.getCalendarDayContainers();
    const todayContainer = dayContainers[dow];
    if (todayContainer) {
      const gridRect = calendarGrid.getBoundingClientRect();
      const dayRect = todayContainer.getBoundingClientRect();
      const dotOffset = dayRect && gridRect ? (dayRect.left - gridRect.left) + (dayRect.width / 2) : 12;
      line.style.setProperty('--current-time-indicator-x', `${Math.max(dotOffset, 12)}px`);
    }
  }

  calendarGrid.appendChild(line);
};

AdminPanel.ensureCurrentTimeTicker = function ensureCurrentTimeTicker() {
  if (this.currentTimeTicker) return;
  this.currentTimeTicker = setInterval(() => {
    this.highlightTodayColumn();
    this.updateCurrentTimeIndicator();
  }, 60000);
};

AdminPanel.stopCurrentTimeTicker = function stopCurrentTimeTicker() {
  if (this.currentTimeTicker) {
    clearInterval(this.currentTimeTicker);
    this.currentTimeTicker = null;
  }
  const calendarGrid = document.querySelector('.calendar-grid');
  if (calendarGrid) {
    const indicator = calendarGrid.querySelector('.current-time-line');
    if (indicator) indicator.remove();
  }
};

AdminPanel.renderCalendarGrid = function renderCalendarGrid() {
  const headerLabels = document.querySelectorAll('.calendar-header .day-label');
  if (headerLabels.length) {
    const fallbackLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    headerLabels.forEach((label, index) => {
      const labelText = this.formatWeekdayLabel(this.state.weekDates[index]) || fallbackLabels[index] || label.textContent;
      label.textContent = labelText;
    });
  }

  const dayContainers = this.getCalendarDayContainers();

  const dayEvents = {};
  Object.values(dayContainers).forEach((container) => {
    if (container) {
      container.innerHTML = '';
      container.classList.remove('today-column');
    }
  });

  const sorted = [...this.state.classes].sort((a, b) => {
    const sa = new Date(`${a.classDate}T${a.time}:00Z`).getTime();
    const sb = new Date(`${b.classDate}T${b.time}:00Z`).getTime();
    return sa - sb;
  });

  const startHour = this.calendarStartHour;
  const endHour = this.calendarEndHour;
  const totalMinutes = Math.max((endHour - startHour) * 60, 1);
  const hourHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 64;

  sorted.forEach((cls) => {
    const localDateStr = cls.localDate || cls.classDate;
    if (!localDateStr) return;
    const localDate = new Date(`${localDateStr}T00:00:00`);
    const dayOfWeek = Number.isNaN(localDate.getTime()) ? null : localDate.getDay();
    const container = dayOfWeek !== null ? dayContainers[dayOfWeek] : null;
    if (!container) return;

    const startDate = new Date(`${cls.classDate}T${cls.time}:00Z`);
    if (Number.isNaN(startDate.getTime())) return;
    const durationRaw = Number(cls.duration || 60);
    const durationMinutes = Number.isFinite(durationRaw) ? durationRaw : 60;
    const { hour, minutes } = this.getLocalTimeParts(cls);
    if (hour === null || minutes === null) return;
    const startMinutesFromStart = ((hour * 60) + minutes) - (startHour * 60);
    const event = {
      cls,
      startMs: startDate.getTime(),
      endMs: startDate.getTime() + (durationMinutes * 60000),
      durationMinutes,
      startMinutesFromStart,
      column: 0,
      overlapSpan: 1
    };
    if (!dayEvents[dayOfWeek]) dayEvents[dayOfWeek] = [];
    dayEvents[dayOfWeek].push(event);
  });

  Object.entries(dayContainers).forEach(([dayKey, container]) => {
    if (!container) return;
    const events = (dayEvents[dayKey] || []).sort((a, b) => a.startMs - b.startMs);
    if (!events.length) {
      container.innerHTML = '<div class="empty-day-message">Sin clases</div>';
      return;
    }

    const columns = [];
    const active = [];
    events.forEach((event) => {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        if (active[i].endMs <= event.startMs) active.splice(i, 1);
      }
      let columnIndex = columns.findIndex((end) => end <= event.startMs);
      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push(event.endMs);
      } else {
        columns[columnIndex] = event.endMs;
      }
      event.column = columnIndex;
      event.overlapSpan = Math.max(active.length + 1, 1);
      active.push(event);
      const overlapSize = active.length;
      active.forEach((item) => {
        item.overlapSpan = Math.max(item.overlapSpan || 1, overlapSize);
      });
    });

    const fragment = document.createDocumentFragment();
    events.forEach((event) => {
      const { cls } = event;
      const eventStart = event.startMinutesFromStart;
      const eventEnd = event.startMinutesFromStart + event.durationMinutes;
      const visibleStart = Math.max(eventStart, 0);
      const visibleEnd = Math.min(eventEnd, totalMinutes);
      if (visibleEnd <= 0 || visibleStart >= totalMinutes) return;

      const topPx = (visibleStart / 60) * hourHeight;
      const heightPx = Math.max(((visibleEnd - visibleStart) / 60) * hourHeight, 34);
      const widthPercent = 100 / Math.max(event.overlapSpan || 1, 1);
      const leftPercent = widthPercent * event.column;

      const block = document.createElement('div');
      block.className = 'class-block';
      if (this.isClassRunningNow(cls)) block.classList.add('running');
      block.style.top = `${topPx}px`;
      block.style.height = `${heightPx}px`;
      block.style.left = `calc(${leftPercent}% + 3px)`;
      block.style.width = `calc(${widthPercent}% - 6px)`;
      block.setAttribute('role', 'button');
      block.tabIndex = 0;

      const enrolled = Number(cls.enrolledCount || 0);
      const capacity = Number(cls.capacity || 0);
      const safeName = DOMPurify.sanitize(cls.name || '');
      const safeInstructor = DOMPurify.sanitize(cls.instructor || '');
      const startLabel = DOMPurify.sanitize(this.timeFmt.format(new Date(event.startMs)));
      const endLabel = DOMPurify.sanitize(this.timeFmt.format(new Date(event.endMs)));
      const capacityClass = enrolled >= capacity && capacity > 0 ? 'text-rose-200' : 'text-emerald-200';
      block.setAttribute('aria-label', `Editar ${safeName} de ${startLabel} a ${endLabel}`);

      block.innerHTML = `
        <div class="class-meta">
          <strong class="text-sm text-white leading-tight">${safeName} (${startLabel} - ${endLabel})</strong>
        </div>
        <span class="text-xs font-semibold ${capacityClass}">${safeInstructor || 'Instructor por asignar'} - ${enrolled} / ${capacity || '—'}</span>
      `;
      block.onclick = () => this.showClassModal(cls);
      block.onkeydown = (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          this.showClassModal(cls);
        }
      };
      fragment.appendChild(block);
    });

    container.appendChild(fragment);
    if (!container.children.length) {
      container.innerHTML = '<div class="empty-day-message">Sin clases</div>';
    }
  });

  this.highlightTodayColumn();
  this.updateCurrentTimeIndicator();
  this.ensureCurrentTimeTicker();
};
