// scripts/admin/confirm-dialog.js
// Branded confirm dialog for every admin confirmation; red for destructive actions.
// Native confirm() cannot be styled, explain consequences well, or ask for a typed word.
// RELEVANT FILES: scripts/admin/class-modal.js, scripts/admin/blacklist.js, styles/admin-shell.css

Object.assign(AdminPanel, {

  // Resolves true only when the admin presses the confirm button.
  // danger: red button and border, for actions that delete or block something.
  // requireText: optional word the admin must type first (e.g. "RESET") for very risky actions.
  // reasonLabel: shows an optional text box; then the dialog resolves { reason } instead of true.
  confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false, requireText = '', reasonLabel = '' }){
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = danger ? 'admin-confirm is-danger' : 'admin-confirm';
      dialog.setAttribute('aria-labelledby', 'admin-confirm-title');
      const safeWord = DOMPurify.sanitize(requireText);
      dialog.innerHTML = `<form method="dialog">
        <h2 id="admin-confirm-title">${DOMPurify.sanitize(title)}</h2>
        <p>${DOMPurify.sanitize(message)}</p>
        ${requireText ? `
          <label class="field-label" for="admin-confirm-input">Escribe <strong>${safeWord}</strong> para confirmar</label>
          <input id="admin-confirm-input" autocomplete="off" class="w-full bg-zinc-700 text-white p-2 rounded-md">` : ''}
        ${reasonLabel ? `
          <label class="field-label" for="admin-confirm-reason">${DOMPurify.sanitize(reasonLabel)}</label>
          <input id="admin-confirm-reason" maxlength="140" autocomplete="off" class="w-full bg-zinc-700 text-white p-2 rounded-md">` : ''}
        <div class="admin-confirm-actions">
          <button type="button" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
          <button type="submit" value="ok" class="${danger ? 'admin-danger-btn' : 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md'}"${requireText ? ' disabled' : ''}>${DOMPurify.sanitize(confirmLabel)}</button>
        </div>
      </form>`;

      const okBtn = dialog.querySelector('button[type="submit"]');
      const input = dialog.querySelector('#admin-confirm-input');
      const reasonInput = dialog.querySelector('#admin-confirm-reason');
      // The red button only unlocks when the typed word matches exactly.
      if (input) input.addEventListener('input', () => { okBtn.disabled = input.value.trim() !== requireText; });
      dialog.querySelector('button[type="button"]').onclick = () => dialog.close('cancel');

      const previousFocus = document.activeElement;
      // "close" fires for the red button, Cancelar and the Escape key alike.
      dialog.addEventListener('close', () => {
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
        const ok = dialog.returnValue === 'ok';
        resolve(ok && reasonInput ? { reason: reasonInput.value.trim() } : ok);
      }, { once: true });

      document.body.append(dialog);
      dialog.showModal();
      // Start on the safe choice (or the text box when a word is required).
      (input || reasonInput || dialog.querySelector('button[type="button"]')).focus();
    });
  },
});
