// /scripts/admin/admin-class-attendance.js
// Manages attendance capture within the class modal for in-progress sessions
// Keeps roster handling separate from scheduling and analytics logic
// RELEVANT FILES: scripts/admin/admin-class-modal.js, scripts/admin/admin-attendance-core.js, scripts/admin/admin-state.js

import { AdminPanel } from './admin-state.js';

AdminPanel.loadAttendeesForAttendance = async function loadAttendeesForAttendance(cls) {
  const list = document.getElementById('attendance-list');
  const msg = document.getElementById('attendance-status-message');
  const save = document.getElementById('save-attendance-btn');
  const currentBookings = this.state.bookingsMap.get(cls.id) || [];
  const attSnap = await this.db.collection('attendance').where('classId', '==', cls.id).get();
  const existing = {};
  attSnap.forEach((doc) => {
    const d = doc.data();
    existing[d.userId] = d.status;
  });
  this.state.currentAttendance = {};
  currentBookings.forEach((b) => {
    if (existing[b.userId]) this.state.currentAttendance[b.userId] = { status: existing[b.userId], userName: b.userName };
  });
  if (!currentBookings.length) {
    msg.textContent = 'No hay usuarios inscritos en esta clase.';
    list.innerHTML = '';
    save.classList.add('hidden');
    return;
  }
  msg.textContent = `${currentBookings.length} usuarios inscritos.`;
  list.innerHTML = currentBookings
    .map((b) => {
      const st = existing[b.userId];
      const selA = st === 'attended' ? 'selected-attended' : '';
      const selF = st === 'absent' ? 'selected-absent' : '';
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
    })
    .join('');
  save.classList.remove('hidden');
  list.onclick = (e) => {
    const btn = e.target.closest('.attendance-btn');
    if (!btn) return;
    const parent = btn.parentElement;
    const { userId, userName } = parent.dataset;
    const { status } = btn.dataset;
    this.state.currentAttendance[userId] = { status, userName };
    parent.querySelectorAll('.attendance-btn').forEach((x) => x.classList.remove('selected-attended', 'selected-absent'));
    btn.classList.add(status === 'attended' ? 'selected-attended' : 'selected-absent');
  };
  save.onclick = () => this.saveAttendance();
};

AdminPanel.saveAttendance = async function saveAttendance() {
  const clsId = document.getElementById('class-id')?.value;
  const cls = this.state.selectedClass || this.state.classes.find((c) => c.id === clsId);
  if (!cls) {
    this.showToast({ title: 'Clase no disponible', message: 'No pudimos cargar la clase para guardar asistencia.', variant: 'error' });
    return;
  }
  const data = this.state.currentAttendance;
  if (!Object.keys(data).length) {
    this.showToast({ title: 'Sin cambios', message: 'No marcaste asistencia', variant: 'warn' });
    return;
  }
  const classDate = cls.classDate || cls.localDate || '';
  if (!classDate) {
    this.showToast({ title: 'Clase sin fecha', message: 'No se pudo identificar la fecha de la clase.', variant: 'error' });
    return;
  }
  let classTimeLocal = cls.localTime || '';
  if (!classTimeLocal && cls.time) {
    const baseTime = new Date(`${classDate}T${cls.time}:00Z`);
    classTimeLocal = this.timeFmt.format(baseTime);
  }
  const batch = this.db.batch();
  Object.keys(data).forEach((uid) => {
    const rec = data[uid];
    const ref = this.db.collection('attendance').doc(`${classDate}_${cls.id}_${uid}`);
    batch.set(ref, {
      classId: cls.id,
      className: cls.name,
      classDate,
      classTime: classTimeLocal,
      userId: uid,
      userName: rec.userName,
      status: rec.status,
      recordedAt: new Date()
    }, { merge: true });
  });
  try {
    await batch.commit();
    this.showToast({ title: 'Asistencia guardada' });
    this.fetchAttendanceData(true);
    this.hideClassModal();
  } catch (e) {
    this.showToast({ title: 'Error al guardar', message: e.message, variant: 'error' });
  }
};

AdminPanel.isClassInProgressWindow = function isClassInProgressWindow(cls) {
  if (!cls || !cls.classDate || !cls.time) return false;
  const start = new Date(`${cls.classDate}T${cls.time}:00Z`).getTime();
  const now = Date.now();
  const lower = now - (2 * 24 * 60 * 60 * 1000);
  const upper = now + (30 * 60 * 1000);
  return start >= lower && start <= upper;
};
