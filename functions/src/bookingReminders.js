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
    const booking = event.data?.data();
    if (!booking) return;
    const classId = booking.classId;
    const userId = booking.userId;
    if (!classId || !userId) return;

    const classSnap = await db.collection('classes').doc(classId).get();
    const start = classSnap.get('start');
    if (!start) return;
    const startDate = start.toDate();

    const functions = getFunctions();
    const queue = functions.taskQueue('sendBookingReminder', 'us-central1');
    const now = new Date();

    await Promise.all(
      REMINDER_INTERVALS.map((interval) => {
        const scheduleTime = new Date(startDate.getTime() - interval * 60000);
        if (scheduleTime <= now) return null;
        return queue.enqueue({ classId, userId, interval }, { scheduleTime });
      }).filter(Boolean)
    );
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

    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: classData.title || 'Class Reminder',
        body: `Your class starts in ${interval} minutes`,
      },
      data: { classId },
    });

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
  }
);
