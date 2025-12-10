// functions/src/waitlistNotifications.js
// Handles waitlist push notifications when spots open.
// Alerts users and manages expiration queue.
// RELEVANT FILES: functions/index.js, index.html, firestore.rules

const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const admin = require('firebase-admin');
const { getFunctions } = require('firebase-admin/functions');
const { pruneTokenInUsers } = require('../lib/pruneTokenInUsers');

const db = admin.firestore();
const WAITLIST_EXPIRATION_FQFN =
  'projects/madnessscheds/locations/us-central1/functions/onWaitlistExpiration';
const NOTIFICATION_WINDOW_MS = 5 * 60 * 1000;

async function clearClassHoldIfMatches(classId, waitlistId) {
  if (!classId || !waitlistId) return false;
  const classRef = db.collection('classes').doc(classId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) return false;
  const holdId = classSnap.get('waitlistHoldWaitlistId');
  if (holdId !== waitlistId) return false;
  await classRef.set(
    {
      waitlistHoldUserId: admin.firestore.FieldValue.delete(),
      waitlistHoldWaitlistId: admin.firestore.FieldValue.delete(),
      waitlistHoldExpiresAt: admin.firestore.FieldValue.delete(),
    },
    { merge: true }
  );
  return true;
}

async function processWaitlistNotification(entry) {
  const { id, classId, userId } = entry || {};
  if (!id || !classId || !userId) return;

  const [userSnap, classSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('classes').doc(classId).get(),
  ]);

  const tokens = Object.keys(userSnap.get('fcmTokens') || {});
  if (tokens.length === 0) return;

  const className = classSnap.get('name') || classSnap.get('title') || 'Clase';
  const expirationTime = Date.now() + NOTIFICATION_WINDOW_MS;
  const expiresAt = admin.firestore.Timestamp.fromMillis(expirationTime);

  const title = 'Cupo disponible';
  const body = `Hay un cupo disponible en ${className}`;

  const tokenChunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    tokenChunks.push(tokens.slice(i, i + 500));
  }

  const res = { responses: [], successCount: 0, failureCount: 0 };
  for (const chunk of tokenChunks) {
    const chunkRes = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      data: { type: 'waitlist_opportunity', classId, waitlistId: id },
    });
    res.responses.push(...chunkRes.responses);
    res.successCount += chunkRes.successCount;
    res.failureCount += chunkRes.failureCount;
  }

  const prunePromises = [];
  const failedTokens = [];
  res.responses.forEach((r, idx) => {
    if (!r.success) {
      const token = tokens[idx];
      const code = r.error?.errorInfo?.code || r.error?.code || '';
      const invalid =
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered';
      if (invalid) {
        prunePromises.push(pruneTokenInUsers(token));
      } else {
        console.error('Notification failure', token, classId, code);
      }
      failedTokens.push({ token, errorCode: code || 'unknown' });
    }
  });
  await Promise.all(prunePromises);

  const notificationRecord = {
    classId,
    userId,
    type: 'waitlist',
    waitlistId: id,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    tokensUsed: [...tokens],
    successCount: res.successCount,
    failureCount: res.failureCount,
    failedTokens,
  };

  await db.collection('notifications').add(notificationRecord);

  await Promise.all([
    db.collection('waitlists').doc(id).set(
      {
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
      },
      { merge: true }
    ),
    db.collection('classes').doc(classId).set(
      {
        waitlistHoldUserId: userId,
        waitlistHoldWaitlistId: id,
        waitlistHoldExpiresAt: expiresAt,
      },
      { merge: true }
    ),
  ]);

  const queue = getFunctions().taskQueue(WAITLIST_EXPIRATION_FQFN);
  await queue.enqueue(
    { classId, waitlistId: id },
    { scheduleTime: new Date(expirationTime) }
  );
}

exports.processWaitlistNotification = processWaitlistNotification;

exports.onBookingDelete = onDocumentDeleted(
  { region: 'us-central1', document: 'bookings/{bookingId}' },
  async (event) => {
    const booking = event.data?.data();
    const classId = booking?.classId;
    if (!classId) return;

    const snap = await db
      .collection('waitlists')
      .where('classId', '==', classId)
      .orderBy('position')
      .limit(10)
      .get();

    const now = Date.now();
    let entry = null;
    snap.forEach((doc) => {
      if (entry) return;
      const expires = doc.get('expiresAt');
      if (
        !doc.get('notifiedAt') ||
        (expires?.toDate && expires.toDate().getTime() <= now)
      ) {
        entry = { id: doc.id, ...doc.data() };
      }
    });

    if (entry) await processWaitlistNotification(entry);
  }
);

exports.onWaitlistExpiration = onTaskDispatched(
  { region: 'us-central1', rateLimits: { maxConcurrentDispatches: 5 } },
  async (request) => {
    const { classId, waitlistId } = request.data || {};
    if (!classId || !waitlistId) return;

    const ref = db.collection('waitlists').doc(waitlistId);
    const snap = await ref.get();
    if (!snap.exists) {
      await clearClassHoldIfMatches(classId, waitlistId);
      const nextSnap = await db
        .collection('waitlists')
        .where('classId', '==', classId)
        .orderBy('position')
        .limit(1)
        .get();
      if (!nextSnap.empty) {
        await processWaitlistNotification({
          id: nextSnap.docs[0].id,
          ...nextSnap.docs[0].data(),
        });
      }
      return;
    }

    const expires = snap.get('expiresAt');
    if (expires?.toDate && expires.toDate().getTime() > Date.now()) return;

    const position = snap.get('position') || 1;
    await clearClassHoldIfMatches(classId, waitlistId);
    await ref.delete();

    const q = await db
      .collection('waitlists')
      .where('classId', '==', classId)
      .where('position', '>', position)
      .get();
    const batch = db.batch();
    q.forEach((doc) =>
      batch.update(doc.ref, { position: (doc.get('position') || 1) - 1 })
    );
    await batch.commit();

    const nextSnap = await db
      .collection('waitlists')
      .where('classId', '==', classId)
      .orderBy('position')
      .limit(1)
      .get();
    if (!nextSnap.empty) {
      await processWaitlistNotification({
        id: nextSnap.docs[0].id,
        ...nextSnap.docs[0].data(),
      });
    }
  }
);
