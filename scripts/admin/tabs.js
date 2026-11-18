// scripts/admin/tabs.js
// Switches the admin panel between its four tabs: Semana, Miembros, Reportes and Avisos.
// The panel used to be one long page; tabs keep each group of tools on its own screen.
// RELEVANT FILES: admin.html, styles/admin-shell.css, scripts/admin/calendar.js, scripts/admin/init.js

Object.assign(AdminPanel, {

  // Shows one tab panel and hides the others.
  // The tab name is saved in the URL hash (#miembros) so a reload keeps the same tab.
  showTab(name, { focus = false } = {}){
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const target = tabs.find(tab => tab.dataset.tab === name) || tabs[0];
    if (!target) return;

    tabs.forEach(tab => {
      const active = tab === target;
      tab.setAttribute('aria-selected', String(active));
      // Only the active tab is in the Tab order; arrows move between tabs.
      tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-tab-panel]').forEach(panel => {
      panel.hidden = panel.dataset.tabPanel !== target.dataset.tab;
    });

    if (focus) target.focus();
    // replaceState changes the hash without jumping the page to an element.
    history.replaceState(null, '', `#${target.dataset.tab}`);
    window.scrollTo(0, 0);

    // The "now" line measures the calendar, so redraw it once the tab is visible.
    if (target.dataset.tab === 'semana' && this.updateCurrentTimeIndicator) {
      this.updateCurrentTimeIndicator();
    }
  },

  setupTabs(){
    const tabs = [...document.querySelectorAll('[data-tab]')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.showTab(tab.dataset.tab));
      // Standard tablist keys: left/right (or up/down in the sidebar), Home and End.
      tab.addEventListener('keydown', (event) => {
        const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next = null;
        if (event.key in moves) next = (index + moves[event.key] + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        this.showTab(tabs[next].dataset.tab, { focus: true });
      });
    });
    this.showTab(location.hash.slice(1));
  },
});

AdminPanel.setupTabs();
