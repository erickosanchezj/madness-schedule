// /scripts/admin/admin-attendance-insights.js
// Derives higher-level insights from attendance aggregates (projections, recommendations, LTV)
// Keeps analytical helpers modular so dashboards and exports can stay focused on UI work
// RELEVANT FILES: scripts/admin/admin-attendance-dashboard.js, scripts/admin/admin-attendance-calculations.js, scripts/admin/admin-state.js

import { AdminPanel } from './admin-state.js';

AdminPanel.calculateCapacityProjections = function calculateCapacityProjections() {
  const data = this.state.attendanceData;
  if (!data) return null;
  const entries = data.labels.map((l) => ({ date: l.date, metrics: data.report[l.date] }));
  if (!entries.length) return null;
  const utilizations = entries.map((item) => {
    const m = item.metrics;
    return typeof m.utilizationRate === 'number'
      ? m.utilizationRate
      : Math.round((m.booked / Math.max(m.totalCapacity || 0, 1)) * 100);
  });
  const avg = utilizations.reduce((sum, val) => sum + val, 0) / (utilizations.length || 1);
  const first = utilizations[0] || 0;
  const last = utilizations[utilizations.length - 1] || 0;
  const growthRate = utilizations.length > 1 ? ((last - first) / Math.max(first || 1, 1)) : 0;
  const dayPattern = this.calculateDayOfWeekPatterns(data.report);
  const seasonal = this.calculateSeasonalTrend(entries);
  const projectedUtilization = Math.round(avg * (1 + (growthRate / 2)));
  const revenueForecast = this.forecastRevenue(data.aggregates?.revenueSeries || []);
  const recommendation = this.buildCapacityRecommendations({ avgUtil: avg, growthRate, dayPattern });
  return {
    averageUtilization: Math.round(avg),
    growthRate,
    projectedUtilization,
    topDays: dayPattern.topDays,
    seasonal,
    revenueForecast,
    recommendation
  };
};

AdminPanel.calculateMemberLifetimeValue = function calculateMemberLifetimeValue({ userStats }) {
  const stats = userStats instanceof Map ? userStats : new Map();
  let members = 0;
  let revenue = 0;
  stats.forEach((stat) => {
    members += 1;
    revenue += stat.revenue || (stat.count * this.DEFAULT_TICKET_PRICE);
  });
  const estimatedLTV = members ? Math.round(revenue / members) : 0;
  return { estimatedLTV, members };
};

AdminPanel.analyzeClassProfitability = function analyzeClassProfitability(popularity, report) {
  const topClasses = (popularity || []).slice(0, 5).map((item) => ({ class: item.label, score: item.score }));
  const totalRevenue = Object.values(report || {}).reduce((sum, d) => sum + (d.revenue || 0), 0);
  return { topClasses, totalRevenue };
};

AdminPanel.recommendOptimalScheduling = function recommendOptimalScheduling(report) {
  const suggestions = [];
  let bestDay = null;
  let bestUtil = -1;
  let lowDay = null;
  let lowUtil = Infinity;
  Object.entries(report || {}).forEach(([date, d]) => {
    const util = d.utilizationRate || 0;
    if (util > bestUtil) {
      bestUtil = util;
      bestDay = date;
    }
    if (util < lowUtil) {
      lowUtil = util;
      lowDay = date;
    }
  });
  if (bestDay) suggestions.push(`Mantener horarios fuertes en ${bestDay} (${bestUtil}% de uso).`);
  if (lowDay && lowUtil < 50) suggestions.push(`Impulsar reservas para ${lowDay} (solo ${lowUtil}% de uso).`);
  return { suggestions };
};

AdminPanel.calculateCapacityVsDemand = function calculateCapacityVsDemand(report) {
  const values = Object.values(report || {});
  if (!values.length) return { status: 'Sin datos', averageUtilization: 0, capacityGap: 0 };
  const average = values.reduce((sum, d) => sum + (d.utilizationRate || 0), 0) / values.length;
  const gap = values.reduce((sum, d) => sum + Math.max((d.totalCapacity || 0) - (d.booked || 0), 0), 0);
  const status = average > 85 ? 'Alta demanda' : average < 50 ? 'Capacidad ociosa' : 'Equilibrado';
  return { status, averageUtilization: Math.round(average), capacityGap: gap };
};

AdminPanel.calculateInstructorUtilization = function calculateInstructorUtilization(instructorMetrics) {
  const entries = Object.entries(instructorMetrics || {});
  if (!entries.length) return { leaders: [], underutilized: [] };
  const sorted = entries.sort((a, b) => (b[1].avgUtilization || 0) - (a[1].avgUtilization || 0));
  const leaders = sorted.slice(0, 3).map(([name]) => name);
  const underutilized = sorted.filter(([, metrics]) => (metrics.avgUtilization || 0) < 50).map(([name]) => name);
  return { leaders, underutilized };
};

AdminPanel.calculateDayOfWeekPatterns = function calculateDayOfWeekPatterns(report) {
  const map = {};
  Object.entries(report || {}).forEach(([date, d]) => {
    const base = new Date(`${date}T00:00:00-06:00`);
    if (Number.isNaN(base.getTime())) return;
    const dow = base.getDay();
    if (!map[dow]) map[dow] = { utilization: 0, count: 0 };
    map[dow].utilization += d.utilizationRate || 0;
    map[dow].count += 1;
  });
  const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const averages = Object.entries(map)
    .map(([dow, data]) => ({ day: names[dow], value: Math.round(data.count ? data.utilization / data.count : 0) }))
    .sort((a, b) => b.value - a.value);
  return { averages, topDays: averages.slice(0, 2).map((item) => item.day) };
};

AdminPanel.calculateSeasonalTrend = function calculateSeasonalTrend(entries) {
  if (!entries.length) return { trend: 'Sin datos', change: 0 };
  const half = Math.max(1, Math.floor(entries.length / 2));
  const firstAvg = entries.slice(0, half).reduce((sum, item) => sum + (item.metrics.utilizationRate || 0), 0) / half;
  const secondAvg = entries.slice(-half).reduce((sum, item) => sum + (item.metrics.utilizationRate || 0), 0) / half;
  const diff = secondAvg - firstAvg;
  const trend = diff > 3 ? 'Alza' : diff < -3 ? 'Baja' : 'Estable';
  return { trend, change: Math.round(diff) };
};

AdminPanel.forecastRevenue = function forecastRevenue(series) {
  if (!Array.isArray(series) || !series.length) return 0;
  const revenues = series.map((item) => item.revenue || 0);
  const diffs = revenues.slice(1).map((value, idx) => value - revenues[idx]);
  const avgDiff = diffs.length ? diffs.reduce((sum, val) => sum + val, 0) / diffs.length : 0;
  return Math.round((revenues[revenues.length - 1] || 0) + avgDiff);
};

AdminPanel.buildCapacityRecommendations = function buildCapacityRecommendations({ avgUtil, growthRate, dayPattern }) {
  const suggestions = [];
  if (avgUtil > 85) suggestions.push('Agregar clases o ampliar cupos en horarios de alta demanda.');
  if (avgUtil < 50) suggestions.push('Impulsar campañas de retención y promociones para elevar la ocupación.');
  if (growthRate > 0.1) suggestions.push('Planear expansión de horarios ante el crecimiento sostenido.');
  if (growthRate < -0.1) suggestions.push('Investigar cancelaciones y ajustar oferta para recuperar demanda.');
  if (dayPattern?.topDays?.length) suggestions.push(`Mayor demanda en ${dayPattern.topDays.join(' y ')}.`);
  return { summary: suggestions[0] || 'Seguimiento normal', suggestions };
};

AdminPanel.buildOptimizationRows = function buildOptimizationRows(aggregates) {
  const rows = [];
  const bi = aggregates?.bi || {};
  const schedule = bi.optimalScheduling?.suggestions || [];
  const capacity = bi.capacityVsDemand?.status;
  const instructors = bi.instructorUtilization || {};
  schedule.forEach((text) => rows.push(['Horario', text]));
  if (capacity) rows.push(['Capacidad vs demanda', capacity]);
  if (Array.isArray(instructors.leaders) && instructors.leaders.length) rows.push(['Instructores top', instructors.leaders.join(' | ')]);
  if (Array.isArray(instructors.underutilized) && instructors.underutilized.length) rows.push(['Instructores con espacio', instructors.underutilized.join(' | ')]);
  if (!rows.length) rows.push(['Resumen', 'Sin recomendaciones registradas']);
  return rows;
};
