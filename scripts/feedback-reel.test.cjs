// scripts/feedback-reel.test.cjs
// Exercises the admin switch and the member reel story against in-memory settings and reels.
// Guards global disabling, save failures, cached settings, login cleanup and the reel sequence.
// RELEVANT FILES: scripts/admin/feedback-reel.js, scripts/member/feedback.js, scripts/reel-template.js, firestore.rules
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  const events = new Map();
  return {
    checked: false, disabled: true, open: false, isConnected: true,
    textContent: '', value: 0, attributes: {}, innerHTML: '', hidden: false, href: '', max: 0,
    style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
    addEventListener(name, callback) { events.set(name, callback); },
    dispatch(name, event = {}) { events.get(name)?.(event); },
    setAttribute(name, value) { this.attributes[name] = value; },
    getClientRects() { return [{}]; },
    focus() {},
    showModal() { this.open = true; },
    close() { this.open = false; this.dispatch('close'); }
  };
}

function settingsSource() {
  const listeners = new Set();
  const reelListeners = new Set();
  const writes = [];
  const reelSnapshot = list => ({ docs: list.map(reel => ({ id: reel.id, data: () => reel })), metadata: { fromCache: false } });
  const source = {
    listeners, reelListeners, writes, reels: [], slowReels: false, failWrite: false, pendingWrite: null,
    collection(name) {
      if (name === 'reels') return { where(field, op, value) {
        assert.deepEqual([field, op, value], ['active', '==', true]);
        return { onSnapshot(options, next, error) {
          assert.equal(options.includeMetadataChanges, true);
          const listener = { next, error };
          reelListeners.add(listener);
          if (!source.slowReels) next(reelSnapshot(source.reels));
          return () => reelListeners.delete(listener);
        } };
      } };
      assert.equal(name, 'appSettings');
      return { doc(id) {
        assert.equal(id, 'feedbackReel');
        return {
          onSnapshot(options, next, error) {
            assert.equal(options.includeMetadataChanges, true);
            const listener = { next, error };
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          async set(data, options) {
            writes.push({ enabled: data.enabled, merge: options.merge });
            if (source.pendingWrite) await source.pendingWrite;
            if (source.failWrite) throw new Error('permission-denied');
            source.emit(data.enabled);
          }
        };
      } };
    },
    emit(enabled, { exists = true, fromCache = false, hasPendingWrites = false } = {}) {
      const snapshot = { exists, data: () => ({ enabled }), metadata: { fromCache, hasPendingWrites } };
      for (const listener of [...listeners]) listener.next(snapshot);
    },
    error() { for (const listener of [...listeners]) listener.error(new Error('permission-denied')); },
    emitReels(list) { source.reels = list; for (const listener of [...reelListeners]) listener.next(reelSnapshot(list)); },
    failReels() { for (const listener of [...reelListeners]) listener.error(new Error('permission-denied')); }
  };
  return source;
}

function load(file, globals) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    console: { warn() {} }, ...globals
  });
}

function member(db) {
  const ids = ['feedback-story', 'feedback-banner', 'feedback-story-link', 'main-content', 'feedback-steps',
    'feedback-copy', 'feedback-action', 'feedback-cta-text', 'feedback-footer', 'feedback-seconds'];
  const nodes = Object.fromEntries(ids.map(id => [id, element()]));
  const progress = element(), pause = element(), close = element(), events = new Map();
  const frames = new Map();
  let nextFrame = 0;
  nodes['feedback-story'].querySelector = selector => selector === 'progress' ? progress : selector === '.feedback-pause' ? pause : close;
  const document = {
    hidden: false, activeElement: null,
    getElementById: id => nodes[id],
    querySelector: () => null,
    addEventListener: (name, callback) => events.set(name, callback)
  };
  const window = { innerWidth: 400 };
  // reel-template.js and feedback.js share one context, like two <script> tags on one page.
  const context = vm.createContext({ console: { warn() {} }, document, window, db,
    requestAnimationFrame: cb => { frames.set(++nextFrame, cb); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  for (const file of ['reel-template.js', 'member/feedback.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  }
  return {
    controller: window.madnessFeedback, story: nodes['feedback-story'], pause, close, nodes,
    tap(clientX) { nodes['feedback-story'].dispatch('click', { clientX, target: { closest: () => null } }); },
    resume() { document.hidden = false; events.get('visibilitychange')(); },
    clickForm() { nodes['feedback-story-link'].dispatch('click'); },
    advance(now) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(now)); }
  };
}

function admin(db) {
  const toggle = element(), status = element(), toasts = [];
  const panel = { db, showToast: toast => toasts.push(toast) };
  load('admin/feedback-reel.js', {
    AdminPanel: panel,
    document: { getElementById: id => id === 'feedback-reel-enabled' ? toggle : status }
  });
  panel.listenFeedbackReel();
  return { panel, toggle, status, toasts };
}

test('member waits for server settings, skips stale cache, and never flashes a disabled reel', () => {
  const db = settingsSource(), app = member(db);
  app.controller.setReady(true);
  assert.equal(app.story.open, false);
  db.emit(true, { fromCache: true });
  assert.equal(app.story.open, false);
  db.emit(false);
  app.resume();
  assert.equal(app.story.open, false);
  db.emit(true);
  assert.equal(app.story.open, true);
  db.emit(false);
  assert.equal(app.story.open, false, 'disabling immediately closes an active reel');
});

test('missing setting preserves five-second playback, pause and form return behavior', () => {
  const db = settingsSource(), app = member(db);
  app.controller.setReady(true);
  db.emit(undefined, { exists: false });
  assert.equal(app.story.open, true);
  app.advance(100); app.advance(5099);
  assert.equal(app.story.open, true);
  app.advance(5100);
  assert.equal(app.story.open, false);
  app.resume();
  app.pause.dispatch('click');
  app.advance(12000);
  assert.equal(app.story.open, true);
  app.clickForm();
  app.resume();
  assert.equal(app.story.open, false);
});

test('admin toggle persists globally and member sees both off and on changes', async () => {
  const db = settingsSource(), app = member(db), staff = admin(db);
  app.controller.setReady(true);
  db.emit(true);
  assert.equal(staff.toggle.checked, true);
  staff.toggle.checked = false;
  await staff.panel.saveFeedbackReel();
  assert.deepEqual(db.writes, [{ enabled: false, merge: true }]);
  assert.equal(app.story.open, false);
  assert.equal(staff.toggle.disabled, false);
  assert.match(staff.status.textContent, /Desactivado/);
  staff.toggle.checked = true;
  await staff.panel.saveFeedbackReel();
  assert.equal(app.story.open, true);
  assert.match(staff.status.textContent, /Activado/);
});

test('admin waits for server, reflects other admins, and rolls back failed saves', async () => {
  const db = settingsSource(), staff = admin(db);
  db.emit(true, { fromCache: true });
  assert.equal(staff.toggle.disabled, true);
  db.emit(true);
  assert.equal(staff.toggle.checked, true);
  db.emit(false);
  assert.equal(staff.toggle.checked, false);
  staff.toggle.checked = true;
  db.failWrite = true;
  await staff.panel.saveFeedbackReel();
  assert.equal(staff.toggle.checked, false);
  assert.equal(staff.toggle.disabled, false);
  assert.equal(staff.toasts.length, 1);
  assert.match(staff.status.textContent, /No se pudo guardar/);
});

test('settings errors suppress the member reel and prevent admin edits', () => {
  const db = settingsSource(), app = member(db), staff = admin(db);
  app.controller.setReady(true);
  db.emit(true);
  db.error();
  app.resume();
  assert.equal(app.story.open, false);
  assert.equal(staff.toggle.disabled, true);
});

test('logout unsubscribes, ignores late snapshots, and allows a clean new login', () => {
  const db = settingsSource(), app = member(db);
  app.controller.setReady(true);
  app.controller.setReady(true);
  assert.equal(db.listeners.size, 1);
  const old = [...db.listeners][0];
  db.emit(true);
  app.controller.setReady(false);
  assert.equal(db.listeners.size, 0);
  old.next({ exists: false });
  app.resume();
  assert.equal(app.story.open, false);
  app.controller.setReady(true);
  assert.equal(db.listeners.size, 1);
  db.emit(false);
  assert.equal(app.story.open, false);
});

test('logout while saving cannot restore an admin control from the old session', async () => {
  const db = settingsSource(), staff = admin(db);
  db.emit(true);
  let resolve;
  db.pendingWrite = new Promise(done => { resolve = done; });
  staff.toggle.checked = false;
  const save = staff.panel.saveFeedbackReel();
  assert.equal(staff.toggle.disabled, true);
  await staff.panel.saveFeedbackReel();
  assert.equal(db.writes.length, 1, 'duplicate writes are blocked while saving');
  staff.panel.stopFeedbackReel();
  resolve();
  await save;
  assert.equal(staff.toggle.disabled, true);
  assert.equal(db.listeners.size, 0);
});

test('active reels play in staff order, each with its own seconds, then the story closes', () => {
  const db = settingsSource(), app = member(db);
  db.reels = [
    { id: 'b', order: 2, seconds: 3, title: 'Segundo', ctaText: '', ctaUrl: '' },
    { id: 'a', order: 1, seconds: 4, title: 'Primero', highlight: 'rosa', ctaText: 'Ver', ctaUrl: 'https://example.com', footer: 'Pie' },
  ];
  app.controller.setReady(true);
  db.emit(true);
  assert.equal(app.story.open, true);
  assert.match(app.nodes['feedback-copy'].innerHTML, /Primero <span>rosa<\/span>/);
  assert.equal(app.nodes['feedback-story-link'].href, 'https://example.com');
  assert.equal(app.nodes['feedback-cta-text'].textContent, 'Ver');
  assert.equal(app.nodes['feedback-seconds'].textContent, '4 s');
  assert.match(app.nodes['feedback-steps'].innerHTML, /is-current/);
  app.advance(100); app.advance(4099);
  assert.match(app.nodes['feedback-copy'].innerHTML, /Primero/);
  app.advance(4100);
  assert.match(app.nodes['feedback-copy'].innerHTML, /Segundo/, 'moves to the next reel after 4 s');
  assert.equal(app.nodes['feedback-action'].hidden, true, 'no link hides the button');
  assert.match(app.nodes['feedback-steps'].innerHTML, /is-done.*is-current/);
  app.advance(5000); app.advance(8000);
  assert.equal(app.story.open, false, 'closes after the last reel');
});

test('taps move forward and back; past the last reel closes the story', () => {
  const db = settingsSource(), app = member(db);
  db.reels = [{ id: 'a', order: 1, title: 'Uno' }, { id: 'b', order: 2, title: 'Dos' }];
  app.controller.setReady(true);
  db.emit(true);
  app.tap(300);
  assert.match(app.nodes['feedback-copy'].innerHTML, /Dos/);
  app.tap(20); // left 30% of the screen
  assert.match(app.nodes['feedback-copy'].innerHTML, /Uno/);
  app.tap(300); app.tap(300);
  assert.equal(app.story.open, false);
});

test('no active reels (or unreadable reels) show the original reel; editor text is escaped', () => {
  let db = settingsSource(), app = member(db);
  app.controller.setReady(true);
  db.emit(true);
  assert.match(app.nodes['feedback-copy'].innerHTML, /Tu voz nos<br>hace <span>más fuertes\.<\/span>/);
  assert.equal(app.nodes['feedback-seconds'].textContent, '5 s');

  db = settingsSource(); app = member(db);
  db.reels = [{ id: 'x', order: 1, title: '<img src=x onerror=alert(1)>' }];
  app.controller.setReady(true);
  db.emit(true);
  assert.match(app.nodes['feedback-copy'].innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(app.nodes['feedback-copy'].innerHTML, /<img/);
});

test('the story waits for the reels and keeps its reels while open', () => {
  const db = settingsSource(), app = member(db);
  // Slow reels answer: the switch is on, but the story must not open with the original reel first.
  db.slowReels = true;
  app.controller.setReady(true);
  db.emit(true);
  assert.equal(app.story.open, false, 'waits for the reels');
  db.reelListeners.forEach(listener => listener.next({ docs: [], metadata: { fromCache: true } }));
  assert.equal(app.story.open, false, 'a cached answer is not enough');
  db.emitReels([{ id: 'a', order: 1, title: 'Promo' }]);
  assert.equal(app.story.open, true);
  assert.match(app.nodes['feedback-copy'].innerHTML, /Promo/);
  db.emitReels([{ id: 'z', order: 1, title: 'Otro' }]);
  assert.match(app.nodes['feedback-copy'].innerHTML, /Promo/, 'an open story is not swapped mid-play');
  app.controller.setReady(false);
  assert.equal(db.reelListeners.size, 0, 'logout stops the reels listener');
});

test('reels read errors fall back to the original reel', () => {
  const db = settingsSource(), app = member(db);
  app.controller.setReady(true);
  db.failReels();
  db.emit(true);
  assert.equal(app.story.open, true);
  assert.match(app.nodes['feedback-copy'].innerHTML, /más fuertes/);
});
