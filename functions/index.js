// functions/index.js
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

exports.sendDirectNotification = onCall(
  { region: "us-central1" },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }
    if (auth.token?.admin !== true) {
      throw new HttpsError("permission-denied", "Admins only.");
    }

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
      // Map common FCM errors to friendlier codes if you like:
      // e.g. invalid token:
      if (err?.errorInfo?.code === "messaging/invalid-registration-token") {
        throw new HttpsError("invalid-argument", "Invalid FCM token.", err);
      }
      throw new HttpsError("unknown", err?.message || "Failed to send.", err);
    }
  }
);