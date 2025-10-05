// /scripts/admin/admin-class-modal.js
// Handles class modal behaviour: loading data, toggling tabs, and locking time fields
// Keeps UI glue code separate from scheduling logic and attendance processing
// RELEVANT FILES: scripts/admin/admin-class-scheduling.js, scripts/admin/admin-class-attendance.js, scripts/admin/admin-state.js

import { AdminPanel } from './admin-state.js';

AdminPanel.showClassModal = async function showClassModal(cls) {
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
  document.getElementById('class-capacity').value = cls.capacity ?? 15;
  document.getElementById('class-duration').value = cls.duration ?? 60;
  const enrolledVal = Number.isFinite(cls.enrolledCount) ? cls.enrolledCount : (this.state.bookingsMap.get(cls.id)?.length || 0);
  document.getElementById('class-enrolled').value = enrolledVal;
  document.getElementById('class-image').value = cls.image || '';
  const manualInput = document.getElementById('manual-bookings-count');
  if (manualInput) manualInput.value = '';

  const tabD = document.getElementById('tab-details');
  const tabA = document.getElementById('tab-attendance');
  this.switchTab('details');
  tabD.onclick = () => this.switchTab('details');
  if (this.isClassInProgressWindow(cls)) {
    tabA.classList.remove('hidden');
    tabA.onclick = () => this.switchTab('attendance');
    this.loadAttendeesForAttendance(cls);
  } else {
    tabA.classList.add('hidden');
    tabA.onclick = null;
  }

  document.getElementById('delete-button').onclick = () => {
    if (confirm('¿Estás seguro de eliminar esta clase?')) this.deleteClass();
  };
  document.getElementById('cancel-button').onclick = () => this.hideClassModal();
  document.getElementById('save-button').onclick = () => this.saveClass();
  const modal = document.getElementById('class-modal');
  const saveBtnEl = document.getElementById('save-button');
  const timeEl = document.getElementById('class-time');
  if (timeEl) {
    timeEl.readOnly = true;
    timeEl.classList.add('cursor-not-allowed', 'opacity-60');
  }
  if (modal) modal.classList.remove('hidden');
  saveBtnEl?.focus();
  await this.refreshClassTimeLock(cls);
  document.getElementById('modal-title').textContent = 'Editar Clase';
  document.getElementById('save-button').textContent = 'Guardar Cambios';
  document.getElementById('delete-button').style.display = 'block';
};

AdminPanel.hideClassModal = function hideClassModal() {
  document.getElementById('class-modal').classList.add('hidden');
  this.state.selectedClass = null;
};

AdminPanel.refreshClassTimeLock = async function refreshClassTimeLock(cls) {
  const timeInput = document.getElementById('class-time');
  const warning = document.getElementById('class-time-warning');
  if (!timeInput) return;
  timeInput.readOnly = false;
  timeInput.classList.remove('cursor-not-allowed', 'opacity-60');
  timeInput.removeAttribute('aria-readonly');
  if (warning) {
    warning.textContent = '';
    warning.classList.add('hidden');
  }
  if (!cls?.id) return;
  try {
    const snap = await this.db.collection('attendance').where('classId', '==', cls.id).limit(1).get();
    if (!snap.empty) {
      timeInput.value = cls.localTime || cls.time || '';
      timeInput.readOnly = true;
      timeInput.classList.add('cursor-not-allowed', 'opacity-60');
      timeInput.setAttribute('aria-readonly', 'true');
      if (warning) {
        warning.textContent = 'Esta clase tiene asistencia registrada. La hora no se puede modificar.';
        warning.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('No se pudo verificar asistencia', err);
    timeInput.readOnly = true;
    timeInput.classList.add('cursor-not-allowed', 'opacity-60');
    timeInput.setAttribute('aria-readonly', 'true');
    if (warning) {
      warning.textContent = 'No pudimos verificar la asistencia. Evita cambiar la hora.';
      warning.classList.remove('hidden');
    }
  }
};

AdminPanel.switchTab = function switchTab(tab) {
  const tabD = document.getElementById('tab-details');
  const tabA = document.getElementById('tab-attendance');
  const contD = document.getElementById('details-content');
  const contA = document.getElementById('attendance-content');
  const saveBtn = document.getElementById('save-button');
  if (tab === 'details') {
    tabD.classList.add('border-b-2', 'border-indigo-500', 'text-indigo-400');
    tabD.setAttribute('aria-selected', 'true');
    tabA.classList.remove('border-b-2', 'border-indigo-500', 'text-indigo-400');
    tabA.setAttribute('aria-selected', 'false');
    contD.classList.remove('hidden');
    contA.classList.add('hidden');
    if (saveBtn) saveBtn.classList.remove('hidden');
  } else {
    tabA.classList.add('border-b-2', 'border-indigo-500', 'text-indigo-400');
    tabA.setAttribute('aria-selected', 'true');
    tabD.classList.remove('border-b-2', 'border-indigo-500', 'text-indigo-400');
    tabD.setAttribute('aria-selected', 'false');
    contA.classList.remove('hidden');
    contD.classList.add('hidden');
    if (saveBtn) saveBtn.classList.add('hidden');
  }
};
