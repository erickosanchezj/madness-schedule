// scripts/admin/reports-fetch.js
// Report data loading for the chosen range, live refresh and the capacity gauge.
// Reads attendance, classes and bookings for the report.
// RELEVANT FILES: scripts/admin/reports-data.js, scripts/admin/reports-charts.js, scripts/admin/init.js

Object.assign(AdminPanel, {

  // ====== ASISTENCIA (POLLING CADA 15 MIN) ======
  getDefaultAttendanceRange(){
    const today = this.dateHelper.today();
    const end = new Date(`${today}T00:00:00-06:00`);
    const start = new Date(end);
    start.setDate(start.getDate()-2);
    return { start: this.dateHelper.ymd(start), end: this.dateHelper.ymd(end) };
  },
  getSelectedAttendanceRange(){
    const def = this.getDefaultAttendanceRange();
    const sEl = document.getElementById('att-start-date');
    const eEl = document.getElementById('att-end-date');
    let start = sEl?.value;
    let end = eEl?.value;
    if (!start || !end || start > end){
      start = def.start;
      end = def.end;
      if (sEl) sEl.value = start;
      if (eEl) eEl.value = end;
    }
    return { start, end };
  },

  startAttendancePolling(){
    this.stopAttendancePolling();
    this.fetchAttendanceData(true);
    this.state.attendanceTickTimer = setInterval(()=>{ this.updateAttendanceLegend(); }, 1000);
  },
  stopAttendancePolling(){
    if (this.state.unsubCapacity){ this.state.unsubCapacity(); this.state.unsubCapacity=null; }
    this.state.attendanceRangeKey = '';
    if (this.state.attendanceTickTimer){ clearInterval(this.state.attendanceTickTimer); this.state.attendanceTickTimer=null; }
  },

  async fetchAttendanceData(){
    this.showDashboardSkeletons();
    const now = Date.now();
    const { start, end } = this.getSelectedAttendanceRange();
    this.ensureAttendanceScopedListener(start, end);
    const report = {};
    const labels = [];
    const aggregateContext = {
      classPopularity: new Map(),
      heatmap: {},
      instructorTotals: {},
      totals: { revenue:0, target:0, repeat:0, newMembers:0, cancellations:0, noShows:0 }
    };
    const userStatsMap = new Map();
    const cancellationsByDay = {};
    const startDate = new Date(`${start}T00:00:00-06:00`);
    const endDate = new Date(`${end}T00:00:00-06:00`);
    for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate()+1)){
      const clone = new Date(dt);
      const dayKey = this.dateHelper.ymd(clone);
      report[dayKey] = {
        attended:0, absent:0, booked:0, totalCapacity:0, utilizationRate:0, warning:'',
        details:{ attended:{}, absent:{}, booked:{} },
        revenue:0, revenueTarget:0, repeatBookings:0, newMembers:0,
        cancellations:0, noShows:0, popularityScore:0,
        instructorMetrics:{}, peakHours:{}, memberRetention:0
      };
      labels.push({ date: dayKey, label: this.dayShortFmt.format(clone) });
    }
    try {
      const [attendanceSnap, classesSnap, bookingsSnap] = await Promise.all([
        this.db.collection('attendance')
          .where('classDate','>=',start)
          .where('classDate','<=',end)
          .get(),
        this.db.collection('classes')
          .where('classDate','>=',start)
          .where('classDate','<=',end)
          .get(),
        this.db.collection('bookings')
          .where('classDate','>=',start)
          .where('classDate','<=',end)
          .get()
      ]);

      attendanceSnap.forEach(doc=>{
        const rec = doc.data();
        if (!rec.classDate || !report[rec.classDate]) return;
        const cat = rec.status==='attended' ? 'attended' : 'absent';
        report[rec.classDate][cat]++;
        const labelBase = rec.classTime ?? rec.className ?? '';
        const key = `${labelBase} - ${rec.className || ''}`.trim();
        if (!report[rec.classDate].details[cat][key]) report[rec.classDate].details[cat][key] = [];
        report[rec.classDate].details[cat][key].push(rec.userName || rec.userId || 'Anónimo');
      });

      const classesByDay = {};
      classesSnap.forEach(doc=>{
        const data = { id:doc.id, ...doc.data() };
        if (!data.classDate || !report[data.classDate]) return;
        if (data.classDate && data.time){
          const startAt = new Date(`${data.classDate}T${data.time}:00Z`);
          data.localDate = this.dateHelper.ymd(startAt);
          data.localTime = this.timeFmt.format(startAt);
        }
        if (!classesByDay[data.classDate]) classesByDay[data.classDate] = [];
        classesByDay[data.classDate].push(data);
      });

      const listenerClassesByDay = {};
      this.state.classes.forEach(cls=>{
        const day = cls.localDate || cls.classDate;
        if (!day || !report[day]) return;
        if (!listenerClassesByDay[day]) listenerClassesByDay[day] = [];
        listenerClassesByDay[day].push({ ...cls });
      });

      const bookingsByClass = {};
      bookingsSnap.forEach(doc=>{
        const data = { id:doc.id, ...doc.data() };
        if (!data.classId) return;
        if (!bookingsByClass[data.classId]) bookingsByClass[data.classId] = [];
        bookingsByClass[data.classId].push(data);
        const userKey = data.userId || data.userEmail || data.userName || data.id;
        if (!userStatsMap.has(userKey)){
          userStatsMap.set(userKey,{ count:0, firstDate:data.classDate || '', revenue:0, cancellations:0 });
        }
        const stat = userStatsMap.get(userKey);
        stat.count += 1;
        if (data.classDate && (!stat.firstDate || data.classDate < stat.firstDate)) stat.firstDate = data.classDate;
        stat.revenue += this.estimateClassRevenue({ price:data.price },1);
        if ((data.status && data.status==='cancelled') || data.cancelledAt){
          stat.cancellations = (stat.cancellations||0)+1;
          if (data.classDate){ cancellationsByDay[data.classDate] = (cancellationsByDay[data.classDate]||0)+1; }
        }
      });

      const effectiveClassesByDay = {};
      Object.keys(report).forEach(day=>{
        if (classesByDay[day]?.length){
          effectiveClassesByDay[day] = classesByDay[day];
        } else if (listenerClassesByDay[day]?.length){
          effectiveClassesByDay[day] = listenerClassesByDay[day];
        } else {
          effectiveClassesByDay[day] = [];
        }
      });

      Object.entries(effectiveClassesByDay).forEach(([day, classList])=>{
        const base = report[day];
        if (!base) return;
        report[day] = this.calculateDaySnapshot({
          day,
          base,
          classList,
          bookingsByClass,
          userStats: userStatsMap,
          cancellationsByDay,
          aggregates: aggregateContext
        });
      });

      const aggregates = this.buildAttendanceAggregates({ labels, report, aggregateContext, userStats: userStatsMap });

      this.state.attendanceData = {
        report,
        labels,
        classesByDay: effectiveClassesByDay,
        bookingsByClass,
        userStats: userStatsMap,
        cancellationsByDay,
        aggregates
      };
      this.state.attendanceLastAt = now;
      this.updateAttendanceLegend();
    } catch(e){
      console.error('Error leyendo asistencia:', e);
    } finally {
      this.restoreDashboardContainers();
      this.renderAttendanceDashboardFromCache();
      if (this.state.attendanceData){
        this.updateCapacityGauge();
      }
    }
  },
  ensureAttendanceScopedListener(start, end){
    const rangeKey = `${start}__${end}`;
    if (this.state.attendanceRangeKey === rangeKey && this.state.unsubCapacity){
      return;
    }
    if (this.state.unsubCapacity){
      this.state.unsubCapacity();
      this.state.unsubCapacity = null;
    }
    this.state.attendanceRangeKey = rangeKey;
    this.state.unsubCapacity = this.db.collection('bookings')
      .where('classDate', '>=', start)
      .where('classDate', '<=', end)
      .onSnapshot(()=>{
        this.fetchAttendanceData(true);
      });
  },

  updateAttendanceLegend(){
    const lastEl = document.getElementById('att-last');
    if (!lastEl) return;
    if (this.state.attendanceLastAt){
      const fmt = new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit'});
      lastEl.textContent = `Última actualización: ${fmt.format(new Date(this.state.attendanceLastAt))}`;
    } else lastEl.textContent = 'Última actualización: Sin datos';
  },

  // Today's occupancy bar plus one recommendation for the selected range.
  updateCapacityGauge(){
    const fill = document.getElementById('capacity-gauge-fill');
    const todayEl = document.getElementById('capacity-today');
    const alertEl = document.getElementById('capacity-alert');
    if (!fill || !this.state.attendanceData) return;
    const d = this.state.attendanceData.report[this.dateHelper.today()];
    const rate = d ? (d.utilizationRate ?? Math.round((d.booked/Math.max(d.totalCapacity||0,1))*100)) : 0;
    fill.style.width = Math.min(rate,100)+'%';
    fill.classList.remove('bg-emerald-500','bg-amber-500','bg-rose-500');
    if (rate>85) fill.classList.add('bg-rose-500');
    else if (rate>60) fill.classList.add('bg-amber-500');
    else fill.classList.add('bg-emerald-500');
    if (todayEl){
      todayEl.textContent = d ? `${rate}% (${d.booked||0} de ${d.totalCapacity||0} lugares)` : 'Hoy no está en el rango elegido';
    }
    if (alertEl){
      alertEl.textContent = this.calculateCapacityProjections()?.recommendation?.summary || 'Seguimiento normal';
    }
  },
});
