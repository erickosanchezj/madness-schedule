// scripts/cancel-class.test.cjs
// Tests the admin cancelClass callable with in-memory Firebase fakes (no network, no real database).
// Makes sure booked and waitlisted members are notified once, before the class is deleted.
// RELEVANT FILES: functions/src/cancelClass.js, functions/index.js, scripts/admin/class-crud.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Loads functions/src/cancelClass.js with fake Firebase modules.
function setup({ cls, bookings = [], waitlist = [], users = {}, pushFails = false }) {
  const log = [];
  const sent = [];
  const pruned = [];
  const db = { deleted: null, notification: null };
  const snapOf = (id, data) => ({ id, exists: data !== undefined, data: () => data, get: key => data?.[key], ref: { id } });
  db.collection = name => ({
    doc: id => ({ id, get: async () => snapOf(id, name === 'classes' ? cls : users[id]) }),
    where: (field, _op, value) => ({ get: async () => {
      const rows = (name === 'bookings' ? bookings : waitlist).filter(row => row[field] === value);
      return { docs: rows.map(row => snapOf(row.id, row)), size: rows.length };
    } }),
    add: async data => { log.push('notification'); db.notification = data; },
  });
  db.batch = () => {
    const deletes = [];
    return { delete: ref => deletes.push(ref.id), commit: async () => { log.push('commit'); db.deleted = deletes; } };
  };
  const mocks = {
    'firebase-admin': { firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'now' } }) },
    'firebase-functions/v2/https': { HttpsError },
    '../lib/sendMulticast': { sendMulticast: async message => {
      log.push('push');
      if (pushFails) throw new Error('FCM down');
      sent.push(message);
      const responses = message.tokens.map(token => token === 'dead'
        ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
        : { success: true });
      return { responses, successCount: responses.filter(r => r.success).length, failureCount: responses.filter(r => !r.success).length };
    } },
    '../lib/pruneTokenInUsers': { pruneMultipleTokensInUsers: async tokens => { pruned.push(...tokens); } },
  };
  const filename = path.resolve(__dirname, '../functions/src/cancelClass.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console: { log() {}, warn() {}, error() {} },
    require: name => { if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`); return mocks[name]; },
  }, { filename });
  return { cancelClass: module.exports.cancelClass, db, log, sent, pruned };
}

const admin = { auth: { token: { admin: true } } };
// 2026-11-20 00:00 UTC is Thursday 19 Nov, 18:00 in Mexico City.
const trx = { name: 'TRX', classDate: '2026-11-20', time: '00:00' };

test('only admins can cancel, and a class id is required', async () => {
  const { cancelClass, db } = setup({ cls: trx });
  await assert.rejects(cancelClass({ data: { classId: 'c1' } }), { code: 'unauthenticated' });
  await assert.rejects(cancelClass({ auth: { token: {} }, data: { classId: 'c1' } }), { code: 'permission-denied' });
  await assert.rejects(cancelClass({ ...admin, data: {} }), { code: 'invalid-argument' });
  assert.equal(db.deleted, null);
});

test('notifies booked and waitlisted members once, then deletes everything', async () => {
  const { cancelClass, db, log, sent, pruned } = setup({
    cls: trx,
    bookings: [
      { id: 'b1', classId: 'c1', userId: 'u1' },
      { id: 'b2', classId: 'c1', userId: 'u2' },
      { id: 'b3', classId: 'c1', userId: 'placeholder', isManualBooking: true },
    ],
    waitlist: [
      { id: 'w1', classId: 'c1', userId: 'u3' },
      { id: 'w2', classId: 'c1', userId: 'u1' }, // also booked: must get one notice, not two
    ],
    users: {
      u1: { displayName: 'Vale', fcmTokens: { t1: {}, dead: {} } },
      u2: { displayName: 'Ana' }, // push turned off
      u3: { displayName: 'Luis', fcmTokens: { t3: true } },
    },
  });
  const result = await cancelClass({ ...admin, data: { classId: 'c1', reason: '  Instructor enfermo  ' } });

  assert.equal(sent.length, 1);
  assert.deepEqual([...sent[0].tokens], ['t1', 'dead', 't3']);
  assert.match(sent[0].notification.body, /TRX del jueves 19 (de )?nov\.? a las 18:00 fue cancelada\. Motivo: Instructor enfermo\./);
  assert.deepEqual(pruned, ['dead']);
  assert.deepEqual(log, ['push', 'commit', 'notification']); // notify first, then delete, then log
  assert.deepEqual([...db.deleted], ['c1', 'b1', 'b2', 'b3', 'w1', 'w2']);
  assert.equal(db.notification.type, 'class_cancelled');
  assert.equal(db.notification.reason, 'Instructor enfermo');
  assert.equal(result.notifiedPeople, 2);
  assert.deepEqual([...result.unreachable], ['Ana']);
  assert.equal(result.manualBookings, 1);
  assert.equal(result.deletedBookings, 3);
  assert.equal(result.deletedWaitlist, 2);
  assert.equal(result.successCount, 2);
  assert.equal(result.failureCount, 1);
});

test('a push failure still cancels the class and is reported', async () => {
  const { cancelClass, db } = setup({
    cls: trx, pushFails: true,
    bookings: [{ id: 'b1', classId: 'c1', userId: 'u1' }],
    users: { u1: { fcmTokens: { t1: {} } } },
  });
  const result = await cancelClass({ ...admin, data: { classId: 'c1' } });
  assert.equal(result.pushError, true);
  assert.deepEqual([...db.deleted], ['c1', 'b1']);
  assert.doesNotMatch(db.notification.body, /Motivo/);
});

test('a missing class is reported and long reasons are cut to 140 characters', async () => {
  const missing = setup({ cls: undefined });
  await assert.rejects(missing.cancelClass({ ...admin, data: { classId: 'gone' } }), { code: 'not-found' });
  const { cancelClass, db } = setup({ cls: trx });
  await cancelClass({ ...admin, data: { classId: 'c1', reason: 'x'.repeat(300) } });
  assert.equal(db.notification.reason.length, 140);
});
