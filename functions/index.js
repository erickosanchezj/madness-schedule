// functions/index.js  (Functions v1 SDK)
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendDirectNotification = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Auth required.");
    }
    if (context.auth.token.admin !== true) {
      throw new functions.https.HttpsError("permission-denied", "Admins only.");
    }

    const { token, title, body } = data || {};
    if (!token || !title || !body) {
      throw new functions.https.HttpsError("invalid-argument", "Missing args.");
    }

    try {
      const messageId = await admin.messaging().send({
        token,
        notification: { title, body },
      });
      return { success: true, messageId };
    } catch (err) {
      throw new functions.https.HttpsError(
        "unknown",
        err?.message || "Failed to send.",
        err
      );
    }
  });