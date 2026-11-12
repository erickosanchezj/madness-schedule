// scripts/member/viewport.js
// Reserves home-indicator space in installed iPhone apps before the first paint.
// Native viewport insetting can report zero safe-area values on Home Screen apps.
// RELEVANT FILES: index.html, styles/member-shell.css, scripts/member-viewport.test.cjs
(() => {
  if (navigator.standalone !== true || !/iPhone|iPod/.test(navigator.userAgent)) return;

  const root = document.documentElement;
  root.dataset.iosStandalone = '';

  // Elongated iPhone displays have a home indicator; SE/home-button screens do not.
  // Native inset mode may return env(...)=0, so retain a device-scoped padding fallback.
  const { width, height } = window.screen;
  const hasHomeIndicator = Math.max(width, height) / Math.min(width, height) >= 2;
  const updateInset = () => {
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    const inset = hasHomeIndicator ? (landscape ? 21 : 34) : 0;
    root.style.setProperty('--ios-home-inset', `${inset}px`);
  };
  updateInset();
  window.addEventListener('resize', updateInset);
  window.addEventListener('pageshow', updateInset);
})();
