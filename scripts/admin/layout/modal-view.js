// /scripts/admin/layout/modal-view.js
// Modal markup for class editing and attendance management
// Injected dynamically so admin.html stays compact
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-class-modal.js

export const modalViewHTML = /* html */ `
<div id="class-modal" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 hidden z-50">
      <div class="bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 max-h-screen overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" class="text-2xl font-bold">Editar Clase</h2>
        <input type="hidden" id="class-id">
        <div class="border-b border-zinc-700">
          <nav class="flex space-x-4" aria-label="Tabs">
            <button id="tab-details" class="px-3 py-2 font-medium text-sm rounded-t-md" aria-selected="true">Detalles</button>
            <button id="tab-attendance" class="px-3 py-2 font-medium text-sm rounded-t-md hidden" aria-selected="false">Asistencia</button>
          </nav>
        </div>
        <div id="details-content">
          <div class="mt-4">
            <input type="text" id="class-name" placeholder="Nombre de la clase" class="w-full bg-zinc-700 p-2 rounded">
            <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Escribe el nombre que verán los alumnos en el horario.</p>
          </div>
          <div class="mt-4">
            <input type="text" id="class-instructor" placeholder="Instructor" class="w-full bg-zinc-700 p-2 rounded">
            <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Indica quién impartirá la sesión.</p>
          </div>
          <div class="mt-4">
            <input type="text" id="class-time" placeholder="Hora (ej. 18:00)" class="w-full bg-zinc-700 p-2 rounded">
            <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Coloca la hora de inicio en formato 24 horas.</p>
          </div>
          <p id="class-time-warning" class="mt-2 text-xs text-amber-400 hidden"></p>
          <div class="mt-4">
            <textarea id="class-description" placeholder="Descripción" class="w-full bg-zinc-700 p-2 rounded h-24"></textarea>
            <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Resume la dinámica o enfoque de la clase.</p>
          </div>
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="flex flex-col">
              <input type="date" id="class-date" placeholder="Fecha" class="w-full bg-zinc-700 p-2 rounded">
              <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Selecciona la fecha exacta de la clase.</p>
            </div>
            <div class="flex flex-col">
              <input type="number" id="class-capacity" placeholder="Capacidad" class="w-full bg-zinc-700 p-2 rounded" min="1" max="30">
              <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Define el número máximo de asistentes.</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="flex flex-col">
              <input type="number" id="class-duration" placeholder="Duración (min)" class="w-full bg-zinc-700 p-2 rounded" min="30" max="120">
              <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Indica cuánto dura la sesión en minutos.</p>
            </div>
            <div class="flex flex-col">
              <input type="number" id="class-enrolled" placeholder="Inscritos" class="w-full bg-zinc-700 p-2 rounded" min="0" readonly>
              <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Consulta cuántos alumnos están inscritos ahora.</p>
            </div>
          </div>
          <div class="mt-4">
            <input type="url" id="class-image" placeholder="URL de imagen" class="w-full bg-zinc-700 p-2 rounded">
            <p class="text-xs text-zinc-400 mt-1 text-left sm:text-right">Pega la URL de la foto o banner de la clase.</p>
          </div>
          <div class="mt-4 p-4 bg-zinc-700 rounded-lg border border-zinc-600">
            <h3 class="text-lg font-semibold mb-3">Reservas Manuales (WhatsApp)</h3>
            <div class="flex gap-3 items-end">
              <div class="flex-1">
                <label for="manual-bookings-count" class="block text-sm font-medium text-zinc-300 mb-2">
                  Número de reservas recibidas por WhatsApp
                </label>
                <input
                  type="number"
                  id="manual-bookings-count"
                  placeholder="Ej: 5"
                  class="w-full bg-zinc-600 p-2 rounded"
                  min="0"
                  max="30"
                >
              </div>
              <button
                id="generate-manual-bookings-btn"
                class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Generar Reservas
              </button>
            </div>
            <p class="text-xs text-zinc-400 mt-2">
              Esto creará reservas de prueba con emails placeholder para simular las reservas recibidas por WhatsApp.
            </p>
          </div>
        </div>
        <div id="attendance-content" class="hidden">
          <div id="attendance-status-message" class="text-center text-zinc-400 p-4"></div>
          <div id="attendance-list" class="space-y-2"></div>
          <button id="save-attendance-btn" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-4 hidden">Guardar Asistencia</button>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button id="delete-button" class="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded">Eliminar</button>
          <button id="cancel-button" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded">Cancelar</button>
          <button id="save-button" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Guardar Cambios</button>
        </div>
      </div>
    </div>

    <!-- Firebase compat SDKs -->
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-functions-compat.js"></script>

    
`;
