// scripts/member/banner.js
// Applies the admin's banner settings (on/off, text, link text, URL) to the link above the bottom menu.
// Staff edit it in admin → Avisos; until they save something, the banner from index.html is shown.
// RELEVANT FILES: index.html, scripts/admin/banner.js, scripts/member/auth.js, firestore.rules
(() => {
  const banner = document.getElementById('feedback-banner');
  const title = document.getElementById('feedback-banner-title');
  const linkText = document.getElementById('feedback-banner-link');
  // The text and link written in index.html, used when nothing is saved or the setting cannot be read.
  const original = { enabled: true, title: title.textContent, linkText: linkText.textContent, url: banner.href };
  let unsubscribe;
  let session = 0;

  function apply(settings) {
    banner.hidden = settings.enabled === false;
    title.textContent = settings.title || original.title;
    linkText.textContent = settings.linkText || '';
    linkText.parentElement.hidden = !settings.linkText; // no link text → only the main text
    if (/^https:\/\//.test(settings.url || '')) banner.href = settings.url;
  }

  window.madnessBanner = {
    // Called by auth.js on login (true) and logout (false). The setting is only readable when signed in.
    setReady(value) {
      session += 1;
      unsubscribe?.();
      unsubscribe = null;
      if (!value) { apply(original); return; }
      const currentSession = session;
      // Hidden until the first answer, so a banner that staff turned off never flashes.
      // A cached answer is fine here: it arrives almost instantly and is corrected by the server one.
      banner.hidden = true;
      unsubscribe = db.collection('appSettings').doc('feedbackBanner').onSnapshot(snapshot => {
        if (currentSession !== session) return;
        apply(snapshot.exists ? { ...original, ...snapshot.data() } : original);
      }, error => {
        if (currentSession !== session) return;
        apply(original); // e.g. rules not deployed yet: keep today's banner
        console.warn('Banner settings failed:', error);
      });
    }
  };
})();
