// functions/index.js
// Entry point for Firebase Cloud Functions.
// Exposes callable APIs and triggered functions.
// RELEVANT FILES: functions/src/bookingReminders.js, functions/src/waitlistNotifications.js
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();

const { pruneTokenInUsers } = require("./lib/pruneTokenInUsers");

/**
 * Admin-only: send a direct push notification to a provided FCM token.
 * Auto-prunes token if FCM responds with "not registered" or "invalid".
 */
exports.sendDirectNotification = onCall({ region: "us-central1" }, async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");
  if (auth.token?.admin !== true) throw new HttpsError("permission-denied", "Admins only.");

  const { token, title, body } = request.data || {};
  if (!token || !title || !body) {
    throw new HttpsError("invalid-argument", "Missing token/title/body.");
  }

  try {
    const messageId = await admin.messaging().send({
      token,
      notification: { title, body },
    });
    return { success: true, messageId };
  } catch (err) {
    console.error("FCM send failed:", err);

    // Known FCM errors for dead/invalid tokens
    const code = err?.errorInfo?.code || err?.code || "";
    const isInvalid =
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered";

    if (isInvalid) {
      const prune = await pruneTokenInUsers(token);
      throw new HttpsError(
        "failed-precondition",
        `FCM token is invalid/not registered; pruned=${prune.prunedDocs || 0}.`,
        { pruned: true, prunedDocs: prune.prunedDocs || 0 }
      );
    }

    // Other errors → bubble up
    throw new HttpsError("unknown", err?.message || "Failed to send.", err);
  }
});

/**
 * Admin-only: backfill/normalize user emails.
 * - Ensures `email` is trimmed
 * - Writes `emailLower` = email.toLowerCase()
 * Returns counts.
 */
exports.backfillEmailLower = onCall({ region: "us-central1" }, async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");
  if (auth.token?.admin !== true) throw new HttpsError("permission-denied", "Admins only.");

  const snap = await db.collection("users").get();
  let updated = 0;

  // Batch in chunks of ~400 to stay under write limits
  const CHUNK = 400;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += CHUNK) {
    const slice = docs.slice(i, i + CHUNK);
    const batch = db.batch();
    let writes = 0;

    slice.forEach((doc) => {
      const d = doc.data() || {};
      const email = (d.email || "").trim();
      if (!email) return;
      const emailLower = email.toLowerCase();

      // Only write if something actually changes
      if (d.email !== email || d.emailLower !== emailLower) {
        batch.set(doc.ref, { email, emailLower }, { merge: true });
        updated++;
        writes++;
      }
    });

    // Commit this chunk only if we scheduled writes
    if (writes > 0) {
      await batch.commit();
    }
  }

  return { ok: true, total: snap.size, updated };
});

const bookingReminders = require("./src/bookingReminders");
exports.onBookingCreate = bookingReminders.onBookingCreate;
exports.sendBookingReminder = bookingReminders.sendBookingReminder;

const totalPassReminders = require("./src/totalPassReminders");
exports.onBookingCreateTotalPass = totalPassReminders.onBookingCreateTotalPass;
exports.sendTotalPassReminder = totalPassReminders.sendTotalPassReminder;

const waitlistNotifications = require("./src/waitlistNotifications");
exports.onBookingDelete = waitlistNotifications.onBookingDelete;
exports.onWaitlistExpiration = waitlistNotifications.onWaitlistExpiration;
