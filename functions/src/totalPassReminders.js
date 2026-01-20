// functions/src/totalPassReminders.js
// Cloud Functions to schedule and send TotalPass reminders.
// Moves TotalPass token reminders from the client to the backend queue.
// RELEVANT FILES: functions/src/bookingReminders.js, functions/index.js, index.html, service-worker.js
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const admin = require('firebase-admin');
const { getFunctions } = require('firebase-admin/functions');
const { pruneTokenInUsers } = require('../lib/pruneTokenInUsers');

const db = admin.firestore();

const TOTALPASS_FUNCTION_FQFN =
  'projects/madnessscheds/locations/us-central1/functions/sendTotalPassReminder';

const RANDOM_DELAY_MINUTES = { min: 5, max: 10 };
const DEFAULT_DURATION_MINUTES = 60;

function resolveStartDate(classSnap, booking) {
  const classStart = classSnap.get('startAt');
  if (classStart && typeof classStart.toDate === 'function') {
    return classStart.toDate();
  }

  const bookingStart = booking.startAt;
  if (bookingStart && typeof bookingStart.toDate === 'function') {
    return bookingStart.toDate();
  }

  if (bookingStart instanceof Date) {
    return bookingStart;
  }

  const classDate = booking.classDate;
  const time = booking.time || '00:00';
  if (classDate && typeof classDate === 'string') {
    const parsed = new Date(`${classDate}T${time}:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function resolveDurationMinutes(classSnap, booking) {
  const rawClassDuration = Number(classSnap.get('duration'));
  if (!Number.isNaN(rawClassDuration) && rawClassDuration > 0) {
    return rawClassDuration;
  }

  const rawBookingDuration = Number(booking.duration);
  if (!Number.isNaN(rawBookingDuration) && rawBookingDuration > 0) {
    return rawBookingDuration;
  }

  return DEFAULT_DURATION_MINUTES;
}

exports.onBookingCreateTotalPass = onDocumentCreated(
  { region: 'us-central1', document: 'bookings/{bookingId}' },
  async (event) => {
    console.log('=== onBookingCreateTotalPass triggered ===');
    const booking = event.data?.data();
    if (!booking) {
      console.log('No booking payload, exiting.');
      return;
    }

    const classId = booking.classId;
    const userId = booking.userId;
    if (!classId || !userId) {
      console.log('Missing classId or userId, exiting.');
      return;
    }

    const [classSnap, userSnap] = await Promise.all([
      db.collection('classes').doc(classId).get(),
      db.collection('users').doc(userId).get(),
    ]);

    if (!userSnap.exists || !userSnap.get('totalPass')) {
      console.log('User missing or not a TotalPass member, skipping.');
      return;
    }

    const startDate = resolveStartDate(classSnap, booking);
    if (!startDate) {
      console.log('Unable to resolve class start time, skipping.');
      return;
    }

    const durationMinutes = resolveDurationMinutes(classSnap, booking);
    const endTimeMs = startDate.getTime() + durationMinutes * 60000;

    const randomMinutes =
      RANDOM_DELAY_MINUTES.min +
      Math.random() * (RANDOM_DELAY_MINUTES.max - RANDOM_DELAY_MINUTES.min);
    const scheduleTime = new Date(endTimeMs + randomMinutes * 60000);
    const now = new Date();

    if (scheduleTime <= now) {
      console.log('Schedule time already passed, skipping.');
      return;
    }

    try {
      const functionsAdmin = getFunctions();
      const queue = functionsAdmin.taskQueue(TOTALPASS_FUNCTION_FQFN);
      const task = await queue.enqueue(
        {
          classId,
          userId,
          delayMinutes: Number(randomMinutes.toFixed(2)),
        },
        { scheduleTime }
      );
      const taskName =
        task && typeof task.name === 'string' ? task.name.trim() : '';
      if (taskName) {
        const latestBookingSnap = await event.data.ref.get();
        if (latestBookingSnap.exists) {
          await event.data.ref.set(
            { totalPassTaskNames: [taskName] },
            { merge: true }
          );
        } else {
          console.log(
            'Booking removed before storing TotalPass task name, skipping persist.'
          );
        }
      }
      console.log('TotalPass reminder queued:', {
        classId,
        userId,
        scheduleTime,
        delayMinutes: randomMinutes,
      });
    } catch (error) {
      console.error('Failed to enqueue TotalPass reminder:', error);
      throw error;
    }
  }
);

exports.sendTotalPassReminder = onTaskDispatched(
  { region: 'us-central1', rateLimits: { maxConcurrentDispatches: 5 } },
  async (request) => {
    const { classId, userId, delayMinutes } = request.data || {};
    if (!classId || !userId) return;

    // Skip if the booking was cancelled/deleted before the reminder fires.
    const bookingId = `${classId}_${userId}`;
    const bookingSnap = await db.collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists) {
      console.log('sendTotalPassReminder: booking missing, skipping.', { classId, userId });
      return;
    }

    const [classSnap, userSnap] = await Promise.all([
      db.collection('classes').doc(classId).get(),
      db.collection('users').doc(userId).get(),
    ]);

    const classData = classSnap.data() || {};
    const userData = userSnap.data() || {};
    const tokens = Object.keys(userData.fcmTokens || {});
    if (tokens.length === 0) return;

    const className = classData.title || classData.name || '';
    const title = 'TotalPass';
    const body = 'Ve a la app para enviar tu token';

    const tokenChunks = [];
    for (let i = 0; i < tokens.length; i += 500) {
      tokenChunks.push(tokens.slice(i, i + 500));
    }

    const responseAggregate = { responses: [], successCount: 0, failureCount: 0 };
    for (const chunk of tokenChunks) {
      const chunkResponse = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: {
          title,
          body,
          classId,
          className: className || '',
          type: 'totalpass',
          url: '/',
        },
      });
      responseAggregate.responses.push(...chunkResponse.responses);
      responseAggregate.successCount += chunkResponse.successCount;
      responseAggregate.failureCount += chunkResponse.failureCount;
    }

    const prunePromises = [];
    const failedTokens = [];
    responseAggregate.responses.forEach((res, idx) => {
      if (!res.success) {
        const token = tokens[idx];
        const code = res.error?.errorInfo?.code || res.error?.code || '';
        const invalid =
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered';
        if (invalid) {
          prunePromises.push(pruneTokenInUsers(token));
        } else {
          console.error('TotalPass notification failure', token, classId, code);
        }
        failedTokens.push({ token, errorCode: code || 'unknown' });
      }
    });

    await Promise.all(prunePromises);
    console.log('TotalPass reminder send summary', {
      classId,
      userId,
      successCount: responseAggregate.successCount,
      failureCount: responseAggregate.failureCount,
    });
    const parsedDelay = Number(delayMinutes);
    const notificationRecord = {
      classId,
      userId,
      type: 'totalpass',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tokensUsed: [...tokens],
      successCount: responseAggregate.successCount,
      failureCount: responseAggregate.failureCount,
      failedTokens,
    };
    if (className) {
      notificationRecord.className = className;
    }
    if (Number.isFinite(parsedDelay)) {
      notificationRecord.delayMinutes = parsedDelay;
    }
    await db.collection('notifications').add(notificationRecord);
  }
);
