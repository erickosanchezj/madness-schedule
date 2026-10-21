// functions/src/memberBooking.js
// Provides server-owned booking and waitlist callables for members.
// Prevents clients from bypassing capacity, holds, and queue positions.
// RELEVANT FILES: functions/index.js, firestore.rules, index.html, functions/src/waitlistNotifications.js
const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();
const COOLDOWN_MS = 15 * 60 * 1000;

function requireClassId(value) {
  const classId = typeof value === "string" ? value.trim() : "";
  if (!classId) throw new HttpsError("invalid-argument", "classId is required.");
  return classId;
}

function asDate(value) {
  if (value?.toDate) return value.toDate();
  return value instanceof Date ? value : null;
}

function isBlockedSubscription(user, now) {
  if (user.subscriptionType !== "monthly" || user.subscriptionStatus === "paid") return false;
  const graceUntil = asDate(user.subscriptionGraceUntil);
  return !graceUntil || graceUntil.getTime() <= now.getTime();
}

async function createBooking(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

  const classId = requireClassId(request.data?.classId);
  const uid = request.auth.uid;
  const classRef = db.collection("classes").doc(classId);
  const bookingRef = db.collection("bookings").doc(`${classId}_${uid}`);
  const userRef = db.collection("users").doc(uid);
  const waitRef = db.collection("waitlists").doc(`${classId}_${uid}`);

  await db.runTransaction(async (tx) => {
    const [classSnap, bookingSnap, userSnap, waitSnap] = await Promise.all([
      tx.get(classRef), tx.get(bookingRef), tx.get(userRef), tx.get(waitRef),
    ]);
    if (!classSnap.exists) throw new HttpsError("not-found", "La clase ya no existe.");
    if (bookingSnap.exists) throw new HttpsError("already-exists", "Ya tienes reserva para esta clase.");

    const now = admin.firestore.Timestamp.now().toDate();
    const user = userSnap.data() || {};
    if (user.blacklisted === true) {
      throw new HttpsError("permission-denied", "Tu cuenta está bloqueada temporalmente.");
    }
    if (isBlockedSubscription(user, now)) {
      throw new HttpsError("failed-precondition", "Tu suscripción mensual requiere pago.");
    }
    const lastCancelAt = asDate(user.lastCancelAt);
    if (lastCancelAt && now.getTime() - lastCancelAt.getTime() < COOLDOWN_MS) {
      throw new HttpsError("failed-precondition", "Debes esperar 15 minutos después de cancelar.");
    }

    const cls = classSnap.data() || {};
    const capacity = Number(cls.capacity || 0);
    const enrolled = Number(cls.enrolledCount || 0);
    const startAt = cls.startAt;
    if (!Number.isFinite(capacity) || capacity < 1 || !asDate(startAt)) {
      throw new HttpsError("failed-precondition", "La clase no tiene datos válidos.");
    }

    const holdExpiresAt = asDate(cls.waitlistHoldExpiresAt);
    const holdActive = cls.waitlistHoldUserId && cls.waitlistHoldWaitlistId &&
      holdExpiresAt && holdExpiresAt.getTime() > now.getTime();
    const ownsHold = holdActive && cls.waitlistHoldUserId === uid &&
      cls.waitlistHoldWaitlistId === waitRef.id && waitSnap.exists;
    if (holdActive && !ownsHold) {
      throw new HttpsError("failed-precondition", "Hay un turno activo de lista de espera.");
    }
    if (enrolled >= capacity && !ownsHold) {
      throw new HttpsError("failed-precondition", "La clase está llena.");
    }

    tx.set(bookingRef, {
      classId,
      userId: uid,
      userName: request.auth.token.name || request.auth.token.email || "Miembro",
      startAt,
      classDate: cls.classDate || "",
      time: cls.time || "",
      className: cls.name || cls.title || "Clase",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(classRef, {
      enrolledCount: admin.firestore.FieldValue.increment(1),
      ...(ownsHold ? {
        waitlistHoldUserId: admin.firestore.FieldValue.delete(),
        waitlistHoldWaitlistId: admin.firestore.FieldValue.delete(),
        waitlistHoldExpiresAt: admin.firestore.FieldValue.delete(),
      } : {}),
    });
    if (waitSnap.exists) tx.delete(waitRef);
  });

  return { ok: true };
}

async function joinWaitlist(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

  const classId = requireClassId(request.data?.classId);
  const uid = request.auth.uid;
  const classRef = db.collection("classes").doc(classId);
  const waitRef = db.collection("waitlists").doc(`${classId}_${uid}`);
  const userRef = db.collection("users").doc(uid);
  const lastWaiterQuery = db.collection("waitlists")
    .where("classId", "==", classId).orderBy("position", "desc").limit(1);

  const result = await db.runTransaction(async (tx) => {
    const [classSnap, userSnap, waitSnap, lastWaiterSnap] = await Promise.all([
      tx.get(classRef), tx.get(userRef), tx.get(waitRef), tx.get(lastWaiterQuery),
    ]);
    if (!classSnap.exists) throw new HttpsError("not-found", "La clase ya no existe.");
    if (waitSnap.exists) return { position: waitSnap.get("position") || 1, existing: true };
    if (userSnap.get("blacklisted") === true) {
      throw new HttpsError("permission-denied", "Tu cuenta está bloqueada temporalmente.");
    }
    const cls = classSnap.data() || {};
    if (Number(cls.enrolledCount || 0) < Number(cls.capacity || 0)) {
      throw new HttpsError("failed-precondition", "Todavía hay cupos disponibles.");
    }
    const last = lastWaiterSnap.docs[0];
    const position = Number(last?.get("position") || 0) + 1;
    tx.create(waitRef, {
      classId,
      userId: uid,
      position,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { position, existing: false };
  });

  return { ok: true, ...result };
}

async function leaveWaitlist(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

  const classId = requireClassId(request.data?.classId);
  const uid = request.auth.uid;
  const classRef = db.collection("classes").doc(classId);
  const waitRef = db.collection("waitlists").doc(`${classId}_${uid}`);

  await db.runTransaction(async (tx) => {
    const [classSnap, waitSnap] = await Promise.all([tx.get(classRef), tx.get(waitRef)]);
    if (!waitSnap.exists) return;
    tx.delete(waitRef);
    if (classSnap.exists && classSnap.get("waitlistHoldWaitlistId") === waitRef.id) {
      tx.update(classRef, {
        waitlistHoldUserId: admin.firestore.FieldValue.delete(),
        waitlistHoldWaitlistId: admin.firestore.FieldValue.delete(),
        waitlistHoldExpiresAt: admin.firestore.FieldValue.delete(),
      });
    }
  });

  return { ok: true };
}

module.exports = { createBooking, joinWaitlist, leaveWaitlist };
