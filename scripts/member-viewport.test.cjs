// scripts/member-viewport.test.cjs
// Checks installed-iPhone viewport setup, device padding and orientation changes.
// Guards the PWA-specific workaround without changing browser or admin behavior.
// RELEVANT FILES: scripts/member/viewport.js, styles/member-shell.css, scripts/verify-member.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'member/viewport.js'), 'utf8');

function start({ installed = true, agent = 'iPhone', width = 402, height = 874 } = {}) {
  const viewport = { content: 'width=device-width, initial-scale=1.0, interactive-widget=resizes-content' };
  const properties = new Map(), events = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value) } };
  let landscape = false;
  vm.runInNewContext(source, {
    navigator: { standalone: installed, userAgent: agent },
    document: { documentElement: root, querySelector: () => viewport },
    window: { screen: { width, height }, matchMedia: () => ({ matches: landscape }),
      addEventListener: (name, callback) => events.set(name, callback) }
  });
  return { viewport, root, events, inset: () => properties.get('--ios-home-inset'),
    rotate(value) { landscape = value; events.get('resize')?.(); } };
}

test('installed iPhone protects the home indicator and retains viewport configuration', () => {
  const app = start();
  assert.equal(app.root.dataset.iosStandalone, '');
  assert.equal(app.viewport.content, 'width=device-width, initial-scale=1.0, interactive-widget=resizes-content');
  assert.ok(app.viewport.content.includes('initial-scale=1.0'));
  assert.ok(app.viewport.content.includes('interactive-widget=resizes-content'));
  assert.equal(app.inset(), '34px');
});

test('home-indicator padding follows rotation and resume', () => {
  const app = start();
  app.rotate(true);
  assert.equal(app.inset(), '21px');
  app.rotate(false);
  app.events.get('pageshow')();
  assert.equal(app.inset(), '34px');
});

test('home-button iPhone does not get a phantom home-indicator inset', () => {
  const app = start({ width: 375, height: 667 });
  assert.equal(app.inset(), '0px');
  app.rotate(true);
  assert.equal(app.inset(), '0px');
});

test('Safari tabs, other browsers and iPads keep their original viewport', () => {
  for (const options of [{ installed: false }, { installed: undefined, agent: 'Android' }, { agent: 'iPad' }]) {
    const app = start(options);
    assert.equal(app.viewport.content, 'width=device-width, initial-scale=1.0, interactive-widget=resizes-content');
    assert.equal(app.inset(), undefined);
    assert.equal(app.events.size, 0);
    assert.deepEqual(app.root.dataset, {});
  }
});
