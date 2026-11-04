// scripts/admin/class-crud.js
// Save and delete classes, plus the attendance tab (load and save).
// Writes class and attendance changes to Firestore.
// RELEVANT FILES: scripts/admin/class-modal.js, scripts/admin/manual-bookings.js, firestore.rules

Object.assign(AdminPanel, {

  // ---- CRUD Clase ----
  async saveClass(){
    const id = document.getElementById('class-id').value.trim();

    if (!id){
      await this.createClass();
      return;
    }

    const name = document.getElementById('class-name').value.trim();
    const instructor = document.getElementById('class-instructor').value.trim();
    const description = document.getElementById('class-description').value.trim();
    const imageInput = document.getElementById('class-image').value.trim();
    const timeInputEl = document.getElementById('class-time');
    const timeInputValue = (timeInputEl?.value || '').trim();
    const dateInputEl = document.getElementById('class-date');
    const dateInputValue = (dateInputEl?.value || '').trim();
    const capacityRaw = Number(document.getElementById('class-capacity').value);
    const durationEl = document.getElementById('class-duration');
    const durationRaw = Number(durationEl?.value);
    const enrolledEl = document.getElementById('class-enrolled');

    try{
      const cls = this.state.classes.find(c=>c.id===id);
      if (!cls){
        this.showToast({ title:'Clase no encontrada', message:'No pudimos ubicar la clase seleccionada.', variant:'error' });
        return;
      }

      const baseDate = (cls.classDate && cls.time) ? new Date(`${cls.classDate}T${cls.time}:00Z`) : null;
      const currentDateLocal = cls.localDate || (baseDate ? this.dateHelper.ymd(baseDate) : '');
      let currentTimeLocal = cls.localTime || '';
      if (!currentTimeLocal && baseDate){
        currentTimeLocal = this.timeFmt.format(baseDate);
      }
      const originalDuration = Number(cls.duration || 60);

      const effectiveDate = dateInputValue || currentDateLocal;
      const effectiveTime = timeInputValue || currentTimeLocal;
      const capacityBase = Number.isFinite(capacityRaw) ? capacityRaw : Number(cls.capacity || 15) || 15;
      const durationBase = Number.isFinite(durationRaw) ? durationRaw : originalDuration || 60;
      const capacity = Math.max(1, Math.min(30, Math.round(capacityBase)));
      const duration = Math.max(30, Math.min(960, Math.round(durationBase)));

      if (!name || !effectiveTime || !effectiveDate){
        this.showToast({ title:'Campos requeridos', message:'Nombre, hora y fecha son obligatorios', variant:'error' });
        return;
      }

      const data = {
        name,
        instructor: instructor || 'Por Asignar',
        description,
        image: imageInput,
        capacity,
        duration
      };

      if (!data.image){
        data.image = cls.image || `https://placehold.co/400x250/1f2937/ffffff?text=${encodeURIComponent(name)}`;
      }

      if (enrolledEl){
        const enrolledCount = Number(enrolledEl.value);
        if (Number.isFinite(enrolledCount)) data.enrolledCount = enrolledCount;
      }

      const wantsScheduleChange = (
        (effectiveDate && effectiveDate !== currentDateLocal) ||
        (effectiveTime && effectiveTime !== currentTimeLocal) ||
        (duration !== originalDuration)
      );

      let canApplyScheduleChange = wantsScheduleChange;

      if (wantsScheduleChange){
        try{
          const attSnap = await this.db.collection('attendance').where('classId','==',id).limit(1).get();
          if (!attSnap.empty){
            canApplyScheduleChange = false;
            if (timeInputEl) timeInputEl.value = currentTimeLocal;
            if (dateInputEl) dateInputEl.value = currentDateLocal;
            if (enrolledEl) enrolledEl.value = Number.isFinite(cls.enrolledCount) ? cls.enrolledCount : enrolledEl.value;
            if (durationEl) durationEl.value = originalDuration;
            await this.refreshClassTimeLock(cls);
            this.showToast({ title:'Hora bloqueada', message:'Esta clase ya tiene asistencia registrada. No puedes cambiar la hora.', variant:'warn' });
          }
        }catch(err){
          console.error('Error validando asistencia antes de cambiar hora', err);
          canApplyScheduleChange = false;
          if (timeInputEl) timeInputEl.value = currentTimeLocal;
          if (dateInputEl) dateInputEl.value = currentDateLocal;
          if (durationEl) durationEl.value = originalDuration;
          await this.refreshClassTimeLock(cls);
          this.showToast({ title:'No se pudo verificar asistencia', message:'Guardamos los demás cambios, pero deja la hora igual.', variant:'warn' });
        }
      }

      if (canApplyScheduleChange){
        const { startAt, endAt, classDate, timeUTC } = this._buildStartEnd(effectiveDate, effectiveTime, duration);
        data.startAt = startAt;
        data.endAt = endAt;
        data.classDate = classDate;
        data.time = timeUTC;
      } else if (wantsScheduleChange){
        data.duration = originalDuration;
      }

      await this.db.collection('classes').doc(id).set(data,{ merge:true });
      this.showToast({ title:'Clase actualizada' });
      this.hideClassModal();
    }catch(e){
      this.showToast({ title:'No se guardó', message:e.message, variant:'error' });
    }
  },

  async deleteClass(){
    const id = document.getElementById('class-id').value; if(!id) return;
    try{
      // One atomic batch: class, bookings and waitlist entries go together.
      // If bookings went first, each booking-delete trigger could notify the waitlist
      // and write a hold onto a class that is about to disappear.
      const [snap, waitSnap] = await Promise.all([
        this.db.collection('bookings').where('classId','==',id).get(),
        this.db.collection('waitlists').where('classId','==',id).get()
      ]);
      const batch = this.db.batch();
      batch.delete(this.db.collection('classes').doc(id));
      snap.forEach(doc=>batch.delete(doc.ref));
      waitSnap.forEach(doc=>batch.delete(doc.ref));
      await batch.commit();
      this.showToast({ title:'Clase eliminada', message:`Se borraron ${snap.size} reservas` });
      this.hideClassModal();
    }catch(e){
      this.showToast({ title:'No se pudo eliminar', message:e.message, variant:'error' });
    }
  },

  async loadAttendeesForAttendance(cls){
    const list = document.getElementById('attendance-list');
    const msg  = document.getElementById('attendance-status-message');
    const save = document.getElementById('save-attendance-btn');

    const currentBookings = this.state.bookingsMap.get(cls.id) || [];
    // Exclude WhatsApp/manual bookings from the attendance list.
    const visibleBookings = currentBookings.filter(booking=>!booking.isManualBooking);
    const attSnap = await this.db.collection('attendance').where('classId','==',cls.id).get();
    const existing = {};
    attSnap.forEach(doc=>{ const d=doc.data(); existing[d.userId] = d.status; });

    this.state.currentAttendance = {};
    visibleBookings.forEach(b=>{
      if (existing[b.userId]){
        this.state.currentAttendance[b.userId] = { status: existing[b.userId], userName: b.userName };
      }
    });

    if (!visibleBookings.length){
      msg.textContent = 'No hay usuarios inscritos en esta clase.';
      list.innerHTML=''; save.classList.add('hidden');
      return;
    }

    msg.textContent = `${visibleBookings.length} usuarios inscritos.`;
    list.innerHTML = visibleBookings.map(b=>{
      const st = existing[b.userId];
      const selA = st==='attended' ? 'selected-attended':'';
      const selF = st==='absent'   ? 'selected-absent':'';
      const safeName = DOMPurify.sanitize(b.userName || 'Anónimo');
      const safeId = DOMPurify.sanitize(b.userId);
      return `
        <div class="flex items-center justify-between bg-zinc-900 p-2 rounded-md">
          <span class="text-zinc-300">${safeName}</span>
          <div class="space-x-2" data-user-id="${safeId}" data-user-name="${safeName}">
            <button class="attendance-btn border border-zinc-600 px-3 py-1 text-xs rounded-md ${selA}" data-status="attended">Asistió</button>
            <button class="attendance-btn border border-zinc-600 px-3 py-1 text-xs rounded-md ${selF}" data-status="absent">Faltó</button>
          </div>
        </div>`;
    }).join('');

    save.classList.remove('hidden');
    list.onclick = (e)=>{
      const btn = e.target.closest('.attendance-btn'); if(!btn) return;
      const parent = btn.parentElement;
      const { userId, userName } = parent.dataset;
      const { status } = btn.dataset;
      this.state.currentAttendance[userId] = { status, userName };
      parent.querySelectorAll('.attendance-btn').forEach(x=>x.classList.remove('selected-attended','selected-absent'));
      btn.classList.add(status==='attended'?'selected-attended':'selected-absent');
    };
    save.onclick = () => this.saveAttendance();
  },

  async saveAttendance(){
    const clsId = document.getElementById('class-id')?.value;
    const cls = this.state.selectedClass || this.state.classes.find(c=>c.id===clsId);
    if (!cls){
      this.showToast({ title:'Clase no disponible', message:'No pudimos cargar la clase para guardar asistencia.', variant:'error' });
      return;
    }
    const data = this.state.currentAttendance;
    if (!Object.keys(data).length){
      this.showToast({ title:'Sin cambios', message:'No marcaste asistencia', variant:'warn' });
      return;
    }
    const classDate = cls.classDate || cls.localDate || '';
    if (!classDate){
      this.showToast({ title:'Clase sin fecha', message:'No se pudo identificar la fecha de la clase.', variant:'error' });
      return;
    }
    let classTimeLocal = cls.localTime || '';
    if (!classTimeLocal && cls.time){
      const baseTime = new Date(`${classDate}T${cls.time}:00Z`);
      classTimeLocal = this.timeFmt.format(baseTime);
    }
    const batch = this.db.batch();
    Object.keys(data).forEach(uid=>{
      const rec = data[uid];
      const ref = this.db.collection('attendance').doc(`${classDate}_${cls.id}_${uid}`);
      batch.set(ref,{
        classId: cls.id, className: cls.name, classDate,
        classTime: classTimeLocal,
        userId: uid, userName: rec.userName, status: rec.status, recordedAt: new Date()
      },{ merge:true });
    });
    try{
      await batch.commit();
      this.showToast({ title:'Asistencia guardada' });
      this.fetchAttendanceData(true);
      this.hideClassModal();
    }catch(e){
      this.showToast({ title:'Error al guardar', message:e.message, variant:'error' });
    }
  },
});
