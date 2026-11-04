<!-- README.md -->
<!-- What Madness Schedule is, how to run, test and deploy it, and where the code lives. -->
<!-- First stop for anyone (human or AI) working on the repo. -->
<!-- RELEVANT FILES: AGENTS.md, index.html, admin.html, functions/index.js -->
# Madness Schedule 💪

Class booking app (PWA) for the Madness gym, plus a staff admin panel.
Vanilla JavaScript, Tailwind, and Firebase (Firestore, Auth, Cloud Functions, FCM).

## What it does

**Members** (`index.html`) can:
- See today's and tomorrow's classes and book a spot.
- Join a waitlist when a class is full, and get a 5-minute turn when a spot frees up.
- Cancel bookings. Cancelling less than 2 hours before class adds a strike. 3 strikes block the account until staff unlock it.
- Get push reminders 60, 30 and 15 minutes before class.
- See their history and attendance, and send the TotalPass token.

**Staff** (`admin.html`) can:
- See the week calendar, bookings and waitlists.
- Create, edit and delete classes, add WhatsApp bookings and mark attendance.
- Manage subscriptions, TotalPass, strikes, the blacklist and daily announcements.
- Read reports. Revenue figures are **estimates**: class price × bookings, or $120 per booking.

**Automated jobs** (Cloud Functions):
- Generate next week's classes every Saturday at 4 PM (Mexico City).
- Send booking reminders and the TotalPass reminder.
- Move the waitlist along when a spot opens.
- Reset strikes on the 1st of each month (blacklisted members stay blocked).
- Mark monthly plans unpaid on the 1st, with a 10-day grace period.

There is no offline mode. The service worker only handles push notifications; booking always needs a connection.

## Run it locally

It's a static site with no build step. Serve the repo root:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/index.html or `/admin.html`.

It talks to the **production** Firebase project. Use a test account, and avoid real bookings.

## Tests

```bash
npm test
```

This runs every `scripts/*.test.cjs` with Node's test runner and in-memory Firebase fakes. It needs no network or credentials.

## Styles

Tailwind is prebuilt into `styles/tailwind.css` (committed). After adding new Tailwind classes, rebuild it and commit the result:

```bash
npm run build:css
```

App styles live in `styles/tokens.css`, `app.css`, `cempasuchil.css` and `admin.css`. When you change one, bump its `?v=` query in the HTML so phones fetch the new file.

## Deploy

- **Website:** GitHub Pages serves the repo root at the custom domain in `CNAME` (`madness.chinito.cc`). Pushing to the branch selected in Settings → Pages publishes it. That branch should be `main`.
- **Backend:** Cloud Functions, Firestore rules and indexes deploy with the Firebase CLI. `firebase.json` has no Hosting target.

```bash
firebase deploy --only functions,firestore
```

## Where the code lives

| Path | What |
| --- | --- |
| `index.html`, `scripts/member/` | Member app. Plain scripts loaded in order; `main.js` starts it. Screens are in `scripts/member/screens/`. |
| `admin.html`, `scripts/admin/` | Admin panel. `core.js` defines `AdminPanel`, each file adds methods, `views/` holds large markup, and `main.js` starts it. |
| `scripts/app-accessibility.js` | Connection banner, the name dialog and admin modal focus handling. |
| `service-worker.js` | Push notifications (background messages and click). |
| `functions/` | Cloud Functions: bookings, waitlist, reminders, scheduled jobs. |
| `firestore.rules`, `firestore.indexes.json` | Database security rules and indexes. |
| `docs/` | Redesign and static-Tailwind notes with screenshots. |
