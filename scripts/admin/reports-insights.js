// scripts/admin/reports-insights.js
// Report projections, key numbers (KPIs), price per class and CSV export.
// Gives staff simple suggestions and downloadable reports.
// RELEVANT FILES: scripts/admin/reports-data.js, scripts/admin/reports-fetch.js, scripts/admin/views/reports.js

Object.assign(AdminPanel, {

  calculateCapacityProjections(){
    const data = this.state.attendanceData;
    if (!data) return null;
    const entries = data.labels.map(l=>({ date:l.date, metrics: data.report[l.date] }));
    if (!entries.length) return null;
    const utilizations = entries.map(item=>{
      const m = item.metrics;
      return typeof m.utilizationRate === 'number'
        ? m.utilizationRate
        : Math.round((m.booked/Math.max(m.totalCapacity||0,1))*100);
    });
    const avg = utilizations.reduce((sum,val)=>sum+val,0)/(utilizations.length||1);
    const first = utilizations[0] || 0;
    const last = utilizations[utilizations.length-1] || 0;
    const growthRate = utilizations.length>1 ? ((last-first)/Math.max(first||1,1)) : 0;
    const dayPattern = this.calculateDayOfWeekPatterns(data.report);
    const projectedUtilization = Math.round(avg * (1 + (growthRate/2)));
    const recommendation = this.buildCapacityRecommendations({ avgUtil:avg, growthRate, dayPattern });
    return {
      averageUtilization: Math.round(avg),
      growthRate,
      projectedUtilization,
      recommendation
    };
  },

  recommendOptimalScheduling(report){
    const suggestions = [];
    let bestDay = null;
    let bestUtil = -1;
    let lowDay = null;
    let lowUtil = Infinity;
    Object.entries(report || {}).forEach(([date,d])=>{
      const util = d.utilizationRate || 0;
      if (util > bestUtil){ bestUtil = util; bestDay = date; }
      if (util < lowUtil){ lowUtil = util; lowDay = date; }
    });
    if (bestDay) suggestions.push(`Mantener horarios fuertes en ${bestDay} (${bestUtil}% de uso).`);
    if (lowDay && lowUtil < 50) suggestions.push(`Impulsar reservas para ${lowDay} (solo ${lowUtil}% de uso).`);
    return { suggestions };
  },

  calculateCapacityVsDemand(report){
    const values = Object.values(report || {});
    if (!values.length) return { status:'Sin datos', averageUtilization:0, capacityGap:0 };
    const average = values.reduce((sum,d)=>sum+(d.utilizationRate||0),0)/values.length;
    const gap = values.reduce((sum,d)=>sum + Math.max((d.totalCapacity||0) - (d.booked||0),0),0);
    const status = average>85 ? 'Alta demanda' : average<50 ? 'Capacidad ociosa' : 'Equilibrado';
    return { status, averageUtilization: Math.round(average), capacityGap: gap };
  },

  calculateInstructorUtilization(instructorMetrics){
    const entries = Object.entries(instructorMetrics || {});
    if (!entries.length) return { leaders:[], underutilized:[] };
    const sorted = entries.sort((a,b)=> (b[1].avgUtilization||0) - (a[1].avgUtilization||0));
    const leaders = sorted.slice(0,3).map(([name])=>name);
    const underutilized = sorted.filter(([,metrics])=> (metrics.avgUtilization||0) < 50).map(([name])=>name);
    return { leaders, underutilized };
  },

  calculateDayOfWeekPatterns(report){
    const map = {};
    Object.entries(report || {}).forEach(([date,d])=>{
      const base = new Date(`${date}T00:00:00-06:00`);
      if (Number.isNaN(base.getTime())) return;
      const dow = base.getDay();
      if (!map[dow]) map[dow] = { utilization:0, count:0 };
      map[dow].utilization += d.utilizationRate || 0;
      map[dow].count += 1;
    });
    const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const averages = Object.entries(map).map(([dow,data])=>{
      const avg = data.count ? data.utilization/data.count : 0;
      return { day:names[dow], value: Math.round(avg) };
    }).sort((a,b)=>b.value-a.value);
    return { averages, topDays: averages.slice(0,2).map(item=>item.day) };
  },

  // Tips based on average occupancy and the busiest weekdays of the selected range.
  buildCapacityRecommendations({ avgUtil, dayPattern }){
    const suggestions = [];
    if (avgUtil>85) suggestions.push('Agregar clases o ampliar cupos en horarios de alta demanda.');
    if (avgUtil<50) suggestions.push('Impulsar campañas de retención y promociones para elevar la ocupación.');
    if (dayPattern?.topDays?.length){
      suggestions.push(`Mayor demanda en ${dayPattern.topDays.join(' y ')}.`);
    }
    return { summary: suggestions[0] || 'Seguimiento normal', suggestions };
  },

  // Update report with current bookings before rendering
  injectBookingsIntoReport(){
    const data = this.state.attendanceData;
    if (!data) return;
    const aggregateContext = {
      classPopularity: new Map(),
      heatmap: {},
      instructorTotals: {},
      totals: { revenue:0, target:0, repeat:0, newMembers:0, cancellations:0, noShows:0 }
    };
    const { report, classesByDay, bookingsByClass, userStats, cancellationsByDay } = data;
    Object.keys(report).forEach(day=>{
      const classList = (classesByDay && classesByDay[day]) || [];
      report[day] = this.calculateDaySnapshot({
        day,
        base: report[day],
        classList,
        bookingsByClass,
        userStats,
        cancellationsByDay,
        aggregates: aggregateContext
      });
    });
    data.aggregates = this.buildAttendanceAggregates({ labels: data.labels, report, aggregateContext, userStats });
  },

  // One CSV with the same period and filters as the charts (Periodo, Tipo de clase, Instructor).
  exportCapacityReport(){
    const data = this.state.attendanceData;
    if (!data) return;
    const start = document.getElementById('att-start-date')?.value || 'inicio';
    const end = document.getElementById('att-end-date')?.value || 'fin';
    const rows = [['Fecha inicio','Periodo','Asistieron','Faltaron','Reservaron','Capacidad','Utilización %','Ingresos estimados','Meta','Retención %']];
    this.aggregateReportByPeriod(data, this.state.selectedPeriod).forEach(({ key, label, data: d }) => {
      rows.push([key, label, d.attended, d.absent, d.booked, d.totalCapacity, d.utilizationRate, d.revenue, d.revenueTarget, d.memberRetention]);
    });
    this.downloadCSV(`reporte-${start}-a-${end}.csv`, rows);
  },

  // Four headline numbers for the selected dates and filters, shown above the charts.
  renderReportKpis(){
    const el = document.getElementById('report-kpis');
    const data = this.state.attendanceData;
    if (!el || !data) return;
    const days = data.labels.map(l => data.report[l.date]).filter(Boolean);
    const sum = key => days.reduce((total, d) => total + (Number(d[key]) || 0), 0);
    const attended = sum('attended');
    const absent = sum('absent');
    const booked = sum('booked');
    const capacity = sum('totalCapacity');
    const revenue = sum('revenue');
    const pct = (part, whole) => whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
    const tiles = [
      ['Asistencia', pct(attended, attended + absent), `${attended} de ${attended + absent} con asistencia registrada`],
      ['Uso de capacidad', pct(booked, capacity), `${booked} reservas / ${capacity} lugares`],
      ['No-shows', String(absent), 'Reservaron y faltaron'],
      ['Ingresos estimados', `$${revenue.toLocaleString('es-MX')}`, `Con $${this.DEFAULT_TICKET_PRICE} por clase`]
    ];
    el.innerHTML = tiles.map(([label, value, hint]) => `
      <div class="admin-kpi">
        <p class="admin-kpi-label">${label}</p>
        <p class="admin-kpi-value">${value}</p>
        <p class="admin-kpi-hint">${hint}</p>
      </div>`).join('');
  },

  // Price per class for "Ingresos estimados". Stored in appSettings/reports so every admin
  // sees the same number. 120 is used until someone saves a price (or if the read fails).
  setupTicketPrice(){
    const input = document.getElementById('att-ticket-price');
    if (!input) return;
    input.value = this.DEFAULT_TICKET_PRICE;
    input.addEventListener('change', async () => {
      const price = Number(input.value);
      if (!(price > 0)){ input.value = this.DEFAULT_TICKET_PRICE; return; }
      try {
        // The live listener below applies the new price and redraws the report.
        await this.db.collection('appSettings').doc('reports').set({ ticketPrice: price }, { merge: true });
        this.showToast({ title: 'Precio guardado', message: `Ingresos estimados con $${price} por clase.` });
      } catch (e) {
        input.value = this.DEFAULT_TICKET_PRICE;
        this.showToast({ title: 'No se pudo guardar el precio', message: e.message, variant: 'error' });
      }
    });
  },

  // Called after admin login. One document, so it costs one read plus one per change.
  listenTicketPrice(){
    this.stopTicketPrice();
    this.state.unsubTicketPrice = this.db.collection('appSettings').doc('reports').onSnapshot(snap => {
      const saved = Number(snap.data()?.ticketPrice);
      this.DEFAULT_TICKET_PRICE = saved > 0 ? saved : 120;
      const input = document.getElementById('att-ticket-price');
      if (input) input.value = this.DEFAULT_TICKET_PRICE;
      // Revenue is recalculated from the cached report; no new report reads.
      this.renderAttendanceDashboardFromCache();
    }, err => console.error('No se pudo leer el precio por clase', err));
  },

  stopTicketPrice(){
    if (this.state.unsubTicketPrice) this.state.unsubTicketPrice();
    this.state.unsubTicketPrice = null;
  },

  downloadCSV(filename, rows){
    const csv = rows.map(row=>row.map(val=>`"${String(val ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
});
