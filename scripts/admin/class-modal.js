// scripts/admin/class-modal.js
// Class modal: open for create/edit, time lock after attendance, tabs.
// Single dialog for creating and editing classes.
// RELEVANT FILES: scripts/admin/class-crud.js, scripts/admin/views/class-modal.js, scripts/app-accessibility.js

Object.assign(AdminPanel, {

  // --- MODAL / Asistencia ---
  isClassInProgressWindow(cls){
    if (!cls || !cls.classDate || !cls.time) return false;
    const start = new Date(`${cls.classDate}T${cls.time}:00Z`).getTime();
    const now = Date.now();
    const lower = now - (2*24*60*60*1000);
    const upper = now + (30*60*1000);
    return (start>=lower) && (start<=upper);
  },

  showCreateClassModal(){
    this.state.currentAttendance = {};
    this.state.selectedClass = null;
    document.getElementById('class-id').value = '';
    document.getElementById('class-name').value = '';
    document.getElementById('class-instructor').value = '';
    document.getElementById('class-time').value = '';
    document.getElementById('class-description').value = '';
    document.getElementById('class-date').value = this.dateHelper.today();
    document.getElementById('class-capacity').value = '15';
    document.getElementById('class-duration').value = '60';
    document.getElementById('class-enrolled').value = '0';
    document.getElementById('class-image').value = '';
    document.getElementById('manual-bookings-count').value = '';
    this.renderManualBookingsList(null);

    const timeInput = document.getElementById('class-time');
    if (timeInput){
      timeInput.readOnly = false;
      timeInput.classList.remove('cursor-not-allowed','opacity-60');
      timeInput.removeAttribute('aria-readonly');
    }
    const warning = document.getElementById('class-time-warning');
    if (warning){
      warning.textContent = '';
      warning.classList.add('hidden');
    }

    const tabDetails = document.getElementById('tab-details');
    if (tabDetails) tabDetails.onclick = () => this.switchTab('details');
    const tabAttendance = document.getElementById('tab-attendance');
    if (tabAttendance){
      tabAttendance.classList.add('hidden');
      tabAttendance.setAttribute('aria-hidden','true');
      tabAttendance.setAttribute('tabindex','-1');
      tabAttendance.onclick = null;
    }
    this.switchTab('details');

    document.getElementById('modal-title').textContent = 'Crear Nueva Clase';
    document.getElementById('save-button').textContent = 'Crear Clase';
    document.getElementById('delete-button').style.display = 'none';

    document.getElementById('cancel-button').onclick = () => this.hideClassModal();
    document.getElementById('save-button').onclick = () => this.saveClass();

    document.getElementById('class-modal').classList.remove('hidden');
    document.getElementById('class-name').focus();
  },

  async createClass(){
    const data = {
      name: document.getElementById('class-name').value.trim(),
      instructor: document.getElementById('class-instructor').value.trim() || 'Por Asignar',
      time: document.getElementById('class-time').value.trim(),
      description: document.getElementById('class-description').value.trim(),
      classDate: document.getElementById('class-date').value.trim(),
      capacity: Number(document.getElementById('class-capacity').value) || 15,
      duration: Number(document.getElementById('class-duration').value) || 60,
      enrolledCount: 0,
      image: document.getElementById('class-image').value.trim()
    };

    if (!data.name || !data.time || !data.classDate){
      this.showToast({ title:'Campos requeridos', message:'Nombre, hora y fecha son obligatorios', variant:'error' });
      return;
    }

    const safeCapacity = Math.round(Math.min(30, Math.max(1, Number(data.capacity) || 15)));
    const safeDuration = Math.round(Math.min(960, Math.max(30, Number(data.duration) || 60)));
    data.capacity = safeCapacity;
    data.duration = safeDuration;

    const { startAt, endAt, classDate, timeUTC } = this._buildStartEnd(data.classDate, data.time, data.duration);

    if (!data.image){
      data.image = `https://placehold.co/400x250/1f2937/ffffff?text=${encodeURIComponent(data.name)}`;
    }

    data.startAt = startAt;
    data.endAt = endAt;
    data.classDate = classDate;
    data.time = timeUTC;

    try{
      await this.db.collection('classes').add(data);
      this.showToast({ title:'Clase creada', message:`${data.name} creada exitosamente` });
      this.hideClassModal();
    }catch(e){
      this.showToast({ title:'Error al crear', message:e.message, variant:'error' });
    }
  },

  async showClassModal(cls){
    this.state.currentAttendance = {};
    this.state.selectedClass = cls ? { ...cls } : null;
    const baseDate = (cls.classDate && cls.time) ? new Date(`${cls.classDate}T${cls.time}:00Z`) : null;
    const localTime = cls.localTime || (baseDate ? this.timeFmt.format(baseDate) : cls.time || '');
    const localDate = cls.localDate || (baseDate ? this.dateHelper.ymd(baseDate) : cls.classDate || '');
    document.getElementById('class-id').value = cls.id;
    document.getElementById('class-name').value = cls.name || '';
    document.getElementById('class-instructor').value = cls.instructor || '';
    document.getElementById('class-time').value = localTime;
    document.getElementById('class-description').value = cls.description || '';
    document.getElementById('class-date').value = localDate;
    document.getElementById('class-capacity').value = (cls.capacity ?? 15);
    document.getElementById('class-duration').value = (cls.duration ?? 60);
    const enrolledVal = Number.isFinite(cls.enrolledCount) ? cls.enrolledCount : (this.state.bookingsMap.get(cls.id)?.length || 0);
    document.getElementById('class-enrolled').value = enrolledVal;
    document.getElementById('class-image').value = cls.image || '';
    const manualInput = document.getElementById('manual-bookings-count');
    if (manualInput) manualInput.value = '';
    this.renderManualBookingsList(cls.id);

    const tabD = document.getElementById('tab-details');
    const tabA = document.getElementById('tab-attendance');
    this.switchTab('details');
    tabD.onclick = () => this.switchTab('details');
    if (this.isClassInProgressWindow(cls)){
      tabA.classList.remove('hidden');
      tabA.removeAttribute('aria-hidden');
      tabA.onclick = () => this.switchTab('attendance');
      this.loadAttendeesForAttendance(cls);
    } else {
      tabA.classList.add('hidden');
      tabA.setAttribute('aria-hidden','true');
      tabA.setAttribute('tabindex','-1');
      tabA.onclick = null;
    }

    // Event handlers for modal buttons
    document.getElementById('delete-button').onclick = () => {
      if (confirm('¿Estás seguro de eliminar esta clase?')) {
        this.deleteClass();
      }
    };
    document.getElementById('cancel-button').onclick = () => this.hideClassModal();
    document.getElementById('save-button').onclick = () => this.saveClass();
    const modal = document.getElementById('class-modal');
    const saveBtnEl = document.getElementById('save-button');
    const timeEl = document.getElementById('class-time');
    if (timeEl){
      timeEl.readOnly = true;
      timeEl.classList.add('cursor-not-allowed','opacity-60');
    }
    if (modal) modal.classList.remove('hidden');
    saveBtnEl?.focus();
    await this.refreshClassTimeLock(cls);
    document.getElementById('modal-title').textContent = 'Editar Clase';
    document.getElementById('save-button').textContent = 'Guardar Cambios';
    document.getElementById('delete-button').style.display = 'block';
  },

  hideClassModal(){
    document.getElementById('class-modal').classList.add('hidden');
    this.state.selectedClass = null;
    this.renderManualBookingsList(null);
  },

  async refreshClassTimeLock(cls){
    const timeInput = document.getElementById('class-time');
    const warning = document.getElementById('class-time-warning');
    if (!timeInput) return;

    timeInput.readOnly = false;
    timeInput.classList.remove('cursor-not-allowed','opacity-60');
    timeInput.removeAttribute('aria-readonly');
    if (warning){
      warning.textContent = '';
      warning.classList.add('hidden');
    }

    if (!cls?.id){
      return;
    }

    try{
      const snap = await this.db.collection('attendance').where('classId','==',cls.id).limit(1).get();
      const hasAttendance = !snap.empty;
      if (hasAttendance){
        timeInput.value = cls.localTime || cls.time || '';
        timeInput.readOnly = true;
        timeInput.classList.add('cursor-not-allowed','opacity-60');
        timeInput.setAttribute('aria-readonly','true');
        if (warning){
          warning.textContent = 'Esta clase tiene asistencia registrada. La hora no se puede modificar.';
          warning.classList.remove('hidden');
        }
      }
    }catch(err){
      console.error('No se pudo verificar asistencia', err);
      timeInput.readOnly = true;
      timeInput.classList.add('cursor-not-allowed','opacity-60');
      timeInput.setAttribute('aria-readonly','true');
      if (warning){
        warning.textContent = 'No pudimos verificar la asistencia. Evita cambiar la hora.';
        warning.classList.remove('hidden');
      }
    }
  },

  switchTab(tab){
    const tabD = document.getElementById('tab-details');
    const tabA = document.getElementById('tab-attendance');
    const contD = document.getElementById('details-content');
    const contA = document.getElementById('attendance-content');
    const saveBtn = document.getElementById('save-button');
    if (tab==='details'){
      tabD.classList.add('border-b-2','border-indigo-500','text-indigo-400'); tabD.setAttribute('aria-selected','true');
      tabD.setAttribute('tabindex','0');
      tabA.classList.remove('border-b-2','border-indigo-500','text-indigo-400'); tabA.setAttribute('aria-selected','false');
      tabA.setAttribute('tabindex','-1');
      contD.classList.remove('hidden');
      contD.removeAttribute('hidden');
      contA.classList.add('hidden');
      contA.setAttribute('hidden','');
      if (saveBtn) saveBtn.classList.remove('hidden');
    } else {
      tabA.classList.add('border-b-2','border-indigo-500','text-indigo-400'); tabA.setAttribute('aria-selected','true');
      tabA.setAttribute('tabindex','0');
      tabD.classList.remove('border-b-2','border-indigo-500','text-indigo-400'); tabD.setAttribute('aria-selected','false');
      tabD.setAttribute('tabindex','-1');
      contA.classList.remove('hidden');
      contA.removeAttribute('hidden');
      contD.classList.add('hidden');
      contD.setAttribute('hidden','');
      if (saveBtn) saveBtn.classList.add('hidden');
    }
  },
});
