// scripts/app-accessibility.js
// Adds connection guidance and a keyboard accessible profile-name dialog.
// Keeps these presentation helpers separate from Firebase business rules.
// RELEVANT FILES: index.html, admin.html, styles/app.css
(() => {
  const status = document.createElement('div');
  status.className = 'connection-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  document.body.prepend(status);
  const updateConnection = () => {
    status.hidden = navigator.onLine;
    status.textContent = 'Sin conexión. Los datos guardados pueden estar desactualizados. Reservar y confirmar cambios requiere internet.';
  };
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  updateConnection();

  window.madnessNameDialog = currentName => new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.id = 'name-dialog';
    dialog.setAttribute('aria-labelledby', 'name-dialog-title');
    dialog.innerHTML = `<form method="dialog">
      <h2 id="name-dialog-title">Editar nombre</h2>
      <label class="field-label" for="display-name">Nombre y apellido</label>
      <input id="display-name" name="displayName" autocomplete="name" required>
      <div class="actions">
        <button type="button">Cancelar</button>
        <button type="submit" class="btn-primary">Guardar</button>
      </div>
    </form>`;
    const previousFocus = document.activeElement;
    document.body.append(dialog);
    const input = dialog.querySelector('input');
    input.value = currentName;
    let value = null;
    dialog.querySelector('form').addEventListener('submit', event => {
      if (!input.value.trim()) { event.preventDefault(); input.setCustomValidity('Escribe tu nombre.'); input.reportValidity(); return; }
      value = input.value.trim();
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
    dialog.querySelector('button[type="button"]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(value);
    }, { once: true });
    dialog.showModal();
    input.focus();
  });
})();

// The staff modal keeps its existing save/cancel handlers and gains focus containment.
(() => {
  const modal = document.getElementById('class-modal');
  if (!modal) return;
  const main = document.getElementById('main-content');
  const panel = modal.firstElementChild;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'modal-title');
  let returnFocus;
  let wasOpen = false;
  const focusables = () => [...modal.querySelectorAll('button, input, select, textarea, [tabindex="0"]')]
    .filter(el => !el.disabled && el.getClientRects().length);
  const sync = () => {
    const open = !modal.classList.contains('hidden');
    if (open === wasOpen) return;
    wasOpen = open;
    main.inert = open;
    if (open) {
      if (!modal.contains(document.activeElement)) returnFocus = document.activeElement;
      focusables()[0]?.focus();
    } else if (returnFocus?.isConnected) returnFocus.focus();
  };
  // Capture the trigger before existing code focuses a modal field.
  document.addEventListener('click', () => {
    if (!wasOpen && !modal.contains(document.activeElement)) returnFocus = document.activeElement;
  }, true);
  new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['class'] });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { document.getElementById('cancel-button').click(); return; }
    if (event.key !== 'Tab') return;
    const controls = focusables();
    if (document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1))) {
      event.preventDefault();
      (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
    }
  });
})();
