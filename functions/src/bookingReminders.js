const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const admin = require('firebase-admin');
const { getFunctions } = require('firebase-admin/functions');
const { pruneTokenInUsers } = require('../lib/pruneTokenInUsers');

const db = admin.firestore();
const REMINDER_INTERVALS = [60, 30, 15];

// ✅ keep export name EXACTLY as used below in the fqfn
const REMINDER_FUNCTION_FQFN =
  'projects/madnessscheds/locations/us-central1/functions/sendBookingReminder';

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
    if (!start) {
      console.log('Missing start field, exiting.');
      return;
    }

    const startDate = start.toDate();
    console.log('Start date:', startDate);

    // ✅ avoid name collisions and force the unambiguous overload below
    const functionsAdmin = getFunctions();

    try {
      // ❌ DO NOT pass /queues/ (that’s Cloud Tasks, not Functions)
      // ❌ Avoid the 2-arg overload if your admin SDK version routes to "extensions"
      // ✅ Use fully-qualified FUNCTION resource to force correct overload:
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
            // ✅ Admin SDK accepts JS Date for scheduleTime
            return queue.enqueue({ classId, userId, interval }, { scheduleTime });
          })
          .filter(Boolean)
      );

      console.log('Tasks created:', tasks.length);
    } catch (error) {
      console.error('Error creating tasks:', error);
      throw error;
    }
  }
);

// ⚠️ Export name MUST match the fqfn above ("sendBookingReminder")
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

    // ✅ small nicety: fall back to name if title is absent
    const title = classData.title || classData.name || 'Class Reminder';
    const body = `Your class starts in ${interval} minutes`;

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