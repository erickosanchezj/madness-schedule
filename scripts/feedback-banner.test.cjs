// scripts/feedback-banner.test.cjs
// Tests scripts/member/banner.js with a fake banner element and an in-memory settings document.
// Makes sure the admin's on/off, text, link text and URL reach the member banner safely.
// RELEVANT FILES: scripts/member/banner.js, scripts/admin/banner.js, index.html, firestore.rules
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FORM = 'https://docs.google.com/forms/original';

// Loads banner.js against fake DOM nodes and a fake appSettings/feedbackBanner document.
function setup() {
  const small = { hidden: false };
  const nodes = {
    'feedback-banner': { hidden: false, href: FORM },
    'feedback-banner-title': { textContent: 'Queremos escucharte' },
    'feedback-banner-link': { textContent: 'Responder formulario', parentElement: small },
  };
  const listeners = new Set();
  const db = { collection(name) {
    assert.equal(name, 'appSettings');
    return { doc(id) {
      assert.equal(id, 'feedbackBanner');
      return { onSnapshot(next, error) {
        const listener = { next, error };
        listeners.add(listener);
        return () => listeners.delete(listener);
      } };
    } };
  } };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'member/banner.js'), 'utf8'), {
    document: { getElementById: id => nodes[id] }, window, db, console: { warn() {} },
  });
  return {
    controller: window.madnessBanner, listeners,
    banner: nodes['feedback-banner'], title: nodes['feedback-banner-title'], link: nodes['feedback-banner-link'], small,
    emit(data) { for (const l of [...listeners]) l.next({ exists: data !== undefined, data: () => data }); },
    fail() { for (const l of [...listeners]) l.error(new Error('permission-denied')); },
  };
}

test('hidden until the first answer; nothing saved keeps the banner from index.html', () => {
  const app = setup();
  app.controller.setReady(true);
  assert.equal(app.banner.hidden, true, 'no flash before the setting arrives');
  app.emit(undefined);
  assert.equal(app.banner.hidden, false);
  assert.equal(app.title.textContent, 'Queremos escucharte');
  assert.equal(app.link.textContent, 'Responder formulario');
  assert.equal(app.banner.href, FORM);
});

test('saved text, link text and URL are applied; turning it off hides the banner', () => {
  const app = setup();
  app.controller.setReady(true);
  app.emit({ enabled: true, title: 'Nueva clase de yoga', linkText: 'Ver horario', url: 'https://example.com/yoga' });
  assert.equal(app.banner.hidden, false);
  assert.equal(app.title.textContent, 'Nueva clase de yoga');
  assert.equal(app.link.textContent, 'Ver horario');
  assert.equal(app.banner.href, 'https://example.com/yoga');
  app.emit({ enabled: false, title: 'x', linkText: '', url: 'https://example.com' });
  assert.equal(app.banner.hidden, true);
});

test('empty link text hides that line; a non-https URL is ignored', () => {
  const app = setup();
  app.controller.setReady(true);
  app.emit({ enabled: true, title: 'Solo texto', linkText: '', url: 'javascript:alert(1)' });
  assert.equal(app.small.hidden, true);
  assert.equal(app.banner.href, FORM, 'keeps the previous safe link');
});

test('a read error keeps the original banner visible', () => {
  const app = setup();
  app.controller.setReady(true);
  app.fail();
  assert.equal(app.banner.hidden, false);
  assert.equal(app.title.textContent, 'Queremos escucharte');
});

test('logout stops the listener, restores the original banner and ignores late answers', () => {
  const app = setup();
  app.controller.setReady(true);
  const old = [...app.listeners][0];
  app.emit({ enabled: false, title: 'Oculto', linkText: '', url: 'https://example.com' });
  app.controller.setReady(false);
  assert.equal(app.listeners.size, 0);
  assert.equal(app.banner.hidden, false);
  assert.equal(app.title.textContent, 'Queremos escucharte');
  old.next({ exists: true, data: () => ({ enabled: false, title: 'Tarde', url: 'https://example.com' }) });
  assert.equal(app.title.textContent, 'Queremos escucharte', 'a snapshot from the old session is ignored');
});
