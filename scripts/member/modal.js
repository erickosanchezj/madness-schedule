// scripts/member/modal.js
// Confirmation/success modal and bottom-navigation highlighting.
// Shared dialog with focus handling plus nav state for every screen.
// RELEVANT FILES: scripts/member/main.js, scripts/member/actions.js, scripts/member/interactions.js

let modalReturnFocus;
const genericModal = document.getElementById('generic-modal');
const modalContent = document.getElementById('modal-content');

function showModal({success, title, message, buttons}){
  const safeTitle = DOMPurify.sanitize(title);
  const safeMessage = message ? DOMPurify.sanitize(message) : '';

  if (!buttons) {
    modalContent.innerHTML = `
      <div class="w-16 h-16 ${success?'bg-orange-500/20 text-orange-400':'bg-rose-500/20 text-rose-400'} rounded-full flex items-center justify-center mx-auto">
        <i data-lucide="${success?'check':'trash-2'}" class="w-10 h-10"></i>
      </div>
      <h2 class="text-2xl font-bold">${safeTitle}</h2>
      ${safeMessage ? `<p class="text-zinc-400">${safeMessage}</p>` : ''}
      <button id="modal-close-btn" class="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg mt-4">Entendido</button>`;
    document.getElementById('modal-close-btn').onclick = hideModal;
  } else {
    const buttonsHTML = buttons.map((btn, index) => {
      const baseClasses = btn.primary
        ? 'bg-indigo-600 text-white font-bold'
        : 'bg-zinc-700 text-zinc-300 font-semibold';
      return `<button id="modal-btn-${index}" class="flex-1 ${baseClasses} py-3 rounded-lg">${DOMPurify.sanitize(btn.text)}</button>`;
    }).join('');

    modalContent.innerHTML = `
      <div class="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto">
        <i data-lucide="message-circle" class="w-10 h-10"></i>
      </div>
      <h2 class="text-2xl font-bold">${safeTitle}</h2>
      ${safeMessage ? `<p class="text-zinc-400">${safeMessage}</p>` : ''}
      <div class="flex gap-3 mt-4">${buttonsHTML}</div>`;

    buttons.forEach((btn, index) => {
      document.getElementById(`modal-btn-${index}`).onclick = () => {
        if (btn.callback) btn.callback();
        hideModal();
      };
    });
  }

  modalReturnFocus = document.activeElement;
  genericModal.classList.remove('hidden');
  if (!genericModal.open) genericModal.showModal();
  appContainer.inert = true;
  authContainer.inert = true;
  requestAnimationFrame(()=>modalContent.querySelector('button')?.focus());
  setTimeout(()=>modalContent.classList.remove('scale-95','opacity-0'),10);
  lucide.createIcons();
}
function hideModal(){
  appContainer.inert = false;
  authContainer.inert = false;
  modalContent.classList.add('scale-95','opacity-0');
  setTimeout(()=>{
    genericModal.classList.add('hidden');
    genericModal.close();
    app.navigateTo(state.currentScreen==='classDetails'?'agenda':state.currentScreen);
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
    else mainContent.focus();
  },200);
}
function updateNavButtons(){
  const navButtons = navBar.querySelectorAll('.nav-button');
  navButtons.forEach(btn=>{
    const activeScreen = state.currentScreen==='classDetails' ? 'agenda' : state.currentScreen;
    const isActive = btn.dataset.screen===activeScreen;
    if (isActive) btn.setAttribute('aria-current','page'); else btn.removeAttribute('aria-current');
    btn.classList.toggle('active-nav', isActive);
    btn.classList.toggle('text-orange-400', isActive);
    btn.classList.toggle('text-zinc-400', !isActive);
  });
}
