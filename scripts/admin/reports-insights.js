// scripts/admin/reports-insights.js
// Report projections, recommendations and CSV export.
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

  buildCapacityRecommendations({ avgUtil, growthRate, dayPattern }){
    const suggestions = [];
    if (avgUtil>85) suggestions.push('Agregar clases o ampliar cupos en horarios de alta demanda.');
    if (avgUtil<50) suggestions.push('Impulsar campañas de retención y promociones para elevar la ocupación.');
    if (growthRate>0.1) suggestions.push('Planear expansión de horarios ante el crecimiento sostenido.');
    if (growthRate<-0.1) suggestions.push('Investigar cancelaciones y ajustar oferta para recuperar demanda.');
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

  exportCapacityReport(){
    const data = this.state.attendanceData;
    if (!data) return;
    const format = this.state.selectedExportFormat || 'capacity';
    const { report, aggregates, userStats } = data;
    const start = document.getElementById('att-start-date')?.value || 'inicio';
    const end = document.getElementById('att-end-date')?.value || 'fin';
    let rows = [];
    if (format === 'capacity'){
      rows = [['Fecha','Asistieron','Faltaron','Reservaron','Capacidad','Utilización %','Ingresos estimados','Meta','Retención %']];
      Object.entries(report).forEach(([date,d])=>{
        rows.push([date,d.attended,d.absent,d.booked,d.totalCapacity,d.utilizationRate,d.revenue,d.revenueTarget,d.memberRetention]);
      });
    } else if (format === 'demographics'){
      rows = [['Usuario','Reservas','Primer ingreso','Ingresos estimados','Cancelaciones']];
      if (userStats instanceof Map){
        userStats.forEach((stat,key)=>{
          rows.push([key,stat.count,stat.firstDate||'',stat.revenue||0,stat.cancellations||0]);
        });
      }
    } else if (format === 'instructors'){
      rows = [['Instructor','Clases','Asistentes','Utilización promedio %']];
      Object.entries(aggregates?.instructorMetrics || {}).forEach(([name,metrics])=>{
        rows.push([name,metrics.classes,metrics.attendees,metrics.avgUtilization]);
      });
    } else if (format === 'revenue'){
      const projection = this.calculateCapacityProjections();
      rows = [['Fecha','Ingresos estimados','Meta','Pronóstico %']];
      (aggregates?.revenueSeries || []).forEach(item=>{
        rows.push([item.date,item.revenue,item.target,projection?.projectedUtilization||0]);
      });
    } else if (format === 'optimization'){
      rows = [['Recomendación','Detalle']];
      this.buildOptimizationRows(aggregates).forEach(pair=>rows.push(pair));
    } else if (format === 'custom-range'){
      const totals = aggregates?.totals || {};
      rows = [['Indicador','Valor'],
        ['Ingresos estimados totales', totals.revenue||0],
        ['Meta de ingresos', totals.target||0],
        ['Retención promedio %', aggregates?.retention?.retentionRate||0],
        ['Cancelaciones', totals.cancellations||0],
        ['No shows', totals.noShows||0],
        ['Periodo', `${start} a ${end}`]
      ];
    } else {
      return;
    }
    const filename = `reporte-${format}-${start}-a-${end}.csv`;
    this.downloadCSV(filename, rows);
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

  buildOptimizationRows(aggregates){
    const rows = [];
    const bi = aggregates?.bi || {};
    const schedule = bi.optimalScheduling?.suggestions || [];
    const capacity = bi.capacityVsDemand?.status;
    const instructors = bi.instructorUtilization || {};
    schedule.forEach(text=>rows.push(['Horario', text]));
    if (capacity) rows.push(['Capacidad vs demanda', capacity]);
    if (Array.isArray(instructors.leaders) && instructors.leaders.length){
      rows.push(['Instructores top', instructors.leaders.join(' | ')]);
    }
    if (Array.isArray(instructors.underutilized) && instructors.underutilized.length){
      rows.push(['Instructores con espacio', instructors.underutilized.join(' | ')]);
    }
    if (!rows.length){
      rows.push(['Resumen','Sin recomendaciones registradas']);
    }
    return rows;
  },
});
