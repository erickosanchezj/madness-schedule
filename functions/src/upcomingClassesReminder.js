const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.remindUpcomingClasses = onSchedule(
  { region: 'us-central1', schedule: 'every 5 minutes' },
  async () => {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60000);

    const snap = await db
      .collection('classes')
      .where('start', '>=', admin.firestore.Timestamp.fromDate(now))
      .where('start', '<=', admin.firestore.Timestamp.fromDate(inOneHour))
      .get();

    if (snap.empty) return;

    const upcoming = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const title = data.title || 'Class';
      const start = data.start?.toDate();
      const time = start
        ? start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '';
      upcoming.push(`${title} at ${time}`);
    });

    const body = upcoming.join(', ');

    const tokens = (process.env.ADMIN_FCM_TOKEN || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      console.log('Upcoming classes:', body);
      return;
    }

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: 'Upcoming Classes',
        body,
      },
    });
  }
);
