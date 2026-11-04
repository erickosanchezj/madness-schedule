// tailwind.config.cjs
// Builds the static Tailwind v3 stylesheet for both root entrypoints.
// Scans runtime templates without depending on Firebase configuration.
// RELEVANT FILES: styles/tailwind.input.css, styles/tailwind.css, scripts/member/main.js, scripts/admin/core.js
module.exports = {
  // The UI templates live in scripts/member and scripts/admin since index.html and
  // admin.html were split. Leaving them out would drop their classes on rebuild.
  content: { relative: true, files: ['./*.html', './scripts/app-accessibility.js', './scripts/member/**/*.js', './scripts/admin/**/*.js'] },
  // AdminPanel.showToast interpolates these three colors. All other conditional
  // utilities occur as complete strings in the templates or classList calls.
  safelist: [
    'bg-rose-500/20', 'text-rose-300',
    'bg-amber-500/20', 'text-amber-300',
    'bg-emerald-500/20', 'text-emerald-300',
  ],
};
