// /scripts/admin/admin-attendance-status.js
// Updates live stats widgets and handles CSV exports for attendance analytics
// Keeps auxiliary dashboard actions decoupled from the main chart rendering module
// RELEVANT FILES: scripts/admin/admin-attendance-dashboard.js, scripts/admin/admin-attendance-insights.js, scripts/admin/admin-state.js

import { AdminPanel } from './admin-state.js';

AdminPanel.updateAttendanceLegend = function updateAttendanceLegend() {
  const lastEl = document.getElementById('att-last');
  const nextEl = document.getElementById('att-next');
  if (!lastEl || !nextEl) return;
  if (this.state.attendanceLastAt) {
    const fmt = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
    lastEl.textContent = `Última actualización: ${fmt.format(new Date(this.state.attendanceLastAt))}`;
  } else {
    lastEl.textContent = 'Última actualización: —';
  }
  nextEl.textContent = 'Actualización en vivo';
};

AdminPanel.updateCapacityGauge = function updateCapacityGauge() {
  const fill = document.getElementById('capacity-gauge-fill');
  const trendEl = document.getElementById('capacity-trend');
  const alertEl = document.getElementById('capacity-alert');
  const compareEl = document.getElementById('capacity-compare');
  const projectionEl = document.getElementById('capacity-projection');
  if (!fill || !this.state.attendanceData) return;
  const today = this.dateHelper.today();
  const d = this.state.attendanceData.report[today];
  const fallbackRate = d ? Math.round((d.booked / Math.max(d.totalCapacity || 0, 1)) * 100) : 0;
  const rate = d ? (d.utilizationRate ?? fallbackRate) : 0;
  fill.style.width = `${Math.min(rate, 100)}%`;
  fill.classList.remove('bg-emerald-500', 'bg-amber-500', 'bg-rose-500');
  if (rate > 85) fill.classList.add('bg-rose-500');
  else if (rate > 60) fill.classList.add('bg-amber-500');
  else fill.classList.add('bg-emerald-500');

  const projections = this.calculateCapacityProjections();
  if (trendEl && projections) {
    const pct = Math.round((projections.growthRate || 0) * 100);
    trendEl.textContent = pct > 0 ? `▲ ${pct}%` : pct < 0 ? `▼ ${Math.abs(pct)}%` : 'Estable';
  }
  if (alertEl) {
    alertEl.textContent = projections?.recommendation?.summary || (rate > 90 ? 'Sobrecapacidad' : rate > 80 ? 'Monitorear' : 'Normal');
  }
  if (compareEl) {
    const prevDate = new Date(`${today}T00:00:00-06:00`);
    if (!Number.isNaN(prevDate.getTime())) {
      prevDate.setDate(prevDate.getDate() - 7);
      const prevKey = this.dateHelper.ymd(prevDate);
      const prevData = this.state.attendanceData.report[prevKey];
      const prevRate = prevData ? (prevData.utilizationRate ?? Math.round((prevData.booked / Math.max(prevData.totalCapacity || 0, 1)) * 100)) : 0;
      const diff = rate - prevRate;
      compareEl.textContent = `${diff >= 0 ? '+' : ''}${diff}% vs semana pasada`;
    } else {
      compareEl.textContent = '—';
    }
  }
  if (projectionEl && projections) {
    projectionEl.textContent = `${Math.round(projections.projectedUtilization || projections.averageUtilization || 0)}% esperado`;
  }
};

AdminPanel.exportCapacityReport = function exportCapacityReport() {
  const data = this.state.attendanceData;
  if (!data) return;
  const format = this.state.selectedExportFormat || 'capacity';
  const { report, aggregates, userStats } = data;
  const start = document.getElementById('att-start-date')?.value || 'inicio';
  const end = document.getElementById('att-end-date')?.value || 'fin';
  let rows = [];
  if (format === 'capacity') {
    rows = [['Fecha', 'Asistieron', 'Faltaron', 'Reservaron', 'Capacidad', 'Utilización %', 'Ingresos', 'Meta', 'Retención %']];
    Object.entries(report).forEach(([date, d]) => {
      rows.push([date, d.attended, d.absent, d.booked, d.totalCapacity, d.utilizationRate, d.revenue, d.revenueTarget, d.memberRetention]);
    });
  } else if (format === 'demographics') {
    rows = [['Usuario', 'Reservas', 'Primer ingreso', 'Ingresos estimados', 'Cancelaciones']];
    if (userStats instanceof Map) {
      userStats.forEach((stat, key) => {
        rows.push([key, stat.count, stat.firstDate || '', stat.revenue || 0, stat.cancellations || 0]);
      });
    }
  } else if (format === 'instructors') {
    rows = [['Instructor', 'Clases', 'Asistentes', 'Utilización promedio %']];
    Object.entries(aggregates?.instructorMetrics || {}).forEach(([name, metrics]) => {
      rows.push([name, metrics.classes, metrics.attendees, metrics.avgUtilization]);
    });
  } else if (format === 'revenue') {
    const projection = this.calculateCapacityProjections();
    rows = [['Fecha', 'Ingresos', 'Meta', 'Pronóstico %']];
    (aggregates?.revenueSeries || []).forEach((item) => {
      rows.push([item.date, item.revenue, item.target, projection?.projectedUtilization || 0]);
    });
  } else if (format === 'optimization') {
    rows = [['Recomendación', 'Detalle']];
    this.buildOptimizationRows(aggregates).forEach((pair) => rows.push(pair));
  } else if (format === 'custom-range') {
    const totals = aggregates?.totals || {};
    rows = [
      ['Indicador', 'Valor'],
      ['Ingresos totales', totals.revenue || 0],
      ['Meta de ingresos', totals.target || 0],
      ['Retención promedio %', aggregates?.retention?.retentionRate || 0],
      ['Cancelaciones', totals.cancellations || 0],
      ['No shows', totals.noShows || 0],
      ['Periodo', `${start} a ${end}`]
    ];
  } else {
    return;
  }
  const filename = `reporte-${format}-${start}-a-${end}.csv`;
  this.downloadCSV(filename, rows);
};

AdminPanel.downloadCSV = function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
