const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * A callable Cloud Function to send a single FCM notification.
 * This function can only be called by an authenticated admin user.
 */
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

  // 2. Data Validation: Ensure the required data (token, title, body) was sent.
  const {token, title, body} = data;
  if (!token || !title || !body) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with 'token', 'title', and 'body' arguments.",
    );
  }

  // 3. Construct the FCM payload.
  const payload = {
    token: token,
    notification: {
      title: title,
      body: body,
    },
    // Optional: Add data for background handling or deep linking
    // data: {
    //   "click_action": "FLUTTER_NOTIFICATION_CLICK", // Example
    // }
  };

  try {
    // 4. Send the message using the Admin SDK.
    const response = await admin.messaging().send(payload);
    console.log("Successfully sent message:", response);
    return {success: true, messageId: response};
  } catch (error) {
    console.error("Error sending message:", error);
    // Return a structured error to the client.
    throw new functions.https.HttpsError(
        "unknown",
        error.message || "Failed to send notification.",
        error,
    );
  }
});