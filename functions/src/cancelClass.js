// functions/src/cancelClass.js
// Admin-only callable: pushes a "class cancelled" notice to booked members and the waitlist, then deletes the class.
// Before this, deleting a class from the admin removed everyone's spot silently.
// RELEVANT FILES: functions/index.js, functions/lib/sendMulticast.js, functions/lib/pruneTokenInUsers.js, scripts/admin/class-crud.js
const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const { sendMulticast } = require('../lib/sendMulticast');
const { pruneMultipleTokensInUsers } = require('../lib/pruneTokenInUsers');

const MAX_REASON_LENGTH = 140;
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

// "TRX del jueves 20 nov a las 18:00", always in Mexico City time.
function describeClass(cls) {
  const start = cls.startAt?.toDate ? cls.startAt.toDate() : new Date(`${cls.classDate}T${cls.time}:00Z`);
  const name = cls.name || 'tu clase';
  if (Number.isNaN(start.getTime())) return name;
  const tz = 'America/Mexico_City';
  const day = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' }).format(start);
  const time = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(start);
  return `${name} del ${day} a las ${time}`;
}

function buildMessage(cls, reason) {
  const why = reason ? ` Motivo: ${reason}.` : '';
  return {
    title: 'Clase cancelada',
    body: `La clase ${describeClass(cls)} fue cancelada.${why} Perdón por el inconveniente.`,
  };
}

async function cancelClass(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required.');
  if (request.auth.token?.admin !== true) throw new HttpsError('permission-denied', 'Admins only.');

  const classId = String(request.data?.classId || '');
  const reason = String(request.data?.reason || '').trim().slice(0, MAX_REASON_LENGTH);
  if (!classId) throw new HttpsError('invalid-argument', 'Missing classId.');

  const db = admin.firestore();
  const classRef = db.collection('classes').doc(classId);
  const [classSnap, bookingsSnap, waitSnap] = await Promise.all([
    classRef.get(),
    db.collection('bookings').where('classId', '==', classId).get(),
    db.collection('waitlists').where('classId', '==', classId).get(),
  ]);
  if (!classSnap.exists) throw new HttpsError('not-found', 'La clase ya no existe.');
  const cls = classSnap.data() || {};

  // WhatsApp bookings use placeholder accounts, so staff must message those people by hand.
  const manualBookings = bookingsSnap.docs.filter(doc => doc.get('isManualBooking')).length;
  // Booked members and waitlist members get the same notice; someone in both gets it once.
  const userIds = [...new Set(
    [...bookingsSnap.docs, ...waitSnap.docs]
      .filter(doc => !doc.get('isManualBooking'))
      .map(doc => doc.get('userId'))
      .filter(Boolean)
  )];

  const userSnaps = await Promise.all(userIds.map(uid => db.collection('users').doc(uid).get()));
  const tokens = [];
  const unreachable = []; // members with push turned off: staff should contact them another way
  userSnaps.forEach(snap => {
    const data = snap.data() || {};
    const userTokens = Object.keys(data.fcmTokens || {});
    if (userTokens.length) tokens.push(...userTokens);
    else unreachable.push(data.displayName || data.email || snap.id);
  });

  const { title, body } = buildMessage(cls, reason);
  let successCount = 0;
  let failureCount = 0;
  let pushError = false;
  // Notify first, then delete. A push failure must not block the cancellation itself.
  if (tokens.length) {
    try {
      const result = await sendMulticast({ tokens, notification: { title, body }, data: { type: 'class_cancelled', classId } });
      successCount = result.successCount;
      failureCount = result.failureCount;
      const invalid = result.responses
        .map((r, i) => (!r.success && INVALID_TOKEN_CODES.has(r.error?.errorInfo?.code || r.error?.code || '') ? tokens[i] : null))
        .filter(Boolean);
      if (invalid.length) await pruneMultipleTokensInUsers(invalid);
    } catch (err) {
      console.error('cancelClass: push failed', err);
      pushError = true;
    }
  }

  // One atomic batch, same as the old admin delete: class, bookings and waitlist go together,
  // so the booking-delete trigger finds no waitlist to promote into a class that is gone.
  const batch = db.batch();
  batch.delete(classRef);
  bookingsSnap.docs.forEach(doc => batch.delete(doc.ref));
  waitSnap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // Shows up in the admin's "Últimas 10 notificaciones".
  await db.collection('notifications').add({
    type: 'class_cancelled',
    classId,
    className: cls.name || '',
    title,
    body,
    reason,
    userIds,
    totalTokens: tokens.length,
    successCount,
    failureCount,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    notifiedPeople: userIds.length - unreachable.length,
    successCount,
    failureCount,
    pushError,
    unreachable,
    manualBookings,
    deletedBookings: bookingsSnap.size,
    deletedWaitlist: waitSnap.size,
  };
}

module.exports = { cancelClass, buildMessage };
