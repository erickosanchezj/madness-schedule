// scripts/admin/views/reels.js
// Markup for the "Reels" card in Avisos: on/off switch, reel list, editor form and phone preview.
// Kept out of admin.html so that file stays short; inserted before AdminPanel starts.
// RELEVANT FILES: admin.html, scripts/admin/reels.js, scripts/admin/feedback-reel.js, styles/member-feedback.css

// Field helper: label + input/textarea with the same look as the rest of the admin.
const reelField = (id, label, input) => `
  <div>
    <label for="${id}" class="block text-sm font-medium text-zinc-300 mb-2">${label}</label>
    ${input}
  </div>`;
const reelInput = 'w-full bg-zinc-700 text-white p-2 rounded-md';

document.querySelector('[data-view="reels"]').outerHTML = `
  <section class="admin-card" aria-labelledby="feedback-reel-title">
    <h2 id="feedback-reel-title" class="admin-card-title">Reels</h2>
    <!-- Master switch (scripts/admin/feedback-reel.js): off = no reel at all. -->
    <label class="inline-flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" role="switch" id="feedback-reel-enabled" class="w-4 h-4 accent-indigo-600"
        aria-describedby="feedback-reel-description feedback-reel-status" disabled>
      Mostrar reels al abrir la app
    </label>
    <p id="feedback-reel-description" class="text-sm text-zinc-400 mt-2">Los reels activos se muestran uno tras otro, en este orden. Si ninguno está activo, se muestra el reel original. El banner del formulario sigue disponible.</p>
    <p id="feedback-reel-status" class="text-sm text-zinc-400 mt-2" role="status">Cargando configuración…</p>

    <div class="flex items-center justify-between gap-2 mt-6 mb-3">
      <h3 class="admin-chart-title">Tus reels</h3>
      <button type="button" id="reel-new-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">Nuevo reel</button>
    </div>
    <div id="reels-list" class="space-y-2"></div>

    <!-- Editor: fields on the left, live phone preview on the right (stacked on phones). -->
    <form id="reel-form" class="admin-reel-editor" hidden>
      <div class="space-y-4">
        <h3 id="reel-form-title" class="admin-chart-title">Nuevo reel</h3>
        ${reelField('reel-eyebrow', 'Etiqueta superior', `<input id="reel-eyebrow" maxlength="60" class="${reelInput}">`)}
        ${reelField('reel-title', 'Título', `<textarea id="reel-title" maxlength="60" rows="2" required class="${reelInput}"></textarea>`)}
        ${reelField('reel-highlight', 'Parte del título en rosa', `<input id="reel-highlight" maxlength="60" class="${reelInput}">`)}
        ${reelField('reel-description', 'Descripción', `<textarea id="reel-description" maxlength="200" rows="3" class="${reelInput}"></textarea>`)}
        ${reelField('reel-cta-text', 'Texto del botón', `<input id="reel-cta-text" maxlength="40" class="${reelInput}">`)}
        ${reelField('reel-cta-url', 'Enlace del botón (vacío = sin botón)', `<input id="reel-cta-url" type="url" maxlength="500" placeholder="https://…" class="${reelInput}">`)}
        ${reelField('reel-footer', 'Texto bajo el botón', `<input id="reel-footer" maxlength="80" class="${reelInput}">`)}
        ${reelField('reel-seconds', 'Duración (3 a 15 segundos)', `<input id="reel-seconds" type="number" min="3" max="15" class="${reelInput}">`)}
        <label class="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" id="reel-active" class="w-4 h-4 accent-indigo-600"> Activo (los miembros lo ven)
        </label>
        <div class="flex flex-wrap gap-2">
          <button type="submit" id="reel-save-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">Guardar reel</button>
          <button type="button" id="reel-cancel-btn" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
        </div>
      </div>
      <div>
        <p class="admin-chart-title">Vista previa en la app</p>
        <!-- Same classes as the member story (styles/member-feedback.css), inside a phone-sized frame. -->
        <div class="admin-reel-phone" aria-label="Vista previa del reel">
          <div class="feedback-story-content">
            <div class="feedback-steps" aria-hidden="true"><span class="feedback-step is-current" style="--fill:40%"><i></i></span></div>
            <header class="feedback-story-header">
              <span>Comunidad Madness <small id="reel-preview-seconds">5 s</small></span>
              <span class="feedback-close" aria-hidden="true">✕</span>
            </header>
            <img class="feedback-logo" src="./images/madness-cross-training-logo.png" alt="" width="1200" height="300">
            <div id="reel-preview-copy" class="feedback-story-copy"></div>
            <div id="reel-preview-action" class="feedback-story-action">
              <span class="feedback-cta"><i data-lucide="link" aria-hidden="true"></i><span id="reel-preview-cta"></span></span>
              <p id="reel-preview-footer"></p>
            </div>
          </div>
        </div>
      </div>
    </form>
  </section>
`;
