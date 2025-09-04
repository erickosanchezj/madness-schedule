const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { pruneTokenInUsers } = require('../lib/pruneTokenInUsers');

const db = admin.firestore();

// Minutes before class to send reminders
const REMINDER_INTERVALS = [60, 30, 15];
const TOLERANCE_MIN = 5;

/**
 * Scheduled reminders for upcoming classes.
 * This function runs every 15 minutes at specified hours on weekdays and Saturday.
 */
exports.reminders = onSchedule(
  { region: 'us-central1', schedule: '*/15 7,9,17,18,19,20 * * 1-6' },
  async (event) => {
    const now = admin.firestore.Timestamp.now().toDate();

    for (const interval of REMINDER_INTERVALS) {
      const target = new Date(now.getTime() + interval * 60000);
      const lower = new Date(target.getTime() - TOLERANCE_MIN * 60000);
      const upper = new Date(target.getTime() + TOLERANCE_MIN * 60000);

      const classSnap = await db
        .collection('classes')
        .where('start', '>=', lower)
        .where('start', '<=', upper)
        .get();

      for (const classDoc of classSnap.docs) {
        const classData = classDoc.data() || {};
        const classId = classDoc.id;

        const bookingsSnap = await db
          .collection('bookings')
          .where('classId', '==', classId)
          .get();

        for (const booking of bookingsSnap.docs) {
          const userId = booking.get('userId');
          const userSnap = await db.collection('users').doc(userId).get();
          const tokens = Object.keys(userSnap.get('fcmTokens') || {});

          for (const token of tokens) {
            const notifId = `${classId}_${userId}_${interval}_${token}`;
            const notifRef = db.collection('notifications').doc(notifId);
            const notifDoc = await notifRef.get();
            if (notifDoc.exists) continue; // already sent

            try {
              await admin.messaging().send({
                token,
                notification: {
                  title: classData.title || 'Class Reminder',
                  body: `Your class starts in ${interval} minutes`,
                },
                data: { classId },
              });

              await notifRef.set({
                classId,
                userId,
                token,
                interval,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            } catch (err) {
              const code = err?.errorInfo?.code || err?.code || '';
              const invalid =
                code === 'messaging/invalid-registration-token' ||
                code === 'messaging/registration-token-not-registered';

              if (invalid) {
                const prune = await pruneTokenInUsers(token);
                console.warn(
                  `Pruned invalid token ${token}; prunedDocs=${prune.prunedDocs || 0}` +
                    (prune.error ? `; error=${prune.error}` : '')
                );
              } else {
                console.error('Failed to send to token', token, err);
              }
            }
          }
        }
      }
    }
    return null;
  }
);
