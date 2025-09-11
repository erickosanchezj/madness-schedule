const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const admin = require('firebase-admin');
const { getFunctions } = require('firebase-admin/functions');
const { pruneTokenInUsers } = require('../lib/pruneTokenInUsers');

const db = admin.firestore();
const REMINDER_INTERVALS = [60, 30, 15];

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
    const start = classSnap.get('start');
    console.log('Start field:', start);
    if (!start) {
      console.log('Missing start field, exiting.');
      return;
    }
    const startDate = start.toDate();
    console.log('Start date:', startDate);

    const functions = getFunctions();
    try {
      const queue = functions.taskQueue('sendBookingReminder', 'us-central1');
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
        REMINDER_INTERVALS.map((interval) => {
          const scheduleTime = new Date(startDate.getTime() - interval * 60000);
          if (scheduleTime <= now) return null;
          return queue.enqueue({ classId, userId, interval }, { scheduleTime });
        }).filter(Boolean)
      );
      console.log('Tasks created:', tasks.filter(Boolean).length);
    } catch (error) {
      console.error('Error creating tasks:', error);
      throw error;
    }
  }
);

exports.sendBookingReminder = onTaskDispatched(
  { region: 'us-central1', rateLimits: { maxConcurrentDispatches: 5 } },
  async (request) => {
    const { classId, userId, interval } = request.data;
    if (!classId || !userId) return;

    const [classSnap, userSnap] = await Promise.all([
      db.collection('classes').doc(classId).get(),
      db.collection('users').doc(userId).get(),
    ]);

    const classData = classSnap.data() || {};
    const tokens = Object.keys(userSnap.get('fcmTokens') || {});
    if (tokens.length === 0) return;

    const title = classData.title || 'Class Reminder';
    const body = `Your class starts in ${interval} minutes`;

    const tokenChunks = [];
    for (let i = 0; i < tokens.length; i += 500) {
      tokenChunks.push(tokens.slice(i, i + 500));
    }

    const res = { responses: [], successCount: 0, failureCount: 0 };
    for (const chunk of tokenChunks) {
      const chunkRes = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        // Include a notification payload so FCM can display it on devices
        notification: { title, body },
        // Also send data so the service worker can handle tagging/renotify
        data: { title, body, classId },
      });
      res.responses.push(...chunkRes.responses);
      res.successCount += chunkRes.successCount;
      res.failureCount += chunkRes.failureCount;
    }

    const prunePromises = [];
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
      }
    });
    await Promise.all(prunePromises);
    await db.collection('notifications').add({
      classId,
      userId,
      interval,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
