// scripts/admin/manual-bookings.js
// WhatsApp (manual) bookings: create in a transaction, and free a seat.
// Tracks bookings taken outside the app so capacity stays right.
// RELEVANT FILES: scripts/admin/class-modal.js, scripts/admin/weekly-bookings.js, firestore.rules

Object.assign(AdminPanel, {

  async generateManualBookings(){
    const classId = document.getElementById('class-id').value.trim();
    const countInput = document.getElementById('manual-bookings-count');
    if (!countInput){
      this.showToast({
        title: 'Error',
        message: 'Campo de reservas manuales no disponible',
        variant: 'error'
      });
      return;
    }
    const count = parseInt(countInput.value) || 0;

    if (!classId){
      this.showToast({
        title: 'Error',
        message: 'Primero selecciona una clase',
        variant: 'error'
      });
      return;
    }

    if (count <= 0 || count > 30){
      this.showToast({
        title: 'Número inválido',
        message: 'Ingresa un número entre 1 y 30',
        variant: 'error'
      });
      return;
    }

    try{
      const cls = this.state.classes.find(c=>c.id===classId);
      if (!cls){
        this.showToast({
          title: 'Clase no encontrada',
          message: 'No se pudo encontrar la clase seleccionada',
          variant: 'error'
        });
        return;
      }

      const currentBookings = this.state.bookingsMap.get(classId) || [];
      const currentCount = currentBookings.length;
      const capacity = cls.capacity || 15;
      const enrolledCount = Number(cls.enrolledCount || 0);
      const occupancy = Math.max(currentCount, enrolledCount);

      const remainingSlots = Math.max(0, capacity - occupancy);
      if (occupancy + count > capacity || remainingSlots <= 0){
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

      const { updatedEnrolled } = await this.db.runTransaction(async transaction=>{
        const classSnap = await transaction.get(classRef);
        if (!classSnap.exists){
          throw new Error('CLASS_NOT_FOUND');
        }

        const classData = classSnap.data() || {};
        const classCapacity = Number(classData.capacity || 15);
        const currentEnrolled = Number(classData.enrolledCount || 0);
        const availableSlots = Math.max(0, classCapacity - currentEnrolled);

        if (currentEnrolled + count > classCapacity){
          const capacityError = new Error('CAPACITY_EXCEEDED');
          capacityError.remainingSlots = availableSlots;
          throw capacityError;
        }

        for (let i = 1; i <= count; i++){
          const bookingRef = this.db.collection('bookings').doc();
          const bookingData = {
            classId: classId,
            userId: `whatsapp-test-${baseNow}-${i}`,
            userName: `Reserva WhatsApp #${i}`,
            userEmail: `whatsapp-booking-${baseNow}-${i}@test.local`,
            createdAt: timestamp,
            status: 'confirmed',
            isManualBooking: true
          };
          transaction.set(bookingRef, bookingData);
        }

        transaction.update(classRef, {
          enrolledCount: firebase.firestore.FieldValue.increment(count)
        });

        return { updatedEnrolled: currentEnrolled + count };
      });

      countInput.value = '';
      const classIndex = this.state.classes.findIndex(item=>item.id === classId);
      if (classIndex >= 0){
        const updatedClass = { ...cls, enrolledCount: updatedEnrolled };
        this.state.classes.splice(classIndex, 1, updatedClass);
      }

      if (this.state.selectedClass?.id === classId){
        this.state.selectedClass = { ...this.state.selectedClass, enrolledCount: updatedEnrolled };
        const enrolledInput = document.getElementById('class-enrolled');
        if (enrolledInput){
          enrolledInput.value = updatedEnrolled;
        }
      }

      cls.enrolledCount = updatedEnrolled;
      this.renderAll();
      this.showToast({
        title: 'Reservas creadas',
        message: `Se crearon ${count} reservas manuales exitosamente`
      });
    }catch(error){
      console.error('Error creating manual bookings:', error);

      if (error && error.message === 'CAPACITY_EXCEEDED'){
        const allowed = Number(error.remainingSlots || 0);
        this.showToast({
          title: 'Capacidad excedida',
          message: allowed > 0 ? `Solo puedes agregar ${allowed} reservas más` : 'La clase ya está llena',
          variant: 'error'
        });
        return;
      }

      if (error && error.message === 'CLASS_NOT_FOUND'){
        this.showToast({
          title: 'Clase no encontrada',
          message: 'La clase se eliminó antes de crear las reservas',
          variant: 'error'
        });
        return;
      }

      this.showToast({
        title: 'Error',
        message: `No se pudieron crear las reservas: ${error.message}`,
        variant: 'error'
      });
    }
  },

  // Delete a WhatsApp booking and release one seat from the class.
  async deleteManualBooking(classId, bookingId){
    if (!classId || !bookingId){
      return;
    }

    let effectiveClassId = classId;

    try{
      await this.db.runTransaction(async transaction=>{
        const bookingRef = this.db.collection('bookings').doc(bookingId);
        const bookingSnap = await transaction.get(bookingRef);

        if (!bookingSnap.exists){
          throw new Error('BOOKING_NOT_FOUND');
        }

        const bookingData = bookingSnap.data() || {};

        if (!bookingData.isManualBooking){
          throw new Error('NOT_MANUAL_BOOKING');
        }

        effectiveClassId = bookingData.classId || classId;
        const classRef = this.db.collection('classes').doc(effectiveClassId);
        const classSnap = await transaction.get(classRef);

        if (classSnap.exists){
          const classData = classSnap.data() || {};
          const currentEnrolled = Number(classData.enrolledCount || 0);
          const nextCount = Math.max(0, currentEnrolled - 1);
          transaction.update(classRef, { enrolledCount: nextCount });
        }

        transaction.delete(bookingRef);
      });

      this.showToast({
        title: 'Reserva eliminada',
        message: 'Se liberó un lugar para la clase.'
      });
      const existing = this.state.bookingsMap.get(effectiveClassId) || [];
      const filtered = existing.filter(item=>item.id !== bookingId);
      this.state.bookingsMap.set(effectiveClassId, filtered);
      const classIndex = this.state.classes.findIndex(c=>c.id === effectiveClassId);
      if (classIndex >= 0){
        const targetClass = this.state.classes[classIndex];
        const currentEnrolledClass = Number(targetClass?.enrolledCount || 0);
        const updatedClass = { ...targetClass, enrolledCount: Math.max(0, currentEnrolledClass - 1) };
        this.state.classes.splice(classIndex, 1, updatedClass);
      }
      if (this.state.selectedClass?.id === effectiveClassId){
        const currentEnrolled = Number(this.state.selectedClass.enrolledCount || 0);
        const nextEnrolled = Math.max(0, currentEnrolled - 1);
        this.state.selectedClass.enrolledCount = nextEnrolled;
        const enrolledInput = document.getElementById('class-enrolled');
        if (enrolledInput){
          enrolledInput.value = nextEnrolled;
        }
      }
      this.renderAll();
    }catch(error){
      if (error && error.message === 'BOOKING_NOT_FOUND'){
        this.showToast({
          title: 'Reserva inexistente',
          message: 'Esta reserva ya había sido eliminada.',
          variant: 'warn'
        });
        const current = this.state.bookingsMap.get(classId) || [];
        const cleaned = current.filter(item=>item.id !== bookingId);
        this.state.bookingsMap.set(classId, cleaned);
        this.renderAll();
        return;
      }

      if (error && error.message === 'NOT_MANUAL_BOOKING'){
        this.showToast({
          title: 'Acción no permitida',
          message: 'Solo puedes eliminar reservas creadas por WhatsApp.',
          variant: 'error'
        });
        return;
      }

      this.showToast({
        title: 'Error',
        message: `No se pudo eliminar la reserva: ${error.message}`,
        variant: 'error'
      });
    }
  },
});
