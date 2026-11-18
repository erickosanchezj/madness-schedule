// scripts/feedback-reel.test.cjs
// Exercises the admin switch and member reel against an in-memory settings source.
// Guards global disabling, save failures, cached settings and login cleanup.
// RELEVANT FILES: scripts/admin/feedback-reel.js, scripts/member/feedback.js, firestore.rules
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  const events = new Map();
  return {
    checked: false, disabled: true, open: false, isConnected: true,
    textContent: '', value: 0, attributes: {},
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
  const writes = [];
  const source = {
    listeners, writes, failWrite: false, pendingWrite: null,
    collection(name) {
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
    error() { for (const listener of [...listeners]) listener.error(new Error('permission-denied')); }
  };
  return source;
}

function load(file, globals) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    console: { warn() {} }, ...globals
  });
}

function member(db) {
  const nodes = Object.fromEntries(['feedback-story', 'feedback-banner', 'feedback-story-link', 'main-content'].map(id => [id, element()]));
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
  const window = {};
  load('member/feedback.js', { document, window, db,
    requestAnimationFrame: cb => { frames.set(++nextFrame, cb); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  return {
    controller: window.madnessFeedback, story: nodes['feedback-story'], pause, close,
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
