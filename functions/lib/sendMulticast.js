// functions/lib/sendMulticast.js
// Sends FCM multicast chunks concurrently and combines their responses in token order.
// Shares bounded push delivery across reminders and waitlist notifications.
// RELEVANT FILES: functions/lib/mapConcurrent.js, functions/src/bookingReminders.js, functions/src/waitlistNotifications.js
const admin = require('firebase-admin');
const { mapConcurrent } = require('./mapConcurrent');

async function sendMulticast({ tokens, ...message }) {
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));
  const results = await mapConcurrent(chunks, (chunk) =>
    admin.messaging().sendEachForMulticast({ ...message, tokens: chunk })
  );
  // Preserve input order even when chunks finish out of order, so pruning uses the right token.
  return results.reduce((aggregate, result) => {
    aggregate.responses.push(...result.responses);
    aggregate.successCount += result.successCount;
    aggregate.failureCount += result.failureCount;
    return aggregate;
  }, { responses: [], successCount: 0, failureCount: 0 });
}

module.exports = { sendMulticast };
