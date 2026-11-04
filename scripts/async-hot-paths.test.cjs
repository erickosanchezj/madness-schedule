// scripts/async-hot-paths.test.cjs
// Checks concurrency, ordering, and failure handling in Firebase hot paths using local fakes.
// Prevents async optimizations from changing notification targeting or scheduling behavior.
// RELEVANT FILES: functions/lib/mapConcurrent.js, functions/lib/sendMulticast.js, functions/src/generateDailyClasses.js, scripts/member/auth.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { mapConcurrent } = require('../functions/lib/mapConcurrent');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function load(file, mocks) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console: { log() {}, warn() {}, error() {} },
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    },
  }, { filename });
  return module.exports;
}

test('bounded map overlaps work, preserves order, and handles empty input', async () => {
  const gates = Array.from({ length: 7 }, deferred);
  const started = [];
  const result = mapConcurrent(gates, async (gate, index) => {
    started.push(index);
    await gate.promise;
    return index;
  });
  assert.deepEqual(started, [0, 1, 2]);
  gates[2].resolve(); await tick();
  assert.deepEqual(started, [0, 1, 2, 3]);
  gates.forEach(gate => gate.resolve());
  assert.deepEqual(await result, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(await mapConcurrent([], () => assert.fail()), []);
});

test('bounded map drains in-flight work and stops scheduling after failure', async () => {
  const gates = Array.from({ length: 5 }, deferred);
  const started = [];
  let settled = false;
  const result = mapConcurrent(gates, (gate, index) => {
    started.push(index);
    return gate.promise;
  });
  const rejection = assert.rejects(result, /delivery failed/).then(() => { settled = true; });
  gates[0].reject(new Error('delivery failed')); await tick();
  assert.equal(settled, false);
  assert.deepEqual(started, [0, 1, 2]);
  gates[1].resolve(); gates[2].resolve();
  await rejection;
});

test('multicast respects 500-token chunks and matches responses after out-of-order completion', async () => {
  const calls = [], gates = Array.from({ length: 4 }, deferred);
  const { sendMulticast } = load('functions/lib/sendMulticast.js', {
    './mapConcurrent': { mapConcurrent },
    'firebase-admin': { messaging: () => ({ sendEachForMulticast: message => {
      const index = calls.length;
      calls.push(message);
      return gates[index].promise.then(() => ({
        responses: message.tokens.map(token => ({ token, success: token !== 't501' })),
        successCount: message.tokens.filter(token => token !== 't501').length,
        failureCount: message.tokens.includes('t501') ? 1 : 0,
      }));
    } }) },
  });
  const tokens = Array.from({ length: 1601 }, (_, i) => `t${i}`);
  const pending = sendMulticast({ tokens, notification: { title: 'Test' }, data: { classId: 'class' } });
  assert.equal(calls.length, 3);
  gates[1].resolve(); await tick();
  assert.equal(calls.length, 4);
  gates.forEach(gate => gate.resolve());
  const result = await pending;
  assert.deepEqual(calls.map(call => call.tokens.length), [500, 500, 500, 101]);
  assert.deepEqual(Array.from(result.responses, response => response.token), tokens);
  assert.equal(result.responses[501].success, false);
  assert.equal(result.successCount, 1600);
  assert.equal(result.failureCount, 1);
  assert.ok(calls.every(call => call.data.classId === 'class'));
  assert.equal((await sendMulticast({ tokens: [] })).responses.length, 0);
});

test('weekly generation overlaps unique UTC date reads and keeps duplicate/idempotency rules', async () => {
  const reads = [], writes = [], gates = [], order = [];
  const templates = Array.from({ length: 7 }, (_, day) => ({
    id: String(day), data: () => ({ classes: [
      { name: 'TRX', time: '10:00' }, { name: 'duplicate', time: '10:00' },
      { name: 'Yoga', time: '23:00' },
    ] }),
  }));
  const db = {
    batch: () => ({ set: (ref, data) => writes.push({ ref, data }), commit: async () => order.push('commit') }),
    collection: name => {
      if (name === 'schedule_template') return { get: async () => ({ empty: false, forEach: cb => templates.forEach(cb) }) };
      if (name === 'notifications') return { add: async () => order.push('summary') };
      assert.equal(name, 'classes');
      return {
        doc: id => ({ id }),
        where: (_field, _op, date) => ({ get: () => {
          reads.push(date);
          const gate = deferred(); gates.push(gate);
          return gate.promise.then(() => ({ docs: [{ get: () => '16:00' }] }));
        } }),
      };
    },
  };
  const { generateDailyClasses } = load('functions/src/generateDailyClasses.js', {
    'firebase-functions/v2/scheduler': { onSchedule: (_opts, handler) => handler },
    'firebase-admin': { firestore: Object.assign(() => db, {
      Timestamp: { fromDate: date => ({ toDate: () => date }) },
      FieldValue: { increment: value => ({ increment: value }), serverTimestamp: () => 'now' },
    }) },
    '../lib/mapConcurrent': { mapConcurrent },
  });
  const pending = generateDailyClasses(); await tick();
  assert.equal(reads.length, 3);
  assert.equal(writes.length, 0);
  for (let i = 0; i < 7; i++) { gates.forEach(gate => gate.resolve()); await tick(); }
  const result = await pending;
  assert.equal(reads.length, 7); // Six days plus Saturday's late class on UTC Sunday.
  assert.equal(new Set(reads).size, reads.length);
  assert.equal(result.created, 6); // Morning slots exist; duplicate templates must also be skipped.
  assert.equal(new Set(writes.map(write => write.ref.id)).size, 6);
  assert.ok(writes.every(write => write.ref.id.startsWith('generated_') && write.data.time === '05:00'));
  assert.deepEqual(order, ['commit', 'summary']);
});

test('cancellation cleans both task groups concurrently only after transaction commit', async () => {
  const deleted = [], gate = deferred();
  let committed = false;
  const booking = { reminderTaskNames: ['regular'], totalPassTaskNames: ['totalpass'] };
  const db = {
    collection: name => ({ doc: id => ({ name, id }) }),
    runTransaction: async callback => {
      await callback({
        get: async ref => ({ exists: true, data: () => ref.name === 'bookings' ? booking : {} }),
        update() {}, delete() {}, set() {},
      });
      committed = true;
    },
  };
  const firestore = Object.assign(() => db, {
    FieldValue: { serverTimestamp: () => 'now', increment: n => n },
    Timestamp: Object.assign(class {}, { now: () => ({ toDate: () => new Date() }) }),
  });
  const mocks = {
    'firebase-admin': { initializeApp() {}, firestore },
    'firebase-functions/v2/https': { onCall: (_opts, handler) => handler, HttpsError: Error },
    'firebase-functions/v2/scheduler': { onSchedule: () => {} },
    'firebase-admin/functions': { getFunctions: () => ({ taskQueue: target => ({
      delete: task => { assert.ok(committed); deleted.push({ target, task }); return gate.promise; },
    }) }) },
    './lib/pruneTokenInUsers': {}, './src/memberBooking': {},
  };
  for (const name of ['bookingReminders', 'totalPassReminders', 'waitlistNotifications', 'generateDailyClasses', 'userUnlockNotifications']) mocks[`./src/${name}`] = {};
  const { cancelBooking } = load('functions/index.js', mocks);
  const pending = cancelBooking({ auth: { uid: 'member' }, data: { classId: 'class' } });
  await tick();
  assert.deepEqual(deleted.map(item => item.task), ['regular', 'totalpass']);
  gate.reject(new Error('cleanup failure')); // Best effort cleanup must not fail cancellation.
  assert.equal((await pending).success, true);
});

test('member auth starts agenda listeners while push setup is still pending', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../scripts/member/auth.js'), 'utf8');
  const callback = '(' + source.match(/auth\.onAuthStateChanged\((async user => \{[\s\S]*?)\n  \}\);/)[1] + '\n})';
  const push = deferred();
  let listened = false, rendered = false, hidden = false;
  const context = {
    console, state: { currentScreen: 'agenda' },
    loadingSpinner: { classList: { remove() {}, add() { hidden = true; } } },
    db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({}) }) }) }) },
    authContainer: { style: {} }, appContainer: { style: {} },
    ensureFreshFcmToken: () => push.promise,
    document: { addEventListener() {} }, window: { addEventListener() {} },
    resumeRefreshHandlersAttached: false, AGENDA_SCREENS: ['agenda'],
    refreshAgendaListenersOnResume() {}, attachAgendaListeners() { listened = true; }, applyUserData() {},
    scheduleRender() { rendered = true; },
  };
  const handler = vm.runInNewContext(callback, context);
  await handler({ uid: 'member' });
  assert.ok(listened && rendered && hidden);
  push.reject(new Error('push unavailable')); await tick();
});

test('unlock notification overlaps token cleanup and logging with correct failed-token targeting', async () => {
  const gate = deferred(), cleaned = [], records = [];
  const { onUserUnlockNotification } = load('functions/src/userUnlockNotifications.js', {
    'firebase-functions/v2/firestore': { onDocumentUpdated: (_opts, handler) => handler },
    'firebase-admin': { firestore: Object.assign(() => ({ collection: () => ({
      add: record => { records.push(record); return gate.promise; },
    }) }), { FieldValue: { serverTimestamp: () => 'now' } }) },
    '../lib/pruneTokenInUsers': { pruneMultipleTokensInUsers: tokens => {
      cleaned.push(...tokens); return gate.promise;
    } },
    '../lib/sendMulticast': { sendMulticast: async () => ({
      responses: [{ success: true }, { success: false, error: { code: 'messaging/registration-token-not-registered' } }],
      successCount: 1, failureCount: 1,
    }) },
  });
  const pending = onUserUnlockNotification({ params: { userId: 'member' }, data: {
    before: { data: () => ({ blacklisted: true }) },
    after: { data: () => ({ blacklisted: false, fcmTokens: { good: true, bad: true } }) },
  } });
  await tick();
  assert.deepEqual(cleaned, ['bad']);
  assert.equal(records.length, 1);
  assert.equal(records[0].successCount, 1);
  assert.equal(records[0].failureCount, 1);
  gate.resolve(); await pending;
});

test('waitlist expiration is queued only after both hold writes complete', async () => {
  const holds = [deferred(), deferred()], written = [], queued = [];
  const user = { fcmTokens: { good: true } };
  const db = { collection: name => ({
    doc: id => ({
      get: async () => ({ exists: true, get: key => (name === 'users' ? user : { name: 'Yoga' })[key] }),
      set: data => { written.push({ name, id, data }); return holds[written.length - 1].promise; },
    }),
    add: async () => {},
  }) };
  const { processWaitlistNotification } = load('functions/src/waitlistNotifications.js', {
    'firebase-functions/v2/firestore': { onDocumentDeleted: () => {} },
    'firebase-functions/v2/tasks': { onTaskDispatched: () => {} },
    'firebase-admin': { firestore: Object.assign(() => db, {
      Timestamp: { fromMillis: n => n }, FieldValue: { serverTimestamp: () => 'now' },
    }) },
    'firebase-admin/functions': { getFunctions: () => ({ taskQueue: () => ({
      enqueue: async data => queued.push(data),
    }) }) },
    '../lib/pruneTokenInUsers': { pruneMultipleTokensInUsers: async () => {} },
    '../lib/sendMulticast': { sendMulticast: async () => ({
      responses: [{ success: true }], successCount: 1, failureCount: 0,
    }) },
  });
  const pending = processWaitlistNotification({ id: 'wait', classId: 'class', userId: 'member' });
  await tick();
  assert.deepEqual(written.map(write => write.name), ['waitlists', 'classes']);
  assert.equal(queued.length, 0);
  holds[1].resolve(); await tick();
  assert.equal(queued.length, 0);
  holds[0].resolve(); await pending;
  assert.equal(queued.length, 1);
  assert.equal(queued[0].waitlistId, 'wait');
});
