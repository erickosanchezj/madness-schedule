// functions/src/bookingReminders.js
// Schedules class reminder push notifications.
// Ensures reminders track booking lifecycle events.
// RELEVANT FILES: functions/index.js, functions/src/totalPassReminders.js
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const admin = require('firebase-admin');
const { getFunctions } = require('firebase-admin/functions');
const { pruneTokenInUsers } = require('../lib/pruneTokenInUsers');

const db = admin.firestore();
const REMINDER_INTERVALS = [60, 30, 15];
const MX_TIME_ZONE = 'America/Mexico_City';
const bookingDateFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: MX_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const bookingTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: MX_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const REMINDER_FUNCTION_FQFN =
  'projects/madnessscheds/locations/us-central1/functions/sendBookingReminder';

// Parses date/time strings as local wall time in the given zone to avoid UTC drift.
function parseDateTimeInTimeZone(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return null;

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(utcGuess)
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});

  const offset =
    Date.UTC(
      Number(tzParts.year),
      Number(tzParts.month) - 1,
      Number(tzParts.day),
      Number(tzParts.hour),
      Number(tzParts.minute),
      Number(tzParts.second || '0')
    ) - utcGuess.getTime();

  return new Date(utcGuess.getTime() - offset);
}

function resolveStartDate(booking = {}, classData = {}) {
  const candidates = [booking.startAt, classData.startAt];

  for (const candidate of candidates) {
    if (candidate?.toDate) {
      const asDate = candidate.toDate();
      if (!Number.isNaN(asDate.getTime())) return asDate;
    }

    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }

  const dateStr = booking.classDate || classData.classDate;
  const timeStr = booking.time || classData.time;

  if (dateStr && timeStr) {
    const parsed = parseDateTimeInTimeZone(dateStr, timeStr, MX_TIME_ZONE);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

async function sendAdminBookingNotification(booking, classData, bookingId) {
  if (!booking || !booking.userId || !booking.classId) return;

  const adminSnap = await db.collection('users').where('admin', '==', true).get();

  const tokens = [];
  adminSnap.forEach((doc) => {
    const tokenMap = doc.get('fcmTokens') || {};
    Object.keys(tokenMap).forEach((token) => tokens.push(token));
  });

  if (tokens.length === 0) {
    console.log('sendAdminBookingNotification: no admin tokens found.');
    return;
  }

  const className =
    classData?.name || classData?.title || booking.className || 'Clase';
  const startDate = resolveStartDate(booking, classData);
  const classDate = startDate
    ? bookingDateFormatter.format(startDate)
    : booking.classDate || classData?.classDate || '';
  const time = startDate
    ? bookingTimeFormatter.format(startDate)
    : booking.time || classData?.time || '';
  const userName = booking.userName || 'Miembro';

  const title = 'Nueva reserva';
  const details = [className, classDate, time].filter(Boolean).join(' · ');
  const body = `${userName} reservó ${details || 'una clase'}`;

  const tokenChunks = [];
  for (let i = 0; i < tokens.length; i += 500) tokenChunks.push(tokens.slice(i, i + 500));

  const res = { responses: [], successCount: 0, failureCount: 0 };
  for (const chunk of tokenChunks) {
    const chunkRes = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      data: { type: 'admin_booking', classId: booking.classId },
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
        console.error('Admin booking notification failure', token, booking.classId, code);
      }
      failedTokens.push({ token, errorCode: code || 'unknown' });
    }
  });
  await Promise.all(prunePromises);

  const notificationRecord = {
    classId: booking.classId,
    userId: booking.userId,
    bookingId,
    type: 'admin_booking',
    className,
    classDate,
    time,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    tokensUsed: [...tokens],
    successCount: res.successCount,
    failureCount: res.failureCount,
    failedTokens,
  };

  await db.collection('notifications').add(notificationRecord);
}

exports.onBookingCreate = onDocumentCreated(
  { region: 'us-central1', document: 'bookings/{bookingId}' },
  async (event) => {
    console.log('=== onBookingCreate triggered ===');
    console.log('Event data:', event.data?.data());

    const booking = event.data?.data();
    console.log('Booking:', booking);
    if (!booking) {
      console.log('No booking data found, exiting.');
      return;
    }

    const classId = booking.classId;
    const userId = booking.userId;
    console.log('ClassId:', classId, 'UserId:', userId);
    if (!classId || !userId) {
      console.log('Missing classId or userId, exiting.');
      return;
    }

    const classSnap = await db.collection('classes').doc(classId).get();
    console.log('Class document exists:', classSnap.exists);
    console.log('Class data:', classSnap.data());

    const start = classSnap.get('startAt');
    console.log('Start field:', start);

    if (start) {
      const startDate = start.toDate();
      console.log('Start date:', startDate);

      const existingBookingSnap = await event.data.ref.get();
      if (!existingBookingSnap.exists) {
        console.log('Booking document already removed before scheduling reminders.');
        return;
      }

      const functionsAdmin = getFunctions();

      try {
        console.log('taskQueue target:', REMINDER_FUNCTION_FQFN);
        const queue = functionsAdmin.taskQueue(REMINDER_FUNCTION_FQFN);

        console.log('Queue created successfully');
        const now = new Date();
        console.log('Current time:', now);

        REMINDER_INTERVALS.forEach((interval) => {
          const scheduleTime = new Date(startDate.getTime() - interval * 60000);
          console.log(
            `Interval ${interval}min: scheduleTime=${scheduleTime}, willSchedule=${scheduleTime > now}`
          );
        });

        const tasks = await Promise.all(
          REMINDER_INTERVALS
            .map((interval) => {
              const scheduleTime = new Date(startDate.getTime() - interval * 60000);
              if (scheduleTime <= now) return null;
              return queue.enqueue({ classId, userId, interval }, { scheduleTime });
            })
            .filter(Boolean)
        );

        const reminderTaskNames = tasks
          .map((task) => (task && typeof task.name === 'string' ? task.name : null))
          .filter(Boolean);

        const latestBookingSnap = await event.data.ref.get();
        if (!latestBookingSnap.exists) {
          console.log('Booking document was removed before reminders were stored. Skipping write.');
          return;
        }

        await event.data.ref.set({ reminderTaskNames }, { merge: true });

        console.log('Tasks created:', tasks.length);
      } catch (error) {
        console.error('Error creating tasks:', error);
        throw error;
      }
    } else {
      console.log('Missing start field, skipping reminder scheduling but continuing notification flow.');
    }

    try {
      await sendAdminBookingNotification(booking, classSnap.data(), event.params?.bookingId);
    } catch (err) {
      console.error('Failed to send admin booking notification', err);
    }
  }
);

exports.sendBookingReminder = onTaskDispatched(
  { region: 'us-central1', rateLimits: { maxConcurrentDispatches: 5 } },
  async (request) => {
    const { classId, userId, interval } = request.data || {};
    if (!classId || !userId) return;

    const [classSnap, userSnap] = await Promise.all([
      db.collection('classes').doc(classId).get(),
      db.collection('users').doc(userId).get(),
    ]);

    const classData = classSnap.data() || {};
    const tokens = Object.keys(userSnap.get('fcmTokens') || {});
    if (tokens.length === 0) return;

    const title = classData.title || classData.name || 'Recordatorio de clase';
    const body = `Tu clase empieza en ${interval} minutos`;

    const tokenChunks = [];
    for (let i = 0; i < tokens.length; i += 500) tokenChunks.push(tokens.slice(i, i + 500));

    const res = { responses: [], successCount: 0, failureCount: 0 };
    for (const chunk of tokenChunks) {
      const chunkRes = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: { title, body, classId },
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
      interval,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tokensUsed: [...tokens],
      successCount: res.successCount,
      failureCount: res.failureCount,
      failedTokens,
    };

    await db.collection('notifications').add(notificationRecord);
  }
);
