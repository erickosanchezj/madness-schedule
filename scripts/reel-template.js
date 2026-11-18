// scripts/reel-template.js
// Shared reel pieces: the original reel's content and the safe HTML for a reel's text block.
// Used by the member app and the admin preview, so the editor shows exactly what members see.
// RELEVANT FILES: scripts/member/feedback.js, scripts/admin/reels.js, styles/member-feedback.css
(() => {
  // Turns any text into plain text inside HTML (no tags can sneak in from the editor).
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  // Line breaks typed in the editor become <br>.
  const lines = text => escape(text).replace(/\n/g, '<br>');

  window.madnessReel = {
    escape,

    // The original reel. Shown when no reel is active, and used to pre-fill "Nuevo reel".
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
