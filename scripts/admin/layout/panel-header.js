// /scripts/admin/layout/panel-header.js
// Header row and action buttons for the admin panel
// Generated from admin layout extraction to keep files small
// RELEVANT FILES: admin.html, scripts/admin/admin-layout.js, scripts/admin/admin-state.js

export const panelHeaderHTML = /* html */ `
<div id="admin-panel" class="hidden p-4 md:p-8">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">Panel de Administración</h1>
        <button id="logout-btn" class="text-rose-400 hover:text-rose-300 font-semibold">Cerrar Sesión</button>
      </div>

      <div class="mb-6 flex flex-wrap gap-3">
        <button id="gen-classes-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg">
          <i data-lucide="calendar-check" class="inline-block -mt-1 mr-2"></i>Generar/Verificar Clases (Próxima Semana)
        </button>
        <button id="create-class-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">
          <i data-lucide="plus" class="inline-block -mt-1 mr-2"></i>Crear Nueva Clase
        </button>
      </div>

      <div class="space-y-6">
        
`;
