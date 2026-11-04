// scripts/admin/generation.js
// "Completar semana": fills missing classes from the weekly template.
// Manual twin of the Saturday generateDailyClasses Cloud Function.
// RELEVANT FILES: functions/src/generateDailyClasses.js, scripts/admin/init.js, scripts/admin/class-modal.js

Object.assign(AdminPanel, {

  // --- GENERACIÓN (startAt/endAt) ---
  _buildStartEnd(dateStr, timeStr, duration=60){
    const start = new Date(`${dateStr}T${timeStr}:00-06:00`);
    const end = new Date(start.getTime() + (Number(duration||60)*60000));
    return {
      startAt: firebase.firestore.Timestamp.fromDate(start),
      endAt: firebase.firestore.Timestamp.fromDate(end),
      classDate: start.toISOString().slice(0,10),
      timeUTC: start.toISOString().slice(11,16)
    };
  },

  async generateDailyClasses(){
    if (!Object.keys(this.state.weeklySchedule).length) {
      this.showToast({ title:'Plantilla no cargada', variant:'warn' });
      return;
    }

    // We anchor the calculation to midnight in Mexico City time to avoid timezone drift.
    const todayLocalStr = this.dateHelper.today();
    const localMidnight = new Date(`${todayLocalStr}T00:00:00-06:00`);
    const todayDow = localMidnight.getUTCDay();
    const daysUntilSaturday = (6 - todayDow + 7) % 7;

    const days = [];
    for (let offset = 0; offset <= daysUntilSaturday; offset++) {
      const cursor = new Date(localMidnight.getTime() + (offset * 86400000));
      const dateStr = cursor.toISOString().slice(0,10);
      days.push({ dateStr, dow: cursor.getUTCDay() });
    }

    if (!days.length) {
      this.showToast({ title:'Sin rango válido', variant:'warn' });
      return;
    }

    const batch = this.db.batch();
    let created = 0;
    const createdList = [];

    for (const d of days){
      const tpl = this.state.weeklySchedule[String(d.dow)] || [];
      if (!tpl.length) continue;

      // We only compare against classes stored for the same calendar day.
      const existingSnap = await this.db.collection('classes')
        .where('classDate','==', d.dateStr)
        .get();
      const existingKeys = new Set(existingSnap.docs.map(x => {
        const data = x.data();
        return `${data.classDate}|${data.time}`;
      }));

      for (const c of tpl){
        const { startAt, endAt, classDate, timeUTC } = this._buildStartEnd(d.dateStr, c.time, c.duration||60);
        const classKey = `${classDate}|${timeUTC}`;
        if (existingKeys.has(classKey)) continue;

        const ref = this.db.collection('classes').doc();
        const isTRX = /trx/i.test(c.name || "");
        const capacity = (typeof c.capacity === "number") ? c.capacity : (isTRX ? 13 : 15);
        batch.set(ref,{
          name: c.name,
          time: timeUTC,
          instructor: c.instructor || 'Por Asignar',
          duration: c.duration || 60,
          classDate,
          capacity,
          enrolledCount: 0,
          startAt,
          endAt,
          description:`Clase de ${c.name}`,
          image:`https://placehold.co/400x250/1f2937/ffffff?text=${encodeURIComponent(c.name)}`
        });
        existingKeys.add(classKey);
        createdList.push({ date: d.dateStr, time: c.time, name: c.name });
        created++;
      }
    }

    if (created>0){
      await batch.commit();
      console.log('Clases generadas:', createdList);
      this.showToast({ title:'Clases generadas', message:`Se crearon ${created} clases` });
    } else {
      this.showToast({ title:'Horario al día', message:'No hay clases nuevas por crear', variant:'warn' });
    }
  },
});
