// /scripts/admin/admin-class-scheduling.js
// Covers class generation, creation, updates, and deletion workflows for admins
// Keeps schedule mutations decoupled from modal UI glue and attendance helpers
// RELEVANT FILES: scripts/admin/admin-class-modal.js, scripts/admin/admin-data-sources.js, scripts/admin/admin-state.js

import { AdminPanel } from './admin-state.js';

AdminPanel._buildStartEnd = function _buildStartEnd(dateStr, timeStr, duration = 60) {
  const start = new Date(`${dateStr}T${timeStr}:00-06:00`);
  const end = new Date(start.getTime() + (Number(duration || 60) * 60000));
  return {
    startAt: firebase.firestore.Timestamp.fromDate(start),
    endAt: firebase.firestore.Timestamp.fromDate(end),
    classDate: start.toISOString().slice(0, 10),
    timeUTC: start.toISOString().slice(11, 16)
  };
};

AdminPanel.generateDailyClasses = async function generateDailyClasses() {
  if (!Object.keys(this.state.weeklySchedule).length) {
    this.showToast({ title: 'Plantilla no cargada', variant: 'warn' });
    return;
  }
  const todayLocalStr = this.dateHelper.today();
  const localMidnight = new Date(`${todayLocalStr}T00:00:00-06:00`);
  const todayDow = localMidnight.getUTCDay();
  const daysUntilSaturday = (6 - todayDow + 7) % 7;
  const days = [];
  for (let offset = 0; offset <= daysUntilSaturday; offset += 1) {
    const cursor = new Date(localMidnight.getTime() + (offset * 86400000));
    const dateStr = cursor.toISOString().slice(0, 10);
    days.push({ dateStr, dow: cursor.getUTCDay() });
  }
  if (!days.length) {
    this.showToast({ title: 'Sin rango válido', variant: 'warn' });
    return;
  }

  const batch = this.db.batch();
  let created = 0;
  const createdList = [];
  for (const d of days) {
    const tpl = this.state.weeklySchedule[String(d.dow)] || [];
    if (!tpl.length) continue;
    const existingSnap = await this.db.collection('classes').where('classDate', '==', d.dateStr).get();
    const existingKeys = new Set(existingSnap.docs.map((x) => {
      const data = x.data();
      return `${data.classDate}|${data.time}`;
    }));
    for (const c of tpl) {
      const { startAt, endAt, classDate, timeUTC } = this._buildStartEnd(d.dateStr, c.time, c.duration || 60);
      const classKey = `${classDate}|${timeUTC}`;
      if (existingKeys.has(classKey)) continue;
      const ref = this.db.collection('classes').doc();
      const isTRX = /trx/i.test(c.name || '');
      const capacity = typeof c.capacity === 'number' ? c.capacity : isTRX ? 13 : 15;
      batch.set(ref, {
        name: c.name,
        time: timeUTC,
        instructor: c.instructor || 'Por Asignar',
        duration: c.duration || 60,
        classDate,
        capacity,
        enrolledCount: 0,
        startAt,
        endAt,
        description: `Clase de ${c.name}`,
        image: `https://placehold.co/400x250/1f2937/ffffff?text=${encodeURIComponent(c.name)}`
      });
      existingKeys.add(classKey);
      createdList.push({ date: d.dateStr, time: c.time, name: c.name });
      created += 1;
    }
  }

  if (created > 0) {
    await batch.commit();
    console.log('Clases generadas:', createdList);
    this.showToast({ title: 'Clases generadas', message: `Se crearon ${created} clases` });
  } else {
    this.showToast({ title: 'Horario al día', message: 'No hay clases nuevas por crear', variant: 'warn' });
  }
};

AdminPanel.showCreateClassModal = function showCreateClassModal() {
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
  const timeInput = document.getElementById('class-time');
  if (timeInput) {
    timeInput.readOnly = false;
    timeInput.classList.remove('cursor-not-allowed', 'opacity-60');
    timeInput.removeAttribute('aria-readonly');
  }
  const warning = document.getElementById('class-time-warning');
  if (warning) {
    warning.textContent = '';
    warning.classList.add('hidden');
  }
  const tabDetails = document.getElementById('tab-details');
  if (tabDetails) tabDetails.onclick = () => this.switchTab('details');
  const tabAttendance = document.getElementById('tab-attendance');
  if (tabAttendance) {
    tabAttendance.classList.add('hidden');
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
};

AdminPanel.createClass = async function createClass() {
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
  if (!data.name || !data.time || !data.classDate) {
    this.showToast({ title: 'Campos requeridos', message: 'Nombre, hora y fecha son obligatorios', variant: 'error' });
    return;
  }
  data.capacity = Math.round(Math.min(30, Math.max(1, Number(data.capacity) || 15)));
  data.duration = Math.round(Math.min(120, Math.max(30, Number(data.duration) || 60)));
  const { startAt, endAt, classDate, timeUTC } = this._buildStartEnd(data.classDate, data.time, data.duration);
  if (!data.image) data.image = `https://placehold.co/400x250/1f2937/ffffff?text=${encodeURIComponent(data.name)}`;
  data.startAt = startAt;
  data.endAt = endAt;
  data.classDate = classDate;
  data.time = timeUTC;
  try {
    await this.db.collection('classes').add(data);
    this.showToast({ title: 'Clase creada', message: `${data.name} creada exitosamente` });
    this.hideClassModal();
  } catch (e) {
    this.showToast({ title: 'Error al crear', message: e.message, variant: 'error' });
  }
};

AdminPanel.saveClass = async function saveClass() {
  const id = document.getElementById('class-id').value.trim();
  if (!id) {
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
  try {
    const cls = this.state.classes.find((c) => c.id === id);
    if (!cls) {
      this.showToast({ title: 'Clase no encontrada', message: 'No pudimos ubicar la clase seleccionada.', variant: 'error' });
      return;
    }
    const baseDate = (cls.classDate && cls.time) ? new Date(`${cls.classDate}T${cls.time}:00Z`) : null;
    const currentDateLocal = cls.localDate || (baseDate ? this.dateHelper.ymd(baseDate) : '');
    let currentTimeLocal = cls.localTime || '';
    if (!currentTimeLocal && baseDate) currentTimeLocal = this.timeFmt.format(baseDate);
    const originalDuration = Number(cls.duration || 60);
    const effectiveDate = dateInputValue || currentDateLocal;
    const effectiveTime = timeInputValue || currentTimeLocal;
    const capacityBase = Number.isFinite(capacityRaw) ? capacityRaw : Number(cls.capacity || 15) || 15;
    const durationBase = Number.isFinite(durationRaw) ? durationRaw : originalDuration || 60;
    const capacity = Math.max(1, Math.min(30, Math.round(capacityBase)));
    const duration = Math.max(30, Math.min(120, Math.round(durationBase)));
    if (!name || !effectiveTime || !effectiveDate) {
      this.showToast({ title: 'Campos requeridos', message: 'Nombre, hora y fecha son obligatorios', variant: 'error' });
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
    if (!data.image) data.image = cls.image || `https://placehold.co/400x250/1f2937/ffffff?text=${encodeURIComponent(name)}`;
    if (enrolledEl) {
      const enrolledCount = Number(enrolledEl.value);
      if (Number.isFinite(enrolledCount)) data.enrolledCount = enrolledCount;
    }
    const wantsScheduleChange = (
      (effectiveDate && effectiveDate !== currentDateLocal) ||
      (effectiveTime && effectiveTime !== currentTimeLocal) ||
      (duration !== originalDuration)
    );
    let canApplyScheduleChange = wantsScheduleChange;
    if (wantsScheduleChange) {
      try {
        const attSnap = await this.db.collection('attendance').where('classId', '==', id).limit(1).get();
        if (!attSnap.empty) {
          canApplyScheduleChange = false;
          if (timeInputEl) timeInputEl.value = currentTimeLocal;
          if (dateInputEl) dateInputEl.value = currentDateLocal;
          if (enrolledEl) enrolledEl.value = Number.isFinite(cls.enrolledCount) ? cls.enrolledCount : enrolledEl.value;
          if (durationEl) durationEl.value = originalDuration;
          await this.refreshClassTimeLock(cls);
          this.showToast({ title: 'Hora bloqueada', message: 'Esta clase ya tiene asistencia registrada. No puedes cambiar la hora.', variant: 'warn' });
        }
      } catch (err) {
        console.error('Error validando asistencia antes de cambiar hora', err);
        canApplyScheduleChange = false;
        if (timeInputEl) timeInputEl.value = currentTimeLocal;
        if (dateInputEl) dateInputEl.value = currentDateLocal;
        if (durationEl) durationEl.value = originalDuration;
        await this.refreshClassTimeLock(cls);
        this.showToast({ title: 'No se pudo verificar asistencia', message: 'Guardamos los demás cambios, pero deja la hora igual.', variant: 'warn' });
      }
    }
    if (canApplyScheduleChange) {
      const { startAt, endAt, classDate, timeUTC } = this._buildStartEnd(effectiveDate, effectiveTime, duration);
      data.startAt = startAt;
      data.endAt = endAt;
      data.classDate = classDate;
      data.time = timeUTC;
    } else if (wantsScheduleChange) {
      data.duration = originalDuration;
    }
    await this.db.collection('classes').doc(id).set(data, { merge: true });
    this.showToast({ title: 'Clase actualizada' });
    this.hideClassModal();
  } catch (e) {
    this.showToast({ title: 'No se guardó', message: e.message, variant: 'error' });
  }
};

AdminPanel.deleteClass = async function deleteClass() {
  const id = document.getElementById('class-id').value;
  if (!id) return;
  try {
    const snap = await this.db.collection('bookings').where('classId', '==', id).get();
    const batch = this.db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    await this.db.collection('classes').doc(id).delete();
    this.showToast({ title: 'Clase eliminada', message: `Se borraron ${snap.size} reservas` });
    this.hideClassModal();
  } catch (e) {
    this.showToast({ title: 'No se pudo eliminar', message: e.message, variant: 'error' });
  }
};
