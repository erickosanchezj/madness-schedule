// functions/lib/pruneTokenInUsers.js
// Shared helpers to remove invalid FCM tokens from user documents.
// Keeps notification flows efficient by pruning stale device tokens.
// RELEVANT FILES: functions/src/bookingReminders.js, functions/src/waitlistNotifications.js, functions/src/totalPassReminders.js, functions/src/userUnlockNotifications.js
const admin = require('firebase-admin');

/**
 * Remove one bad FCM token from every user doc that has it.
 * Delegates to the multi-token helper so both stored shapes work:
 * the old `fcmTokens.<token> = true` and the current metadata object.
 *
 * @param {string} token The FCM token to remove.
 * @returns {Promise<{prunedDocs: number, error?: string}>}
 */
async function pruneTokenInUsers(token) {
  return pruneMultipleTokensInUsers([token]);
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

    let batch = db.batch();
    let pendingWrites = 0;
    let prunedDocs = 0;
    const MAX_BATCH_WRITES = 500;

    for (const doc of snap.docs) {
      const tokenMap = doc.get('fcmTokens') || {};
      // Nested object on purpose: with set(..., { merge: true }) a dotted key like
      // "fcmTokens.<token>" is a literal top-level field name, so it would delete nothing.
      const updates = { fcmTokens: {} };
      let hasChanges = false;

      uniqueTokens.forEach((token) => {
        if (tokenMap[token]) {
          updates.fcmTokens[token] = admin.firestore.FieldValue.delete();
          hasChanges = true;
        }
      });

      if (hasChanges) {
        batch.set(doc.ref, updates, { merge: true });
        pendingWrites += 1;
        prunedDocs += 1;

        if (pendingWrites === MAX_BATCH_WRITES) {
          // Firestore write batches have a hard limit of 500 operations.
          // Commit and start a new batch to avoid all-or-nothing failures.
          // eslint-disable-next-line no-await-in-loop
          await batch.commit();
          batch = db.batch();
          pendingWrites = 0;
        }
      }
    }

    if (!prunedDocs) return { prunedDocs: 0 };

    if (pendingWrites > 0) {
      await batch.commit();
    }

    return { prunedDocs };
  } catch (e) {
    console.error('Failed pruning tokens in users:', e);
    return { prunedDocs: 0, error: e?.message };
  }
}

module.exports = { pruneTokenInUsers, pruneMultipleTokensInUsers };
