// scripts/admin/views/class-modal.js
// Markup for the create/edit class modal (details and attendance tabs).
// Moved out of admin.html; must exist before app-accessibility.js runs.
// RELEVANT FILES: admin.html, scripts/admin/class-modal.js, scripts/app-accessibility.js

// Replaces the placeholder in admin.html with the modal markup (labeled fields).
document.querySelector('[data-view="class-modal"]').outerHTML = `
    <div id="class-modal" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 hidden z-50">
      <div class="bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 max-h-screen overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" class="text-2xl font-bold">Editar Clase</h2>
        <input type="hidden" id="class-id">
        <div class="border-b border-zinc-700">
          <nav class="flex space-x-4" role="tablist" aria-label="Tabs">
            <button id="tab-details" type="button" role="tab" aria-controls="details-content" tabindex="0" class="px-3 py-2 font-medium text-sm rounded-t-md" aria-selected="true">Detalles</button>
            <button id="tab-attendance" type="button" role="tab" aria-controls="attendance-content" tabindex="-1" class="px-3 py-2 font-medium text-sm rounded-t-md hidden" aria-selected="false" aria-hidden="true">Asistencia</button>
          </nav>
        </div>
        <div id="details-content" role="tabpanel" aria-labelledby="tab-details">
          <!-- Every field has a visible label; the small text under it explains what to enter. -->
          <div class="mt-4">
            <label for="class-name" class="field-label">Nombre de la clase</label>
            <input type="text" id="class-name" placeholder="Ej: TRX" class="w-full bg-zinc-700 p-2 rounded">
            <p class="text-xs text-zinc-400 mt-1">Es el nombre que verán los alumnos en el horario.</p>
          </div>
          <div class="mt-4">
            <label for="class-instructor" class="field-label">Instructor</label>
            <input type="text" id="class-instructor" placeholder="Ej: Ana" class="w-full bg-zinc-700 p-2 rounded">
          </div>
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="flex flex-col">
              <label for="class-date" class="field-label">Fecha</label>
              <input type="date" id="class-date" class="w-full bg-zinc-700 p-2 rounded">
            </div>
            <div class="flex flex-col">
              <label for="class-time" class="field-label">Hora de inicio</label>
              <input type="time" id="class-time" class="w-full bg-zinc-700 p-2 rounded">
            </div>
          </div>
          <p id="class-time-warning" class="mt-2 text-xs text-amber-400 hidden"></p>
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="flex flex-col">
              <label for="class-duration" class="field-label">Duración (min)</label>
              <input type="number" id="class-duration" placeholder="60" class="w-full bg-zinc-700 p-2 rounded" min="30" max="960">
            </div>
            <div class="flex flex-col">
              <label for="class-capacity" class="field-label">Capacidad</label>
              <input type="number" id="class-capacity" placeholder="15" class="w-full bg-zinc-700 p-2 rounded" min="1" max="30">
            </div>
          </div>
          <div class="mt-4">
            <label for="class-enrolled" class="field-label">Inscritos ahora</label>
            <input type="number" id="class-enrolled" class="w-full bg-zinc-700 p-2 rounded" min="0" readonly>
          </div>
          <div class="mt-4">
            <label for="class-description" class="field-label">Descripción</label>
            <textarea id="class-description" placeholder="Resume la dinámica o enfoque de la clase." class="w-full bg-zinc-700 p-2 rounded h-24"></textarea>
          </div>
          <div class="mt-4">
            <label for="class-image" class="field-label">URL de imagen</label>
            <input type="url" id="class-image" placeholder="https://…" class="w-full bg-zinc-700 p-2 rounded">
            <p class="text-xs text-zinc-400 mt-1">Pega la URL de la foto o banner de la clase.</p>
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
            <div id="manual-bookings-existing" class="mt-4 space-y-2"></div>
            <p class="text-xs text-zinc-400 mt-2">
              Esto creará reservas de prueba con emails placeholder para simular las reservas recibidas por WhatsApp.
            </p>
          </div>
        </div>
        <div id="attendance-content" class="hidden" role="tabpanel" aria-labelledby="tab-attendance" hidden>
          <div id="attendance-status-message" class="text-center text-zinc-400 p-4"></div>
          <div id="attendance-list" class="space-y-2"></div>
          <button id="save-attendance-btn" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-4 hidden">Guardar Asistencia</button>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button id="delete-button" class="admin-danger-btn">Eliminar</button>
          <button id="cancel-button" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded">Cancelar</button>
          <button id="save-button" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Guardar Cambios</button>
        </div>
      </div>
    </div>
`;
