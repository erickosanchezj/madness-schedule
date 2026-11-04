// scripts/token-prune.test.cjs
// Checks that invalid FCM tokens are really removed from user docs.
// Guards the nested-merge write and both stored token shapes (true and metadata object).
// RELEVANT FILES: functions/lib/pruneTokenInUsers.js, functions/src/bookingReminders.js, index.html
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Loads the helper with a fake firebase-admin that records batch writes.
function loadPrune(users) {
  const writes = [];
  const DELETE = '<delete>';
  const db = {
    collection: () => ({ get: async () => ({ empty: !users.length, docs: users.map(u => ({ ref: { id: u.id }, get: k => u[k] })) }) }),
    batch: () => ({ set: (ref, data, opts) => writes.push({ id: ref.id, data: JSON.parse(JSON.stringify(data)), opts }), commit: async () => {} }),
  };
  const admin = { firestore: Object.assign(() => db, { FieldValue: { delete: () => DELETE } }) };
  const filename = path.resolve(__dirname, '../functions/lib/pruneTokenInUsers.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console: { error() {} },
    require: name => { if (name !== 'firebase-admin') throw new Error(name); return admin; },
  }, { filename });
  return { ...module.exports, writes, DELETE };
}

const USERS = [
  { id: 'old-shape', fcmTokens: { 'bad:1': true, keep: true } },
  { id: 'new-shape', fcmTokens: { 'bad:1': { userAgent: 'iPhone' } } },
  { id: 'other', fcmTokens: { keep: { userAgent: 'Android' } } },
];

test('single-token prune removes the token in both stored shapes, as a nested merge', async () => {
  const { pruneTokenInUsers, writes, DELETE } = loadPrune(USERS);
  const result = await pruneTokenInUsers('bad:1');
  assert.equal(result.prunedDocs, 2);
  assert.deepEqual(writes.map(w => w.id), ['old-shape', 'new-shape']);
  // A dotted key ("fcmTokens.bad:1") would be a literal field with set+merge; it must be nested.
  for (const w of writes) {
    assert.deepEqual(w.data, { fcmTokens: { 'bad:1': DELETE } });
    assert.equal(w.opts.merge, true);
  }
});

test('multi-token prune leaves users without bad tokens untouched', async () => {
  const { pruneMultipleTokensInUsers, writes } = loadPrune(USERS);
  assert.equal((await pruneMultipleTokensInUsers(['nope'])).prunedDocs, 0);
  assert.equal(writes.length, 0);
});
