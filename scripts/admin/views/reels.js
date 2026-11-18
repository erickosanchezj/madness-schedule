// scripts/admin/views/reels.js
// Markup for the "Reels" card in Avisos: on/off switch, reel list, editor form (text + layout choices) and phone preview.
// Kept out of admin.html so that file stays short; inserted before AdminPanel starts.
// RELEVANT FILES: admin.html, scripts/admin/reels.js, scripts/admin/feedback-reel.js, styles/member-feedback.css

// Field helper: label + input/textarea with the same look as the rest of the admin.
const reelField = (id, label, input) => `
  <div>
    <label for="${id}" class="block text-sm font-medium text-zinc-300 mb-2">${label}</label>
    ${input}
  </div>`;
const reelInput = 'w-full bg-zinc-700 text-white p-2 rounded-md';

// Labels for the layout choices. Values must match window.madnessReel.options (scripts/reel-template.js).
const reelChoices = {
  align: [['left', 'Izquierda'], ['center', 'Centrado']],
  position: [['top', 'Arriba'], ['middle', 'En medio'], ['bottom', 'Abajo']],
  size: [['s', 'S'], ['m', 'M'], ['l', 'L']],
  background: [['texture', 'Textura'], ['arcs', 'Arcos'], ['plain', 'Liso'], ['trx', 'TRX'], ['yoga', 'Yoga'],
    ['hiit', 'HIIT'], ['functional', 'Funcional'], ['capoeira', 'Capoeira']],
  frequency: [['daily3', '3 veces al día'], ['daily', '1 vez al día'], ['once', 'Solo una vez'], ['always', 'Cada vez que abre']],
};
// One group of radio buttons drawn as pills (styles/admin-shell.css). Backgrounds also get a thumbnail.
const reelChoice = (name, legend, hint = '') => `
  <fieldset class="admin-seg">
    <legend class="block text-sm font-medium text-zinc-300 mb-2">${legend}</legend>
    <div class="admin-seg-options">${reelChoices[name].map(([value, label]) => `
      <label><input type="radio" name="reel-${name}" value="${value}">${name === 'background' ? `<span class="admin-reel-thumb reel-bg-${value}" aria-hidden="true"></span>` : ''}<span>${label}</span></label>`).join('')}
    </div>
    ${hint ? `<p class="admin-seg-hint">${hint}</p>` : ''}
  </fieldset>`;

document.querySelector('[data-view="reels"]').outerHTML = `
  <section class="admin-card" aria-labelledby="feedback-reel-title">
    <h2 id="feedback-reel-title" class="admin-card-title">Reels</h2>
    <!-- Master switch (scripts/admin/feedback-reel.js): off = no reel at all. -->
    <label class="inline-flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" role="switch" id="feedback-reel-enabled" class="w-4 h-4 accent-indigo-600"
        aria-describedby="feedback-reel-description feedback-reel-status" disabled>
      Mostrar reels al abrir la app
    </label>
    <p id="feedback-reel-description" class="text-sm text-zinc-400 mt-2">Los reels activos se muestran uno tras otro, en este orden. Si ninguno está activo, no se muestra nada. El banner del formulario sigue disponible.</p>
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
        ${reelChoice('align', 'Alineación del texto')}
        ${reelChoice('position', 'Posición del texto', 'El botón siempre queda abajo, fácil de tocar.')}
        ${reelChoice('size', 'Tamaño del título', 'Se ajusta al ancho del teléfono.')}
        <label class="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" id="reel-logo" class="w-4 h-4 accent-indigo-600"> Mostrar el logo
        </label>
        ${reelChoice('background', 'Fondo', 'Las fotos son las de las clases; se oscurecen para que el texto se lea.')}
        ${reelChoice('frequency', '¿Cada cuándo se muestra?', 'Se cuenta por teléfono y por día. Solo una vez = la primera vez que el miembro lo ve.')}
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
        <!-- Phone size and "Reproducir" (plays the saved active reels in order, like members see them). -->
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <div class="admin-seg-options" role="group" aria-label="Tamaño del teléfono">
            <button type="button" data-preview-size="small" aria-pressed="false">Chico</button>
            <button type="button" data-preview-size="medium" aria-pressed="true">Mediano</button>
            <button type="button" data-preview-size="large" aria-pressed="false">Grande</button>
          </div>
          <button type="button" id="reel-play-btn" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md">▶ Reproducir activos</button>
        </div>
        <!-- Same classes as the member story (styles/member-feedback.css), inside a phone-sized frame. -->
        <div class="admin-reel-phone" aria-label="Vista previa del reel">
          <div id="reel-preview-content" class="feedback-story-content">
            <div id="reel-preview-steps" class="feedback-steps" aria-hidden="true"></div>
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
