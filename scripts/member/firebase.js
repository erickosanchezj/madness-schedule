// scripts/member/firebase.js
// Starts Firebase and creates the Firestore, Auth, Messaging and callable handles.
// One place for the public client config shared by every member script.
// RELEVANT FILES: index.html, service-worker.js, scripts/member/main.js

// ---- Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBvvPDDlWsRqV4LdmNeZBuLfBn8k3_mI2A",
  authDomain: "madnessscheds.firebaseapp.com",
  projectId: "madnessscheds",
  storageBucket: "madnessscheds.firebasestorage.app",
  messagingSenderId: "788538690861",
  appId: "1:788538690861:web:ce19ead5929a8867c197a4"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const messaging = firebase.messaging();
const functionsSvc = firebase.app().functions('us-central1');
const cancelBookingCallable = functionsSvc.httpsCallable('cancelBooking');
const createBookingCallable = functionsSvc.httpsCallable('createBooking');
const joinWaitlistCallable = functionsSvc.httpsCallable('joinWaitlist');
const leaveWaitlistCallable = functionsSvc.httpsCallable('leaveWaitlist');
