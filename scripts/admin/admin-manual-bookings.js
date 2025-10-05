// /scripts/admin/admin-manual-bookings.js
// Adds manual (WhatsApp) bookings through a safe Firestore transaction
// Keeps this edge workflow distinct from regular class editing logic
// RELEVANT FILES: scripts/admin/admin-class-scheduling.js, scripts/admin/admin-state.js, scripts/admin/admin-data-sources.js

import { AdminPanel } from './admin-state.js';

AdminPanel.generateManualBookings = async function generateManualBookings() {
  const classId = document.getElementById('class-id').value.trim();
  const countInput = document.getElementById('manual-bookings-count');
  if (!countInput) {
    this.showToast({ title: 'Error', message: 'Campo de reservas manuales no disponible', variant: 'error' });
    return;
  }
  const count = parseInt(countInput.value, 10) || 0;
  if (!classId) {
    this.showToast({ title: 'Error', message: 'Primero selecciona una clase', variant: 'error' });
    return;
  }
  if (count <= 0 || count > 30) {
    this.showToast({ title: 'Número inválido', message: 'Ingresa un número entre 1 y 30', variant: 'error' });
    return;
  }
  try {
    const cls = this.state.classes.find((c) => c.id === classId);
    if (!cls) {
      this.showToast({ title: 'Clase no encontrada', message: 'No se pudo encontrar la clase seleccionada', variant: 'error' });
      return;
    }
    const currentBookings = this.state.bookingsMap.get(classId) || [];
    const currentCount = currentBookings.length;
    const capacity = cls.capacity || 15;
    const enrolledCount = Number(cls.enrolledCount || 0);
    const occupancy = Math.max(currentCount, enrolledCount);
    const remainingSlots = Math.max(0, capacity - occupancy);
    if (occupancy + count > capacity || remainingSlots <= 0) {
      this.showToast({
        title: 'Capacidad excedida',
        message: remainingSlots > 0 ? `Solo puedes agregar ${remainingSlots} reservas más` : 'La clase ya está llena',
        variant: 'error'
      });
      return;
    }
    const timestamp = firebase.firestore.Timestamp.now();
    const baseNow = Date.now();
    const classRef = this.db.collection('classes').doc(classId);
    const { updatedEnrolled } = await this.db.runTransaction(async (transaction) => {
      const classSnap = await transaction.get(classRef);
      if (!classSnap.exists) throw new Error('CLASS_NOT_FOUND');
      const classData = classSnap.data() || {};
      const classCapacity = Number(classData.capacity || 15);
      const currentEnrolled = Number(classData.enrolledCount || 0);
      const availableSlots = Math.max(0, classCapacity - currentEnrolled);
      if (currentEnrolled + count > classCapacity) {
        const capacityError = new Error('CAPACITY_EXCEEDED');
        capacityError.remainingSlots = availableSlots;
        throw capacityError;
      }
      for (let i = 1; i <= count; i += 1) {
        const bookingRef = this.db.collection('bookings').doc();
        transaction.set(bookingRef, {
          classId,
          userId: `whatsapp-test-${baseNow}-${i}`,
          userName: `Reserva WhatsApp #${i}`,
          userEmail: `whatsapp-booking-${baseNow}-${i}@test.local`,
          createdAt: timestamp,
          status: 'confirmed',
          isManualBooking: true
        });
      }
      transaction.update(classRef, {
        enrolledCount: firebase.firestore.FieldValue.increment(count)
      });
      return { updatedEnrolled: currentEnrolled + count };
    });
    countInput.value = '';
    cls.enrolledCount = updatedEnrolled;
    this.renderAll();
    this.showToast({ title: 'Reservas creadas', message: `Se crearon ${count} reservas manuales exitosamente` });
  } catch (error) {
    console.error('Error creating manual bookings:', error);
    if (error && error.message === 'CAPACITY_EXCEEDED') {
      const allowed = Number(error.remainingSlots || 0);
      this.showToast({
        title: 'Capacidad excedida',
        message: allowed > 0 ? `Solo puedes agregar ${allowed} reservas más` : 'La clase ya está llena',
        variant: 'error'
      });
      return;
    }
    if (error && error.message === 'CLASS_NOT_FOUND') {
      this.showToast({ title: 'Clase no encontrada', message: 'La clase se eliminó antes de crear las reservas', variant: 'error' });
      return;
    }
    this.showToast({ title: 'Error', message: `No se pudieron crear las reservas: ${error.message}`, variant: 'error' });
  }
};
