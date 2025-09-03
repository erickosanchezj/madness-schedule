const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Minutes before class to send reminders
const REMINDER_INTERVALS = [60, 30, 15];
const TOLERANCE_MIN = 5;

/**
 * Prunes a bad FCM token from any user document.
 * @param {string} token The FCM token to remove.
 */
async function pruneTokenInUsers(token) {
  try {
    const fieldPath = `fcmTokens.${token}`;
    const snap = await db
      .collection('users')
      .where(fieldPath, '==', true)
      .get();
    if (snap.empty) return;

    const batch = db.batch();
    snap.forEach((doc) => {
      batch.set(
        doc.ref,
        { [fieldPath]: admin.firestore.FieldValue.delete() },
        { merge: true }
      );
    });
    await batch.commit();
  } catch (e) {
    console.error('Failed pruning token in users:', e);
  }
}

/**
 * Scheduled reminders for upcoming classes.
 * This function runs every 15 minutes at specified hours on weekdays and Saturday.
 * Cron schedule: '*/15 7,9,17,18,19,20 * * 1,2,3,4,5,6'
 */
exports.reminders = functions
  .pubsub.schedule('*/15 7,9,17,18,19,20 * * 1,2,3,4,5,6')
  .onRun(async () => {
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
                await pruneTokenInUsers(token);
              } else {
                console.error('Failed to send to token', token, err);
              }
            }
          }
        }
      }
    }
    return null;
  });