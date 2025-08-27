// v2 style
const admin = require("firebase-admin");
const { onCall } = require("firebase-functions/v2/https");

admin.initializeApp();

exports.sendDirectNotification = onCall(
  { region: "us-central1" },          // 👈 region here (v2 style)
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      // onCall v2 throws plain Errors; the SDK maps them to HttpsError client-side
      throw new Error("unauthenticated");
    }
    if (auth.token?.admin !== true) {
      throw new Error("permission-denied");
    }

    const { token, title, body } = request.data || {};
    if (!token || !title || !body) {
      throw new Error("invalid-argument");
    }

    try {
      const messageId = await admin.messaging().send({
        token,
        notification: { title, body },
      });
      return { success: true, messageId };
    } catch (err) {
      // Return a structured error; client will see a FirebaseError
      throw new Error(err?.message || "Failed to send notification.");
    }
  }
);