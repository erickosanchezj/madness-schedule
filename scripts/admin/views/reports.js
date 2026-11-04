// scripts/admin/views/reports.js
// Markup for "Gestión de Suscripciones" and "Reporte de Asistencia y Proyección".
// Moved out of admin.html to keep it short; inserted before AdminPanel starts.
// RELEVANT FILES: admin.html, scripts/admin/subscriptions.js, scripts/admin/reports-charts.js

// Replaces the placeholder in admin.html with the exact original markup.
document.querySelector('[data-view="reports"]').outerHTML = `
      <section aria-labelledby="subscription-title" class="mt-8">
        <div class="flex items-center justify-between gap-4 mb-4 border-b border-zinc-700 pb-2">
          <h2 id="subscription-title" class="text-2xl font-bold text-emerald-400">
            Gestión de Suscripciones
          </h2>
          <button
            type="button"
            class="toggle-section inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            data-toggle-target="subscription-section-body"
            data-expanded-label="Colapsar"
            data-collapsed-label="Expandir"
            aria-controls="subscription-section-body"
            aria-expanded="false"
          >
            <span data-toggle-label>Expandir</span>
          </button>
        </div>

        <div id="subscription-section-body" class="bg-zinc-800 rounded-lg p-6 hidden">
          <div class="mb-4 flex gap-3 flex-wrap">
            <select id="subscription-filter" aria-label="Filtro de suscripciones" class="bg-zinc-700 text-white p-2 rounded">
              <option value="all">Todos los usuarios</option>
              <option value="monthly">Solo Mensuales</option>
              <option value="monthly-unpaid">Mensuales No Pagados</option>
              <option value="totalpass-pending">TotalPass Pendientes</option>
              <option value="unpaid">No Pagados</option>
            </select>

            <input
              type="text"
              id="user-search"
              aria-label="Buscar usuario por nombre o correo"
              placeholder="Buscar por nombre o email..."
              class="bg-zinc-700 text-white p-2 rounded flex-1 min-w-[200px]"
            >

            <button id="refresh-users-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              <i data-lucide="refresh-cw" class="inline-block -mt-1 mr-2"></i>Actualizar
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-zinc-700">
                <tr>
                  <th class="p-3 text-left">Usuario</th>
                  <th class="p-3 text-left">Tipo de Suscripción</th>
                  <th class="p-3 text-left">Estado TotalPass</th>
                  <th class="p-3 text-left">Estado de Pago</th>
                  <th class="p-3 text-left">Última Fecha de Pago</th>
                  <th class="p-3 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody id="subscription-users-list" class="divide-y divide-zinc-700">
                <!-- Users will be populated here -->
              </tbody>
            </table>
          </div>

          <div id="subscription-loading" class="text-center py-8 text-zinc-400 hidden">
            Cargando usuarios…
          </div>
        </div>
      </section>

      <section class="mt-8 p-6 bg-zinc-800 rounded-lg" aria-labelledby="asistencia-title">
        <div class="flex items-center justify-between gap-4 mb-2">
          <h2 id="asistencia-title" class="text-2xl font-bold">Reporte de Asistencia y Proyección</h2>
          <button
            type="button"
            class="toggle-section inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            data-toggle-target="attendance-section-body"
            data-expanded-label="Colapsar"
            data-collapsed-label="Expandir"
            aria-controls="attendance-section-body"
            aria-expanded="false"
          >
            <span data-toggle-label>Expandir</span>
          </button>
        </div>
        <div id="attendance-section-body" class="space-y-4 hidden">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-400 gap-2">
            <div class="flex items-center gap-4">
              <span id="att-last">Última actualización: Sin datos</span>
              <span id="att-next">Próxima actualización en: Sin datos</span>
            </div>
            <button id="att-refresh" class="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
              <i data-lucide="refresh-ccw" class="w-4 h-4"></i> Actualizar ahora
            </button>
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <label for="att-start-date">Desde:</label>
              <input type="date" id="att-start-date" class="bg-zinc-700 text-white p-1 rounded-md" />
              <label for="att-end-date">Hasta:</label>
              <input type="date" id="att-end-date" class="bg-zinc-700 text-white p-1 rounded-md" />
              <label for="att-period">Periodo:</label>
              <select id="att-period" class="bg-zinc-700 text-white p-1 rounded-md">
                <option value="range">Rango seleccionado</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <label for="class-filter">Tipo de clase:</label>
              <select id="class-filter" class="bg-zinc-700 text-white p-1 rounded-md min-w-[8rem]">
                <option value="all">Todas</option>
              </select>
              <label for="instructor-filter">Instructor:</label>
              <select id="instructor-filter" class="bg-zinc-700 text-white p-1 rounded-md min-w-[8rem]">
                <option value="all">Todos</option>
              </select>
              <label for="att-export-format">Exportar:</label>
              <select id="att-export-format" class="bg-zinc-700 text-white p-1 rounded-md">
                <option value="capacity">Capacidad</option>
                <option value="demographics">Demográficos</option>
                <option value="instructors">Instructores</option>
                <option value="revenue">Ingresos estimados</option>
                <option value="optimization">Optimización</option>
                <option value="custom-range">Rango personalizado</option>
              </select>
              <button id="att-export" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-1 px-2 rounded-md">Exportar</button>
            </div>
            <div class="flex flex-wrap items-center gap-2 xl:col-span-2">
              <span>Métricas:</span>
              <label class="inline-flex items-center gap-1">
                <input type="checkbox" id="metric-attended" class="bg-zinc-700" checked /> Asistencias
              </label>
              <label class="inline-flex items-center gap-1">
                <input type="checkbox" id="metric-absent" class="bg-zinc-700" checked /> Ausencias
              </label>
              <label class="inline-flex items-center gap-1">
                <input type="checkbox" id="metric-booked" class="bg-zinc-700" checked /> Reservas
              </label>
              <label class="inline-flex items-center gap-1">
                <input type="checkbox" id="metric-utilization" class="bg-zinc-700" checked /> Utilización
              </label>
              <label class="inline-flex items-center gap-1">
                <input type="checkbox" id="metric-revenue" class="bg-zinc-700" checked /> Ingresos estimados
              </label>
            </div>
          </div>
          <div class="bg-zinc-900/60 border border-zinc-700 rounded-lg p-4 space-y-4">
            <div class="w-full bg-zinc-700 h-2 rounded">
              <div id="capacity-gauge-fill" class="h-2 bg-emerald-500 rounded" style="width:0%"></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-zinc-300">
              <div>
                <p class="text-zinc-500">Tendencia 7 días</p>
                <p id="capacity-trend" class="font-semibold">Sin datos</p>
              </div>
              <div>
                <p class="text-zinc-500">Alertas</p>
                <p id="capacity-alert" class="font-semibold">Sin datos</p>
              </div>
              <div>
                <p class="text-zinc-500">Vs. semana pasada</p>
                <p id="capacity-compare" class="font-semibold">Sin datos</p>
              </div>
              <div>
                <p class="text-zinc-500">Proyección día</p>
                <p id="capacity-projection" class="font-semibold">Sin datos</p>
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <div class="bg-zinc-900/60 border border-zinc-700 rounded-lg p-4">
              <canvas id="attendanceTrendChart"></canvas>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-zinc-900/60 border border-zinc-700 rounded-lg p-4">
                <div id="capacity-heatmap" class="grid grid-cols-1 gap-2 text-xs text-zinc-300 min-h-[180px]"></div>
              </div>
              <div class="bg-zinc-900/60 border border-zinc-700 rounded-lg p-4">
                <canvas id="revenueChart"></canvas>
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-zinc-900/60 border border-zinc-700 rounded-lg p-4">
                <canvas id="retentionChart"></canvas>
              </div>
              <div class="bg-zinc-900/60 border border-zinc-700 rounded-lg p-4">
                <canvas id="popularityChart"></canvas>
              </div>
            </div>
          </div>
          <div id="attendance-details" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm"></div>
        </div>
      </section>
`;
