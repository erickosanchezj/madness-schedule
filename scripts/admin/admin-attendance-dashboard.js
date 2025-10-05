// /scripts/admin/admin-attendance-dashboard.js
// Renders charts and detailed cards for the attendance analytics screen
// Keeps heavy UI rendering separate so status widgets and exports live elsewhere
// RELEVANT FILES: scripts/admin/admin-attendance-core.js, scripts/admin/admin-attendance-insights.js, scripts/admin/admin-state.js

import { AdminPanel } from './admin-state.js';

AdminPanel.destroyAttendanceCharts = function destroyAttendanceCharts() {
  if (!this.state.attendanceCharts) this.state.attendanceCharts = {};
  Object.values(this.state.attendanceCharts).forEach((chart) => {
    try {
      chart?.destroy?.();
    } catch (err) {
      console.warn('Error al destruir chart', err);
    }
  });
  this.state.attendanceCharts = {};
};

AdminPanel.renderCapacityHeatmap = function renderCapacityHeatmap(heatmapData) {
  const container = document.getElementById('capacity-heatmap');
  if (!container) return;
  const dayEntries = Object.entries(heatmapData || {});
  if (!dayEntries.length) {
    container.innerHTML = '<p class="text-zinc-500">Sin datos de horario.</p>';
    return;
  }
  const hours = new Set();
  dayEntries.forEach(([, hoursObj]) => {
    Object.keys(hoursObj || {}).forEach((h) => hours.add(h));
  });
  const hourList = Array.from(hours).sort();
  const maxVal = Math.max(...dayEntries.flatMap(([, hoursObj]) => Object.values(hoursObj || {})), 1);
  const columns = hourList.length + 1;
  const header = ['<div class="font-semibold">Día</div>', ...hourList.map((h) => `<div class="text-center">${DOMPurify.sanitize(h)}</div>`)];
  const gridStyle = `style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:0.25rem;"`;
  const rows = [`<div ${gridStyle}>${header.join('')}</div>`];
  dayEntries
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([day, hoursObj]) => {
      const labelDate = new Date(`${day}T00:00:00-06:00`);
      const dayLabel = Number.isNaN(labelDate.getTime()) ? day : this.dayShortFmt.format(labelDate);
      const cells = [`<div class="text-zinc-400">${DOMPurify.sanitize(dayLabel)}</div>`];
      hourList.forEach((h) => {
        const value = hoursObj?.[h] || 0;
        const intensity = Math.min(1, value / Math.max(maxVal, 1));
        const bg = `rgba(129,140,248,${(0.15 + intensity * 0.75).toFixed(2)})`;
        cells.push(`<div class="text-center rounded-sm" style="background:${bg}">${value}</div>`);
      });
      rows.push(`<div ${gridStyle}>${cells.join('')}</div>`);
    });
  container.innerHTML = rows.join('');
};

AdminPanel.renderAttendanceDashboardFromCache = function renderAttendanceDashboardFromCache() {
  const trendCtx = document.getElementById('attendanceTrendChart')?.getContext('2d');
  const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
  const retentionCtx = document.getElementById('retentionChart')?.getContext('2d');
  const popularityCtx = document.getElementById('popularityChart')?.getContext('2d');
  const details = document.getElementById('attendance-details');
  const loadingEl = document.getElementById('dashboard-loading');
  if (loadingEl) loadingEl.classList.add('hidden');
  if (!trendCtx || !details) return;

  const dataCache = this.state.attendanceData;
  if (!dataCache) {
    details.innerHTML = '<div class="bg-zinc-900 p-3 rounded-md text-zinc-400">Cargando reporte… se actualizará automáticamente.</div>';
    return;
  }
  this.injectBookingsIntoReport();
  const periodBuckets = this.aggregateReportByPeriod(dataCache, this.state.selectedPeriod);
  if (!periodBuckets.length) {
    this.destroyAttendanceCharts();
    details.innerHTML = '<div class="bg-zinc-900 p-3 rounded-md text-zinc-400">No hay datos en el rango seleccionado.</div>';
    this.renderCapacityHeatmap({});
    return;
  }

  const labels = periodBuckets.map((b) => b.label);
  const metrics = periodBuckets.map((b) => b.data);
  const selected = this.state.selectedMetrics || new Set();
  const datasets = [];
  if (selected.has('attended')) datasets.push({ label: 'Asistencias', data: metrics.map((m) => m.attended || 0), backgroundColor: 'rgba(16,185,129,0.6)', stack: 'counts' });
  if (selected.has('absent')) datasets.push({ label: 'Ausencias', data: metrics.map((m) => m.absent || 0), backgroundColor: 'rgba(244,63,94,0.6)', stack: 'counts' });
  if (selected.has('booked')) datasets.push({ label: 'Reservas', data: metrics.map((m) => m.booked || 0), backgroundColor: 'rgba(59,130,246,0.6)', stack: 'counts' });
  if (selected.has('utilization')) datasets.push({ label: 'Utilización %', data: metrics.map((m) => m.utilizationRate || 0), type: 'line', yAxisID: 'y1', borderColor: '#a855f7', tension: 0.2, fill: false, pointBackgroundColor: '#a855f7' });
  if (selected.has('revenue')) datasets.push({ label: 'Ingresos', data: metrics.map((m) => m.revenue || 0), type: 'line', yAxisID: 'y2', borderColor: '#fbbf24', tension: 0.2, fill: false, pointBackgroundColor: '#fbbf24' });

  this.destroyAttendanceCharts();
  this.state.attendanceCharts.trend = new Chart(trendCtx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: {
        x: { stacked: true, ticks: { color: '#d4d4d8' }, grid: { color: '#3f3f46' } },
        y: { stacked: true, ticks: { color: '#a1a1aa' }, grid: { color: '#3f3f46' } },
        y1: { position: 'right', beginAtZero: true, ticks: { color: '#c4b5fd', callback: (v) => `${v}%` }, grid: { drawOnChartArea: false } },
        y2: { position: 'right', beginAtZero: true, ticks: { color: '#facc15', callback: (v) => `$${v}` }, grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { labels: { color: '#e4e4e7' } } }
    }
  });

  if (revenueCtx) {
    const revenueSeries = dataCache.aggregates?.revenueSeries || [];
    const revenueLabels = revenueSeries.map((r) => {
      const dateObj = new Date(`${r.date}T00:00:00-06:00`);
      return Number.isNaN(dateObj.getTime()) ? (r.date || '') : this.dayShortFmt.format(dateObj);
    });
    this.state.attendanceCharts.revenue = new Chart(revenueCtx, {
      type: 'bar',
      data: {
        labels: revenueLabels,
        datasets: [
          { label: 'Ingresos', data: revenueSeries.map((r) => r.revenue), backgroundColor: 'rgba(34,197,94,0.7)' },
          { label: 'Meta', data: revenueSeries.map((r) => r.target), backgroundColor: 'rgba(244,114,182,0.4)' }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: '#d4d4d8' }, grid: { color: '#3f3f46' } },
          y: { ticks: { color: '#a1a1aa', callback: (v) => `$${v}` }, grid: { color: '#3f3f46' } }
        },
        plugins: { legend: { labels: { color: '#e4e4e7' } } }
      }
    });
  }

  if (retentionCtx) {
    const retention = dataCache.aggregates?.retention || { newMembers: 0, repeatMembers: 0, retentionRate: 0 };
    this.state.attendanceCharts.retention = new Chart(retentionCtx, {
      type: 'bar',
      data: {
        labels: ['Nuevos', 'Recurrentes', 'Retención %'],
        datasets: [{ data: [retention.newMembers, retention.repeatMembers, retention.retentionRate], backgroundColor: ['rgba(59,130,246,0.6)', 'rgba(16,185,129,0.6)', 'rgba(250,204,21,0.6)'] }]
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: '#d4d4d8' }, grid: { color: '#3f3f46' } },
          y: { beginAtZero: true, ticks: { color: '#a1a1aa' }, grid: { color: '#3f3f46' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  if (popularityCtx) {
    const topClasses = (dataCache.aggregates?.popularity || []).slice(0, 8);
    const popularityLabels = topClasses.map((item) => {
      const days = Array.isArray(item.weekdays) ? item.weekdays.filter(Boolean) : [];
      const suffix = days.length ? ` (${days.join(', ')})` : '';
      return `${item.label}${suffix}`;
    });
    this.state.attendanceCharts.popularity = new Chart(popularityCtx, {
      type: 'bar',
      data: {
        labels: popularityLabels,
        datasets: [{ label: 'Popularidad', data: topClasses.map((item) => item.score), backgroundColor: 'rgba(129,140,248,0.7)' }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { ticks: { color: '#d4d4d8' }, grid: { color: '#3f3f46' } },
          y: { ticks: { color: '#d4d4d8' }, grid: { color: '#3f3f46' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  this.renderCapacityHeatmap(dataCache.aggregates?.heatmap || {});

  const renderList = (obj) => {
    const names = Object.keys(obj || {}).sort();
    if (!names.length) return '<ul class="list-disc list-inside text-zinc-400"><li>Nadie</li></ul>';
    return names
      .map((n) => {
        const people = (obj[n] || []).map((p) => `<li>${DOMPurify.sanitize(p)}</li>`).join('');
        return `
          <div class="font-semibold text-zinc-300 mt-1">${DOMPurify.sanitize(n)}:</div>
          <ul class="list-disc list-inside text-zinc-400">${people}</ul>
        `;
      })
      .join('');
  };

  details.innerHTML = dataCache.labels
    .map((l) => {
      const d = dataCache.report[l.date];
      const warnColor = d.utilizationRate > 85 ? 'text-rose-400' : d.utilizationRate > 60 ? 'text-amber-400' : 'text-emerald-400';
      const peak = Object.entries(d.peakHours || {}).sort((a, b) => b[1] - a[1])[0];
      const peakLabel = peak ? `${peak[0]} (${peak[1]} asistentes)` : '—';
      return `
        <div class="bg-zinc-900 p-3 rounded-md">
          <h4 class="font-bold text-lg mb-2">${DOMPurify.sanitize(l.label)}</h4>
          <div class="font-semibold text-blue-400">Reservaron (${d.booked || 0})</div>
          ${renderList(d.details.booked)}
          <div class="text-sm mt-2">Capacidad total: ${d.totalCapacity || 0}</div>
          <div class="text-sm">Ingresos: $${d.revenue || 0} / Meta $${d.revenueTarget || 0}</div>
          <div class="text-sm">Retención: ${d.memberRetention || 0}%</div>
          <div class="${warnColor} text-sm">${DOMPurify.sanitize(d.warning || '')}</div>
          <div class="text-sm mt-1">Hora pico: ${DOMPurify.sanitize(peakLabel)}</div>
          <div class="font-semibold text-emerald-400 mt-2">Asistieron (${d.attended || 0})</div>
          ${renderList(d.details.attended)}
          <div class="font-semibold text-rose-400 mt-2">Faltaron (${d.absent || 0})</div>
          ${renderList(d.details.absent)}
        </div>
      `;
    })
    .join('');
};
