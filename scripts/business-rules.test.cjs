// scripts/business-rules.test.cjs
// Checks business rules in Cloud Functions with in-memory Firebase fakes.
// Guards rules the owner decided on, so a refactor cannot silently change them.
// RELEVANT FILES: functions/index.js, functions/lib/pruneTokenInUsers.js, scripts/async-hot-paths.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Runs a functions file with fake modules instead of the real Firebase SDK.
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

// Loads functions/index.js with a fake users collection and records every write.
function loadIndex(users) {
  const writes = [];
  const DELETE = { delete: true };
  const docs = users.map(u => ({ ref: { id: u.id }, data: () => u }));
  const db = {
    collection: () => ({ get: async () => ({ forEach: cb => docs.forEach(cb) }) }),
    batch: () => ({ set: (ref, fields) => writes.push({ id: ref.id, fields }), commit: async () => {} }),
  };
  const handlers = {};
  const mocks = {
    'firebase-admin': { initializeApp() {}, firestore: Object.assign(() => db, { FieldValue: { delete: () => DELETE } }) },
    'firebase-functions/v2/https': { onCall: (_o, h) => h, HttpsError: Error },
    // Capture scheduled handlers by their cron string so the test can run them directly.
    'firebase-functions/v2/scheduler': { onSchedule: (o, h) => { handlers[o.schedule] = h; return h; } },
    'firebase-admin/functions': { getFunctions: () => ({}) },
    './lib/pruneTokenInUsers': {}, './src/memberBooking': {},
  };
  for (const n of ['bookingReminders', 'totalPassReminders', 'waitlistNotifications', 'generateDailyClasses', 'userUnlockNotifications']) mocks[`./src/${n}`] = {};
  const exportsObj = load('functions/index.js', mocks);
  return { exportsObj, handlers, writes };
}

const USERS = [
  { id: 'blocked', lateCancellations: 3, blacklisted: true, blacklistedAt: 'x' },
  { id: 'two-strikes', lateCancellations: 2 },
  { id: 'clean', lateCancellations: 0 },
];

test('monthly reset clears strikes but keeps blacklisted members blocked', async () => {
  const { exportsObj, writes } = loadIndex(USERS);
  await exportsObj.automaticWhitelisting();
  // JSON round-trip: objects built inside the vm context have a different prototype.
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ id: 'two-strikes', fields: { lateCancellations: 0 } }]);
});

test('admin "reset all strikes" still unlocks blacklisted members (manual unlock)', async () => {
  const { exportsObj, writes } = loadIndex(USERS);
  const result = await exportsObj.resetAllStrikes({ auth: { token: { admin: true } }, rawRequest: { headers: {} } });
  assert.equal(result.updated, 2);
  const blocked = writes.find(w => w.id === 'blocked').fields;
  assert.equal(blocked.blacklisted, false);
  assert.equal(blocked.lateCancellations, 0);
});
