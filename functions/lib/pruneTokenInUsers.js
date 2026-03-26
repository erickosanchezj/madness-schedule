// functions/lib/pruneTokenInUsers.js
// Shared helpers to remove invalid FCM tokens from user documents.
// Keeps notification flows efficient by pruning stale device tokens.
// RELEVANT FILES: functions/src/bookingReminders.js, functions/src/waitlistNotifications.js, functions/src/totalPassReminders.js, functions/src/userUnlockNotifications.js
const admin = require('firebase-admin');

/**
 * Remove a bad FCM token from any user doc that has it as
 *   users/{uid}.fcmTokens.<token> == true
 *
 * @param {string} token The FCM token to remove.
 * @returns {Promise<{prunedDocs: number, error?: string}>}
 */
async function pruneTokenInUsers(token) {
  const db = admin.firestore();
  try {
    const fieldPath = `fcmTokens.${token}`;
    const snap = await db.collection('users').where(fieldPath, '==', true).get();
    if (snap.empty) return { prunedDocs: 0 };

    const batch = db.batch();
    snap.forEach((doc) => {
      batch.set(
        doc.ref,
        { [fieldPath]: admin.firestore.FieldValue.delete() },
        { merge: true }
      );
    });
    await batch.commit();
    return { prunedDocs: snap.size };
  } catch (e) {
    console.error('Failed pruning token in users:', e);
    return { prunedDocs: 0, error: e?.message };
  }
}

/**
 * Remove many bad FCM tokens by reading users once and pruning matches in one batch write.
 *
 * @param {string[]} tokens Invalid FCM tokens to remove.
 * @returns {Promise<{prunedDocs: number, error?: string}>}
 */
async function pruneMultipleTokensInUsers(tokens = []) {
  const db = admin.firestore();
  try {
    const uniqueTokens = [...new Set((tokens || []).filter(Boolean))];
    if (!uniqueTokens.length) return { prunedDocs: 0 };

    const snap = await db.collection('users').get();
    if (snap.empty) return { prunedDocs: 0 };

    const batch = db.batch();
    let prunedDocs = 0;

    snap.forEach((doc) => {
      const tokenMap = doc.get('fcmTokens') || {};
      const updates = {};
      let hasChanges = false;

      uniqueTokens.forEach((token) => {
        if (tokenMap[token]) {
          updates[`fcmTokens.${token}`] = admin.firestore.FieldValue.delete();
          hasChanges = true;
        }
      });

      if (hasChanges) {
        batch.set(doc.ref, updates, { merge: true });
        prunedDocs += 1;
      }
    });

    if (!prunedDocs) return { prunedDocs: 0 };

    await batch.commit();
    return { prunedDocs };
  } catch (e) {
    console.error('Failed pruning tokens in users:', e);
    return { prunedDocs: 0, error: e?.message };
  }
}

module.exports = { pruneTokenInUsers, pruneMultipleTokensInUsers };
