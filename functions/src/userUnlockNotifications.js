// functions/src/userUnlockNotifications.js
// Observes user blacklist status updates and sends unlock alerts.
// Keeps members informed when they can book again.
// RELEVANT FILES: functions/index.js, admin.html, index.html

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { pruneMultipleTokensInUsers } = require('../lib/pruneTokenInUsers');
const { sendMulticast } = require('../lib/sendMulticast');

const db = admin.firestore();
const TITLE = 'Cuenta desbloqueada';
const BODY = '¡Han desbloqueado tu cuenta y puedes hacer reservas nuevamente!';

exports.onUserUnlockNotification = onDocumentUpdated(
  { region: 'us-central1', document: 'users/{userId}' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const wasBlacklisted = before.blacklisted === true;
    const isBlacklisted = after.blacklisted === true;
    if (!wasBlacklisted || isBlacklisted) return;

    const tokens = Object.keys(after.fcmTokens || {});
    if (tokens.length === 0) return;

    const { successCount, failureCount, responses } = await sendMulticast({
      tokens,
      notification: { title: TITLE, body: BODY },
      data: { type: 'account_unlocked' },
    });
    const invalidTokens = [];
    responses.forEach((response, idx) => {
      if (!response.success) {
        const token = tokens[idx];
        const code = response.error?.errorInfo?.code || response.error?.code || '';
        const invalid =
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered';
        if (invalid) invalidTokens.push(token);
        else console.error('Unlock notification failure', token, code);
      }
    });

    await Promise.all([
      pruneMultipleTokensInUsers(invalidTokens),
      db.collection('notifications').add({
        type: 'account_unlocked',
        userId: event.params?.userId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        tokensUsed: [...tokens],
        successCount,
        failureCount,
      }),
    ]);
  }
);
