const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { pruneTokenInUsers } = require('../lib/pruneTokenInUsers');
const pLimit = require('p-limit');

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
    const failures = [];

    for (const interval of REMINDER_INTERVALS) {
      const target = new Date(now.getTime() + interval * 60000);
      const lower = new Date(target.getTime() - TOLERANCE_MIN * 60000);
      const upper = new Date(target.getTime() + TOLERANCE_MIN * 60000);

      const classSnap = await db
        .collection('classes')
        .where('start', '>=', lower)
        .where('start', '<=', upper)
        .get();

      const limitClass = pLimit(5);
      await Promise.all(
        classSnap.docs.map((classDoc) =>
          limitClass(async () => {
            const classData = classDoc.data() || {};
            const classId = classDoc.id;

            const bookingsSnap = await db
              .collection('bookings')
              .where('classId', '==', classId)
              .get();

            const userRefs = bookingsSnap.docs
              .map((b) => b.get('userId'))
              .filter(Boolean)
              .map((uid) => db.collection('users').doc(uid));

            if (userRefs.length === 0) return;

            const userDocs = [];
            const GET_BATCH = 10;
            const userBatches = [];
            for (let i = 0; i < userRefs.length; i += GET_BATCH) {
              userBatches.push(db.getAll(...userRefs.slice(i, i + GET_BATCH)));
            }
            (await Promise.all(userBatches)).forEach((arr) =>
              userDocs.push(...arr)
            );

            const tokenEntries = [];
            userDocs.forEach((doc) => {
              const tokens = Object.keys(doc.get('fcmTokens') || {});
              tokens.forEach((token) =>
                tokenEntries.push({ token, userId: doc.id })
              );
            });

            if (tokenEntries.length === 0) return;

            const notifRefs = tokenEntries.map(({ token, userId }) =>
              db
                .collection('notifications')
                .doc(`${classId}_${userId}_${interval}_${token}`)
            );

            const notifDocs = [];
            const notifBatches = [];
            for (let i = 0; i < notifRefs.length; i += GET_BATCH) {
              notifBatches.push(db.getAll(...notifRefs.slice(i, i + GET_BATCH)));
            }
            (await Promise.all(notifBatches)).forEach((arr) =>
              notifDocs.push(...arr)
            );

            const tokensToSend = [];
            const refsToWrite = [];
            notifDocs.forEach((doc, idx) => {
              if (!doc.exists) {
                tokensToSend.push(tokenEntries[idx].token);
                refsToWrite.push({
                  ref: notifRefs[idx],
                  userId: tokenEntries[idx].userId,
                  token: tokenEntries[idx].token,
                });
              }
            });

            if (tokensToSend.length === 0) return;

            const sendLimit = pLimit(3);
            const FCM_BATCH = 500;
            const sendChunks = [];
            for (let i = 0; i < tokensToSend.length; i += FCM_BATCH) {
              sendChunks.push({
                tokens: tokensToSend.slice(i, i + FCM_BATCH),
                refs: refsToWrite.slice(i, i + FCM_BATCH),
              });
            }

            await Promise.all(
              sendChunks.map(({ tokens, refs }) =>
                sendLimit(async () => {
                  const res = await admin
                    .messaging()
                    .sendEachForMulticast({
                      tokens,
                      notification: {
                        title: classData.title || 'Class Reminder',
                        body: `Your class starts in ${interval} minutes`,
                      },
                      data: { classId },
                    });

                  const batch = db.batch();
                  let successWrites = 0;
                  const prunePromises = [];

                  res.responses.forEach((r, idx) => {
                    const { ref, userId, token } = refs[idx];
                    if (r.success) {
                      batch.set(ref, {
                        classId,
                        userId,
                        token,
                        interval,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                      });
                      successWrites++;
                    } else {
                      const code =
                        r.error?.errorInfo?.code || r.error?.code || '';
                      const invalid =
                        code === 'messaging/invalid-registration-token' ||
                        code === 'messaging/registration-token-not-registered';
                      if (invalid) {
                        prunePromises.push(
                          pruneTokenInUsers(token).then((prune) => {
                            console.warn(
                              `Pruned invalid token ${token}; prunedDocs=${
                                prune.prunedDocs || 0
                              }${prune.error ? `; error=${prune.error}` : ''}`
                            );
                          })
                        );
                      } else {
                        failures.push({ token, classId, error: code });
                      }
                    }
                  });

                  if (successWrites > 0) {
                    await batch.commit();
                  }
                  await Promise.all(prunePromises);
                })
              )
            );
          })
        )
      );
    }

    if (failures.length > 0) {
      console.error('Notification failures:', failures);
    }
    return null;
  }
);
