const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();

/**
 * Small helper: remove a bad FCM token from any user doc that has it as:
 * users/{uid}.fcmTokens.<token> == true
 */
async function pruneTokenInUsers(token) {
  try {
    const fieldPath = `fcmTokens.${token}`;
    const snap = await db.collection("users").where(fieldPath, "==", true).get();
    if (snap.empty) return { prunedDocs: 0 };

    const batch = db.batch();
    snap.forEach(doc => {
      batch.set(
        doc.ref,
        { [fieldPath]: admin.firestore.FieldValue.delete() },
        { merge: true }
      );
    });
    await batch.commit();
    return { prunedDocs: snap.size };
  } catch (e) {
    console.error("Failed pruning token in users:", e);
    return { prunedDocs: 0, error: e?.message };
  }
}

const CALLABLE_OPTS = {
  region: "us-central1",
  invoker: "public",
  cors: {
    origin: true,
    allowedHeaders: ["Authorization", "Content-Type", "Firebase-Instance-ID-Token"],
  },
};

/**
 * Admin-only: send a direct push notification to a provided FCM token.
 * Auto-prunes token if FCM responds with "not registered" or "invalid".
 */
exports.sendDirectNotification = onCall(CALLABLE_OPTS, async (request) => {
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
exports.backfillEmailLower = onCall(CALLABLE_OPTS, async (request) => {
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

/**
 * Admin-only: send a push reminder for the next upcoming class.
 * Optionally pass `overrideClassId` to target a specific class.
 * Returns success/failure counts and prunes invalid FCM tokens.
 */
exports.sendManualClassReminder = onCall(CALLABLE_OPTS, async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Auth required.");
  if (auth.token?.admin !== true) throw new HttpsError("permission-denied", "Admins only.");

  const overrideClassId = request.data?.overrideClassId || null;
  const targetUid = request.data?.uid || null;

  // --- Find class
  let clsDoc;
  if (overrideClassId) {
    const snap = await db.collection("classes").doc(overrideClassId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Class not found.");
    clsDoc = { id: snap.id, ...snap.data() };
  } else {
    const now = new Date();
    const snap = await db
      .collection("classes")
      .where("startAt", ">=", now)
      .orderBy("startAt", "asc")
      .limit(1)
      .get();
    if (snap.empty) throw new HttpsError("not-found", "No upcoming classes.");
    const doc = snap.docs[0];
    clsDoc = { id: doc.id, ...doc.data() };
  }

  const classId = clsDoc.id;

  let tokenArr = [];
  if (targetUid) {
    const userSnap = await db.collection("users").doc(targetUid).get();
    if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");
    const data = userSnap.data() || {};
    tokenArr = Object.keys(data.fcmTokens || {});
  } else {
    // --- Collect tokens from users booked in this class
    const bookingsSnap = await db
      .collection("bookings")
      .where("classId", "==", classId)
      .get();
    const userIds = Array.from(
      new Set(bookingsSnap.docs.map((d) => d.data().userId).filter(Boolean))
    );

    const userSnaps = await Promise.all(
      userIds.map((uid) => db.collection("users").doc(uid).get())
    );

    const tokens = new Set();
    userSnaps.forEach((snap) => {
      const data = snap.data() || {};
      Object.keys(data.fcmTokens || {}).forEach((t) => tokens.add(t));
    });
    tokenArr = Array.from(tokens);
  }

  if (tokenArr.length === 0) {
    return { ok: true, classId, tokens: 0, successCount: 0, failureCount: 0 };
  }

  // --- Build notification
  const startDate = clsDoc.startAt?.toDate
    ? clsDoc.startAt.toDate()
    : new Date(clsDoc.startAt);
  const timeFmt = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const timeStr = timeFmt.format(startDate);
  const notif = {
    title: "Recordatorio de clase",
    body: `${clsDoc.name || "Clase"} a las ${timeStr}`,
  };

  // --- Send in batches of 500 tokens
  const BATCH = 500;
  let successCount = 0;
  let failureCount = 0;
  let pruned = 0;

  for (let i = 0; i < tokenArr.length; i += BATCH) {
    const slice = tokenArr.slice(i, i + BATCH);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: slice,
      notification: notif,
    });

    successCount += res.successCount;
    failureCount += res.failureCount;

    const invalid = [];
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.errorInfo?.code || r.error?.code || "";
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalid.push(slice[idx]);
        }
      }
    });

    if (invalid.length) {
      await Promise.all(invalid.map((t) => pruneTokenInUsers(t)));
      pruned += invalid.length;
    }
  }

  return { ok: true, classId, tokens: tokenArr.length, successCount, failureCount, pruned };
});
