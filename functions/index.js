const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendDirectNotification = functions.https.onCall(async (data, context) => {
  // 1. Authentication Check: Ensure the user is authenticated and is an admin.
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
    );
  }
  if (context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Only admin users can send direct notifications.",
    );
  }

  const {token, title, body} = data;
  if (!token || !title || !body) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with required arguments.",
    );
  }

  const payload = {
    token: token,
    notification: {
      title: title,
      body: body,
    },
  };

  try {
    const response = await admin.messaging().send(payload);
    console.log("Successfully sent message:", response);
    return {success: true, messageId: response};
  } catch (error) {
    console.error("Error sending message:", error);
    throw new functions.https.HttpsError(
        "unknown",
        error.message || "Failed to send notification.",
        error,
    );
  }
});