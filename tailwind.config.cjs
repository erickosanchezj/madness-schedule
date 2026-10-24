// tailwind.config.cjs
// Builds the static Tailwind v3 stylesheet for both root entrypoints.
// Scans runtime templates without depending on Firebase configuration.
// RELEVANT FILES: styles/tailwind.input.css, styles/tailwind.css, index.html, admin.html
module.exports = {
  content: { relative: true, files: ['./*.html', './scripts/app-accessibility.js'] },
  // AdminPanel.showToast interpolates these three colors. All other conditional
  // utilities occur as complete strings in the templates or classList calls.
  safelist: [
    'bg-rose-500/20', 'text-rose-300',
    'bg-amber-500/20', 'text-amber-300',
    'bg-emerald-500/20', 'text-emerald-300',
  ],
};
