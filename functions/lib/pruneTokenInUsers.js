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

module.exports = { pruneTokenInUsers };
