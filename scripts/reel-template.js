// scripts/reel-template.js
// Shared reel pieces: the starting text for "Nuevo reel", the layout choices and the safe HTML for a reel's text block.
// Used by the member app and the admin preview, so the editor shows exactly what members see.
// RELEVANT FILES: scripts/member/feedback.js, scripts/admin/reels.js, styles/member-feedback.css
(() => {
  // Turns any text into plain text inside HTML (no tags can sneak in from the editor).
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  // Line breaks typed in the editor become <br>. The space keeps words apart on short screens, where <br> is hidden.
  const lines = text => escape(text).replace(/\n/g, ' <br>');

  window.madnessReel = {
    escape,

    // The original reel's text. Pre-fills "Nuevo reel" (it is not shown on its own).
    defaults: {
      eyebrow: 'El reto es contigo',
      title: 'Tu voz nos\nhace',
      highlight: 'más fuertes.',
      description: 'Queremos escucharte, team.\nAyúdanos a mejorar tu experiencia.',
      ctaText: 'Responder formulario',
      ctaUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfe_odZeI0RBcS9WPdyUgabFLQSelxqHenmeGho4Gq5-a376Q/viewform',
      footer: 'Tu opinión impulsa a Madness',
      seconds: 5,
    },

    // Layout choices (alignment, text position, title size, background, frequency). The first value is the default,
    // so reels saved before these fields existed keep their look. The default frequency is up to 3 times a day.
    options: {
      align: ['left', 'center'],
      position: ['top', 'middle', 'bottom'],
      size: ['m', 's', 'l'],
      background: ['texture', 'arcs', 'plain', 'trx', 'yoga', 'hiit', 'functional', 'capoeira'],
      frequency: ['daily3', 'daily', 'once', 'always'],
    },
    photos: ['trx', 'yoga', 'hiit', 'functional', 'capoeira'], // class photos the app already has

    // A reel's layout with every field set to a valid value (unknown or missing → default). Logo is on unless false.
    layout(reel) {
      const layout = { logo: reel?.logo !== false };
      Object.entries(this.options).forEach(([key, values]) => {
        layout[key] = values.includes(reel?.[key]) ? reel[key] : values[0];
      });
      return layout;
    },

    // CSS classes for the reel screen (styles/member-feedback.css), e.g. "reel-align-center reel-pos-bottom ...".
    className(reel) {
      const l = this.layout(reel);
      return [`reel-align-${l.align}`, `reel-pos-${l.position}`, `reel-size-${l.size}`, `reel-bg-${l.background}`,
        this.photos.includes(l.background) ? 'reel-photo' : '', l.logo ? '' : 'reel-no-logo'].filter(Boolean).join(' ');
    },

    // 3 to 15 seconds per reel; anything else falls back to 5.
    seconds(reel) {
      const value = Math.round(Number(reel?.seconds));
      return value >= 3 && value <= 15 ? value : 5;
    },

    // Eyebrow, title (with the pink highlight) and description. The ids match aria-labelledby/-describedby.
    copyHTML(reel) {
      return `${reel.eyebrow ? `<p class="feedback-eyebrow">${escape(reel.eyebrow)}</p>` : ''}
        <h2 id="feedback-title">${lines(reel.title)}${reel.highlight ? ` <span>${escape(reel.highlight)}</span>` : ''}</h2>
        ${reel.description ? `<p id="feedback-description">${lines(reel.description)}</p>` : ''}`;
    },
  };
})();
