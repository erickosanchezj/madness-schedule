// functions/src/generateDailyClasses.js
// Scheduled Cloud Function to auto-generate classes from the weekly template.
// Ensures the daily schedule is created for today and tomorrow without manual admin actions.
// RELEVANT FILES: admin.html, functions/index.js, functions/src/bookingReminders.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const db = admin.firestore();
const TIME_ZONE = "America/Mexico_City";
const DAILY_CRON = "30 0 * * *"; // 12:30 AM local time

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toTimeZone(date, timeZone) {
  const invdate = new Date(date.toLocaleString("en-US", { timeZone }));
  const diff = date.getTime() - invdate.getTime();
  return new Date(date.getTime() - diff);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function buildStartEnd(dateStr, timeStr, duration = 60) {
  const start = new Date(`${dateStr}T${timeStr}:00-06:00`);
  const end = new Date(start.getTime() + Number(duration || 60) * 60000);
  return {
    startAt: admin.firestore.Timestamp.fromDate(start),
    endAt: admin.firestore.Timestamp.fromDate(end),
    classDate: start.toISOString().slice(0, 10),
    timeUTC: start.toISOString().slice(11, 16),
  };
}

exports.generateDailyClasses = onSchedule(
  { region: "us-central1", schedule: DAILY_CRON, timeZone: TIME_ZONE },
  async () => {
    console.log("[generateDailyClasses] Starting scheduled run");

    const templateSnap = await db.collection("schedule_template").get();
    if (templateSnap.empty) {
      console.warn("[generateDailyClasses] No schedule_template documents found");
      return { created: 0, reason: "no-template" };
    }

    const weeklySchedule = {};
    templateSnap.forEach((doc) => {
      weeklySchedule[doc.id] = doc.data()?.classes || [];
    });

    const now = toTimeZone(new Date(), TIME_ZONE);
    const tomorrow = addDays(now, 1);

    const targets = [
      { date: now.toISOString().slice(0, 10), dow: now.getUTCDay() },
      { date: tomorrow.toISOString().slice(0, 10), dow: tomorrow.getUTCDay() },
    ];

    const batch = db.batch();
    const created = [];

    for (const target of targets) {
      const templateForDay = weeklySchedule[String(target.dow)] || [];
      if (!templateForDay.length) continue;

      const existingSnap = await db
        .collection("classes")
        .where("classDate", "==", target.date)
        .get();

      const existingTimes = new Set(
        existingSnap.docs
          .map((doc) => doc.get("time"))
          .filter((value) => typeof value === "string" && value.length)
      );

      for (const entry of templateForDay) {
        const rawTime = (entry?.time || "").trim();
        if (!rawTime) continue;

        const duration = Number(entry?.duration || 60);
        const { startAt, endAt, classDate, timeUTC } = buildStartEnd(
          target.date,
          rawTime,
          duration
        );

        if (existingTimes.has(timeUTC)) {
          continue;
        }

        const isTRX = /trx/i.test(entry?.name || "");
        const capacity =
          typeof entry?.capacity === "number"
            ? entry.capacity
            : isTRX
            ? 13
            : 15;

        const docRef = db.collection("classes").doc();
        batch.set(docRef, {
          name: entry?.name,
          time: timeUTC,
          instructor: entry?.instructor || "Por Asignar",
          duration,
          classDate,
          capacity,
          enrolledCount: 0,
          startAt,
          endAt,
          description: `Clase de ${entry?.name}`,
          icon: entry?.icon || "💪",
          image:
            entry?.image ||
            `https://placehold.co/400x250/1f2937/ffffff?text=${encodeURIComponent(
              entry?.name || "Clase"
            )}`,
        });

        existingTimes.add(timeUTC);
        created.push({
          id: docRef.id,
          date: classDate,
          time: timeFormatter.format(startAt.toDate()),
          name: entry?.name,
        });
      }
    }

    if (!created.length) {
      console.log("[generateDailyClasses] Schedule already up to date");
      return { created: 0 };
    }

    await batch.commit();
    console.log(
      `[generateDailyClasses] Created ${created.length} classes:`,
      created
    );

    const notificationRecord = {
      type: "daily-classes",
      classId: "Generación automática",
      userId: `Se generaron ${created.length} clases`,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      createdCount: created.length,
      classes: created,
    };

    // Store a summary notification so the admin dashboard highlights the run.
    await db.collection("notifications").add(notificationRecord);

    return { created: created.length, classes: created };
  }
);
