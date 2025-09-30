/* /admin/js/utils/ui-helpers.js */
/* UI helper utilities for the admin experience */
/* Extracted to centralize toast messaging and collapsible sections */
/* RELEVANT FILES: admin/index.html, admin/js/admin-core.js, admin/js/modules/bookings.js, admin/js/modules/analytics.js */

export class UIHelpers {
  static showToast({ title = 'Hecho', message = '', variant = 'success', timeout = 3000 }) {
    const color = variant === 'error' ? 'rose' : variant === 'warn' ? 'amber' : 'emerald';
    const wrap = document.getElementById('toast-container');
    if (!wrap) return;

    const el = document.createElement('div');
    el.className = 'toast max-w-md mx-auto bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-lg flex items-start gap-3';

    const safeTitle = window.DOMPurify ? window.DOMPurify.sanitize(title) : title;
    const safeMessage = window.DOMPurify ? window.DOMPurify.sanitize(message) : message;

    el.innerHTML = `
      <div class="w-10 h-10 rounded-lg bg-${color}-500/20 text-${color}-300 flex items-center justify-center shrink-0">
        <i data-lucide="${variant === 'error' ? 'alert-triangle' : variant === 'warn' ? 'alert-circle' : 'check'}" class="w-6 h-6"></i>
      </div>
      <div class="flex-1">
        <p class="font-semibold">${safeTitle}</p>
        ${safeMessage ? `<p class="text-sm text-zinc-400 mt-0.5">${safeMessage}</p>` : ''}
      </div>
      <button class="shrink-0 text-zinc-400 hover:text-zinc-200" aria-label="Cerrar notificación">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>`;

    wrap.appendChild(el);

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    }

    const close = () => el.remove();
    const closeBtn = el.querySelector('button');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (timeout) setTimeout(close, timeout);
  }

  static setupSectionToggles() {
    const buttons = document.querySelectorAll('[data-toggle-target]');
    buttons.forEach((btn) => {
      const targetId = btn.dataset.toggleTarget;
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      const labelEl = btn.querySelector('[data-toggle-label]');
      const expandedLabel = btn.dataset.expandedLabel || 'Colapsar';
      const collapsedLabel = btn.dataset.collapsedLabel || 'Expandir';

      const updateState = (expanded) => {
        btn.setAttribute('aria-expanded', String(expanded));
        if (labelEl) labelEl.textContent = expanded ? expandedLabel : collapsedLabel;
      };

      const isInitiallyHidden = target.classList.contains('hidden');
      updateState(!isInitiallyHidden);

      btn.addEventListener('click', () => {
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
          target.classList.add('hidden');
          updateState(false);
        } else {
          target.classList.remove('hidden');
          updateState(true);
        }
      });
    });
  }
}
