// functions/index.js
// Entry point for Firebase Cloud Functions.
// Exposes callable APIs and triggered functions.
// RELEVANT FILES: functions/src/bookingReminders.js, functions/src/waitlistNotifications.js
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();

const { pruneTokenInUsers } = require("./lib/pruneTokenInUsers");

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Member cancellation handled on the server to prevent clock tampering.
 * Calculates lateness using the Firebase server clock and applies strikes.
 */
exports.cancelBooking = onCall({ region: "us-central1" }, async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");

  const classIdRaw = typeof request.data?.classId === "string" ? request.data.classId.trim() : "";
  if (!classIdRaw) {
    throw new HttpsError("invalid-argument", "classId is required.");
  }

  const classId = classIdRaw;
  const uid = auth.uid;

  const classRef = db.collection("classes").doc(classId);
  const bookingRef = db.collection("bookings").doc(`${classId}_${uid}`);
  const userRef = db.collection("users").doc(uid);

  const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (value instanceof admin.firestore.Timestamp) return value.toDate();
    if (typeof value.toDate === "function") {
      try {
        const converted = value.toDate();
        if (converted instanceof Date && !Number.isNaN(converted.getTime())) return converted;
      } catch (err) {
        console.warn("cancelBooking: toDate conversion failed", err);
      }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const resolveStartDate = (bookingData = {}, classData = {}) => {
    const bookingStart = toDate(bookingData.startAt);
    if (bookingStart) return bookingStart;

    const classStart = toDate(classData.startAt);
    if (classStart) return classStart;

    const dateStr = bookingData.classDate || classData.classDate;
    const timeStr = bookingData.time || classData.time;
    if (dateStr && timeStr) {
      const parsed = toDate(`${dateStr}T${timeStr}:00Z`);
      if (parsed) return parsed;
    }

    return null;
  };

  let becameBlacklisted = false;
  let recordedLateStrike = false;
  let resultingLateCount = 0;

  await db.runTransaction(async (tx) => {
    const [bookingSnap, classSnap, userSnap] = await Promise.all([
      tx.get(bookingRef),
      tx.get(classRef),
      tx.get(userRef),
    ]);

    if (!bookingSnap.exists) {
      throw new HttpsError("failed-precondition", "No tienes reserva para esta clase.");
    }

    const bookingData = bookingSnap.data() || {};
    const classData = classSnap.exists ? classSnap.data() || {} : {};
    const startDate = resolveStartDate(bookingData, classData);
    const serverNow = admin.firestore.Timestamp.now().toDate();
    const lateCancellation = startDate instanceof Date
      ? startDate.getTime() - serverNow.getTime() <= TWO_HOURS_MS
      : true;

    if (classSnap.exists) {
      const enrolled = Number(classData.enrolledCount || 0);
      if (enrolled > 0) {
        tx.update(classRef, {
          enrolledCount: admin.firestore.FieldValue.increment(-1),
        });
      }
    }

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const baseLate = Number(userData.lateCancellations || 0);
    const userUpdates = {
      lastCancelAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (lateCancellation) {
      recordedLateStrike = true;
      const nextLate = Math.min(baseLate + 1, 3);
      resultingLateCount = nextLate;
      userUpdates.lateCancellations = nextLate;

      if (nextLate >= 3 && userData.blacklisted !== true) {
        userUpdates.blacklisted = true;
        userUpdates.blacklistedAt = admin.firestore.FieldValue.serverTimestamp();
        becameBlacklisted = true;
      }
    } else {
      resultingLateCount = baseLate;
    }

    tx.delete(bookingRef);
    tx.set(userRef, userUpdates, { merge: true });
  });

  return {
    success: true,
    becameBlacklisted,
    recordedLateStrike,
    resultingLateCount,
  };
});

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

const generateDailyClasses = require("./src/generateDailyClasses");
exports.generateDailyClasses = generateDailyClasses.generateDailyClasses;

exports.automaticWhitelisting = onSchedule(
  {
    region: "us-central1",
    schedule: "0 0 1 * *",
    timeZone: "America/Mexico_City",
  },
  async () => {
    const snap = await db.collection("users").where("blacklisted", "==", true).get();
    if (snap.empty) {
      console.log("automaticWhitelisting: no blacklisted users found.");
      return;
    }

    const CHUNK = 400;
    const docs = snap.docs;
    let processed = 0;

    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK);
      if (slice.length === 0) continue;

      const batch = db.batch();
      slice.forEach((doc) => {
        batch.update(doc.ref, {
          blacklisted: false,
          lateCancellations: 0,
          blacklistedAt: admin.firestore.FieldValue.delete(),
        });
      });

      await batch.commit();
      processed += slice.length;
      console.log(`automaticWhitelisting: processed ${processed}/${docs.length}`);
    }
  }
);
