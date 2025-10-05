// /scripts/admin/admin-notifications.js
// Handles admin notification feed rendering and listener setup
// Splitting this keeps notification-specific logic out of broader analytics modules
// RELEVANT FILES: scripts/admin/admin-state.js, scripts/admin/admin-bootstrap.js, scripts/admin/admin-attendance-dashboard.js

import { AdminPanel } from './admin-state.js';

AdminPanel.listenRecentNotifications = function listenRecentNotifications() {
  if (this.state.unsubRecentNotifs) this.state.unsubRecentNotifs();
  this.state.unsubRecentNotifs = this.db
    .collection('notifications')
    .orderBy('sentAt', 'desc')
    .limit(10)
    .onSnapshot(async (snapshot) => {
      const notifs = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const [cls, usr] = await Promise.all([
            data.classId ? this.db.collection('classes').doc(data.classId).get() : null,
            data.userId ? this.db.collection('users').doc(data.userId).get() : null
          ]);
          return {
            id: doc.id,
            ...data,
            className: cls?.data()?.name || cls?.data()?.title || data.classId || '',
            userName: usr?.data()?.displayName || usr?.data()?.email || data.userId || ''
          };
        })
      );
      this.state.recentNotifications = notifs;
      this.renderRecentNotifications();
    }, (err) => {
      console.error(err);
      this.showToast({ title: 'Error cargando notificaciones', message: err.message, variant: 'error' });
    });
};

AdminPanel.renderRecentNotifications = function renderRecentNotifications() {
  const list = document.getElementById('recent-notifs');
  if (!list) return;
  if (!this.state.recentNotifications.length) {
    list.innerHTML = '<li class="text-zinc-500">No hay notificaciones.</li>';
    return;
  }

  list.innerHTML = this.state.recentNotifications
    .map((n) => {
      const sent = n.sentAt?.toDate ? n.sentAt.toDate() : null;
      const when = sent ? `${this.dayShortFmt.format(sent)} ${this.timeFmt.format(sent)}` : '—';
      const safeWhen = DOMPurify.sanitize(when);
      const safeClass = DOMPurify.sanitize(n.className || n.classId || '');
      const safeUser = DOMPurify.sanitize(n.userName || n.userId || '');
      const safeType = DOMPurify.sanitize(n.type || 'Notificación');
      const safeTitle = DOMPurify.sanitize(n.title || '');
      const safeBody = DOMPurify.sanitize(n.body || '');
      const tokensUsed = Array.isArray(n.tokensUsed) ? n.tokensUsed : [];
      const successCount = typeof n.successCount === 'number' ? n.successCount : null;
      const failureCount = typeof n.failureCount === 'number' ? n.failureCount : null;
      const totalFromCounts = (successCount !== null || failureCount !== null)
        ? (Number(successCount || 0) + Number(failureCount || 0))
        : null;
      const totalDevicesRaw = Number.isFinite(n.totalTokens)
        ? n.totalTokens
        : (tokensUsed.length > 0 ? tokensUsed.length : (totalFromCounts ?? 0));
      const safeTotalDevices = DOMPurify.sanitize(String(totalDevicesRaw));
      const safeSuccess = successCount !== null ? DOMPurify.sanitize(String(successCount)) : '';
      const safeFailure = failureCount !== null ? DOMPurify.sanitize(String(failureCount)) : '';
      const infoLines = [];
      if (safeClass) infoLines.push(`<span class="text-xs text-zinc-300">Clase: ${safeClass}</span>`);
      if (safeUser) infoLines.push(`<span class="text-xs text-zinc-400">Usuario: ${safeUser}</span>`);
      if (n.interval) {
        const safeInterval = DOMPurify.sanitize(`${n.interval}m`);
        infoLines.push(`<span class="text-xs text-zinc-500">Intervalo: ${safeInterval}</span>`);
      }
      const statsBadges = [];
      statsBadges.push(`<span class="px-2 py-1 rounded-md bg-zinc-900 text-xs text-zinc-200 border border-zinc-700">Dispositivos: ${safeTotalDevices}</span>`);
      if (successCount !== null) {
        statsBadges.push(`<span class="px-2 py-1 rounded-md bg-emerald-500/10 text-xs text-emerald-400 border border-emerald-500/40">Éxitos: ${safeSuccess}</span>`);
      }
      if (failureCount !== null) {
        statsBadges.push(`<span class="px-2 py-1 rounded-md bg-rose-500/10 text-xs text-rose-400 border border-rose-500/40">Fallos: ${safeFailure}</span>`);
      }
      const failedTokens = Array.isArray(n.failedTokens) ? n.failedTokens : [];
      const failedDetails = failedTokens.length
        ? (() => {
            const safeFailedCount = DOMPurify.sanitize(String(failedTokens.length));
            const items = failedTokens
              .map((ft) => {
                const tokenDisplay = ft?.token ? `${String(ft.token).substring(0, 30)}…` : 'Token desconocido';
                const safeTokenDisplay = DOMPurify.sanitize(tokenDisplay);
                const safeError = DOMPurify.sanitize(ft?.errorCode || 'unknown');
                return `<li class="py-2 border-t border-zinc-800 first:border-t-0">
                  <p class="text-xs text-zinc-300 font-mono break-all">${safeTokenDisplay}</p>
                  <p class="text-[11px] text-rose-400 mt-1">Error: ${safeError}</p>
                </li>`;
              })
              .join('');
            return `<details class="mt-3 bg-zinc-900/60 rounded-lg border border-zinc-700/60">
              <summary class="cursor-pointer px-3 py-2 text-xs text-zinc-200">Ver tokens fallidos (${safeFailedCount})</summary>
              <ul class="px-3 pb-3">${items}</ul>
            </details>`;
          })()
        : '';
      const bodySection = safeBody ? `<p class="text-sm text-zinc-300">${safeBody}</p>` : '';
      const titleSection = safeTitle ? `<h4 class="text-sm font-semibold text-white">${safeTitle}</h4>` : '';
      const infoSection = infoLines.length ? `<div class="flex flex-wrap gap-3">${infoLines.join('')}</div>` : '';
      return `
        <li class="mb-3">
          <div class="p-4 bg-zinc-700/50 rounded-lg border border-zinc-600/40 space-y-4">
            <div class="flex flex-col gap-1">
              <p class="text-[11px] uppercase tracking-wide text-zinc-400">${safeType}</p>
              ${titleSection}
              <p class="text-xs text-zinc-400">${safeWhen}</p>
            </div>
            ${bodySection}
            ${infoSection}
            <div class="flex flex-wrap gap-2">${statsBadges.join('')}</div>
            ${failedDetails}
          </div>
        </li>`;
    })
    .join('');
};
