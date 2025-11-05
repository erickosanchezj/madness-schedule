// functions/index.js
// Entry point for Firebase Cloud Functions.
// Exposes callable APIs and triggered functions.
// RELEVANT FILES: functions/src/bookingReminders.js, functions/src/waitlistNotifications.js
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFunctions } = require("firebase-admin/functions");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const { pruneTokenInUsers } = require("./lib/pruneTokenInUsers");

// Allowed origins for admin-only callable functions served to the web dashboard.
const ADMIN_PANEL_ORIGINS = ["https://madness.chinito.cc"];
const ADMIN_ORIGIN_SET = new Set(ADMIN_PANEL_ORIGINS);

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const REMINDER_FUNCTION_FQFN =
  "projects/madnessscheds/locations/us-central1/functions/sendBookingReminder";
const FIVE_DAY_MS = 5 * 24 * 60 * 60 * 1000;

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
  let reminderTaskNames = [];

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
    reminderTaskNames = Array.isArray(bookingData.reminderTaskNames)
      ? bookingData.reminderTaskNames.filter(
          (name) => typeof name === "string" && name.trim() !== ""
        )
      : [];
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

  if (reminderTaskNames.length > 0) {
    try {
      const queue = getFunctions().taskQueue(REMINDER_FUNCTION_FQFN);
      await Promise.all(
        reminderTaskNames.map((taskName) =>
          queue.delete(taskName).catch((err) => {
            console.error("cancelBooking: failed to delete reminder task", taskName, err);
          })
        )
      );
    } catch (err) {
      console.error("cancelBooking: reminder cleanup failed", err);
    }
  }

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

const userUnlockNotifications = require("./src/userUnlockNotifications");
exports.onUserUnlockNotification =
  userUnlockNotifications.onUserUnlockNotification;

const buildStrikeResetUpdates = async () => {
  const snap = await db.collection("users").get();

  const updates = [];
  let blacklistedCount = 0;
  let strikeCount = 0;

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const fields = {};

    const rawStrikes = data.lateCancellations;
    const numericStrikes = typeof rawStrikes === "number" ? rawStrikes : Number(rawStrikes);
    const hasValidNumber = Number.isFinite(numericStrikes);
    const strikesOverZero = hasValidNumber && numericStrikes > 0;
    const needsStrikeReset = strikesOverZero || (rawStrikes !== undefined && rawStrikes !== 0);

    if (strikesOverZero) {
      strikeCount += 1;
    }

    if (needsStrikeReset) {
      fields.lateCancellations = 0;
    }

    const isBlacklisted = data.blacklisted === true;
    if (isBlacklisted) {
      blacklistedCount += 1;
      fields.blacklisted = false;
    }

    if (data.blacklistedAt !== undefined) {
      fields.blacklistedAt = FieldValue.delete();
    }

    if (Object.keys(fields).length > 0) {
      updates.push({ ref: doc.ref, fields });
    }
  });

  return {
    updates,
    totals: {
      blacklisted: blacklistedCount,
      strikes: strikeCount,
    },
  };
};

const commitStrikeResetUpdates = async (entries, logLabel) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    console.log(`${logLabel}: no users required strike reset.`);
    return { processed: 0, total: 0 };
  }

  const CHUNK = 400;
  let processed = 0;

  for (let i = 0; i < entries.length; i += CHUNK) {
    const slice = entries.slice(i, i + CHUNK);
    if (slice.length === 0) continue;

    const batch = db.batch();
    let writes = 0;

    slice.forEach(({ ref, fields }) => {
      if (!ref || !fields || Object.keys(fields).length === 0) return;
      batch.set(ref, fields, { merge: true });
      writes++;
    });

    if (writes === 0) continue;

    await batch.commit();
    processed += writes;
    console.log(`${logLabel}: processed ${processed}/${entries.length}`);
  }

  return { processed, total: entries.length };
};

exports.automaticWhitelisting = onSchedule(
  {
    region: "us-central1",
    schedule: "0 0 1 * *",
    timeZone: "America/Mexico_City",
  },
  async () => {
    const { updates, totals } = await buildStrikeResetUpdates();

    if (!updates.length) {
      console.log("automaticWhitelisting: no users required strike reset.");
      return;
    }

    console.log(
      `automaticWhitelisting: resetting strikes for ${updates.length} users (blacklisted=${totals.blacklisted}, strikes=${totals.strikes}).`
    );

    await commitStrikeResetUpdates(updates, "automaticWhitelisting");
  }
);

// Reset monthly member status at the start of each month and store a grace end date.
exports.resetMonthlySubscriptionStatuses = onSchedule(
  {
    region: "us-central1",
    schedule: "5 0 1 * *",
    timeZone: "America/Mexico_City",
  },
  async () => {
    const graceStart = new Date();
    const graceUntilDate = new Date(graceStart.getTime() + FIVE_DAY_MS);
    const graceUntil = admin.firestore.Timestamp.fromDate(graceUntilDate);

    const snapshot = await db
      .collection("users")
      .where("subscriptionType", "==", "monthly")
      .get();

    if (snapshot.empty) {
      console.log("resetMonthlySubscriptionStatuses: no monthly users to update.");
      return;
    }

    const docs = snapshot.docs;
    const BATCH_SIZE = 400;
    let processed = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const slice = docs.slice(i, i + BATCH_SIZE);
      if (slice.length === 0) continue;

      const batch = db.batch();
      slice.forEach((doc) => {
        batch.set(
          doc.ref,
          {
            subscriptionStatus: "unpaid",
            subscriptionGraceUntil: graceUntil,
          },
          { merge: true }
        );
      });

      await batch.commit();
      processed += slice.length;
      console.log(
        `resetMonthlySubscriptionStatuses: processed ${processed}/${docs.length}`
      );
    }

    console.log(
      `resetMonthlySubscriptionStatuses: updated ${processed} monthly users.`
    );
  }
);

// Restrict callable access to the known admin origins to satisfy browser preflight.
exports.resetAllStrikes = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    // Block unknown origins even though CORS allows the preflight so we can surface a clear error.
    const originHeader = request.rawRequest?.headers?.origin;
    if (originHeader && !ADMIN_ORIGIN_SET.has(originHeader)) {
      console.warn(`resetAllStrikes: blocked origin ${originHeader}`);
      throw new HttpsError("permission-denied", "Origen no autorizado.");
    }

    const auth = request.auth;
    if (!auth) throw new HttpsError("unauthenticated", "Auth required.");
    if (auth.token?.admin !== true) throw new HttpsError("permission-denied", "Admins only.");

    const { updates, totals } = await buildStrikeResetUpdates();
    const result = await commitStrikeResetUpdates(updates, "resetAllStrikes");

    return {
      ok: true,
      updated: result.processed,
      totalTargets: result.total,
      blacklistedCount: totals.blacklisted,
      strikeCount: totals.strikes,
    };
  }
);
