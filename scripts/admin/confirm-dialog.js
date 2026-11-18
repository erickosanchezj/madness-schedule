// scripts/admin/confirm-dialog.js
// Red confirm dialog for destructive admin actions (delete a class, reset all strikes).
// Native confirm() cannot be styled or ask for a typed word; this dialog can.
// RELEVANT FILES: scripts/admin/class-modal.js, scripts/admin/blacklist.js, styles/admin-shell.css

Object.assign(AdminPanel, {

  // Resolves true only when the admin presses the red button.
  // requireText: optional word the admin must type first (e.g. "RESET") for very risky actions.
  confirmDanger({ title, message, confirmLabel = 'Eliminar', requireText = '' }){
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'admin-confirm';
      dialog.setAttribute('aria-labelledby', 'admin-confirm-title');
      const safeWord = DOMPurify.sanitize(requireText);
      dialog.innerHTML = `<form method="dialog">
        <h2 id="admin-confirm-title">${DOMPurify.sanitize(title)}</h2>
        <p>${DOMPurify.sanitize(message)}</p>
        ${requireText ? `
          <label class="field-label" for="admin-confirm-input">Escribe <strong>${safeWord}</strong> para confirmar</label>
          <input id="admin-confirm-input" autocomplete="off" class="w-full bg-zinc-700 text-white p-2 rounded-md">` : ''}
        <div class="admin-confirm-actions">
          <button type="button" class="bg-zinc-600 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md">Cancelar</button>
          <button type="submit" value="ok" class="admin-danger-btn"${requireText ? ' disabled' : ''}>${DOMPurify.sanitize(confirmLabel)}</button>
        </div>
      </form>`;

      const okBtn = dialog.querySelector('button[type="submit"]');
      const input = dialog.querySelector('input');
      // The red button only unlocks when the typed word matches exactly.
      if (input) input.addEventListener('input', () => { okBtn.disabled = input.value.trim() !== requireText; });
      dialog.querySelector('button[type="button"]').onclick = () => dialog.close('cancel');

      const previousFocus = document.activeElement;
      // "close" fires for the red button, Cancelar and the Escape key alike.
      dialog.addEventListener('close', () => {
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(dialog.returnValue === 'ok');
      }, { once: true });

      document.body.append(dialog);
      dialog.showModal();
      // Start on the safe choice (or the text box when a word is required).
      (input || dialog.querySelector('button[type="button"]')).focus();
    });
  },
});
