<!-- docs/redesign/README.md -->
<!-- Records the redesign, verification, infrastructure and publication steps. -->
<!-- Gives the owner a reviewable handoff without changing production settings. -->
<!-- RELEVANT FILES: index.html, admin.html, service-worker.js, firebase.json -->
# Madness mobile PWA redesign

Latest update: [Cempasúchil integration and deployment hold](cempasuchil.md).
The redesign branch has since been used for a successful Pages deployment;
pushing further updates can publish them automatically.

Branch: `redesign/madness-mobile-pwa`. Base: `051e5c640eb24d952464599f2264c6cf66ded65b`.
The original branch was `work`; the working tree was clean. The remote is
`https://github.com/erickosanchezj/madness-schedule.git`. Default branch: `main`.
The initially stale `origin/main` reference was refreshed and matches the base.
No production records, Firebase rules, domain files, manifest identity, deployment
settings or backend functions were changed. No PR or merge was created.

## Review the result

Open [compare.html](compare.html) for before/after member screenshots.
Images use **isolated, in-memory fixtures**, existing class names and repository
images. They are not screenshots of production bookings, actual availability,
member records or a successfully authenticated Firebase session. External requests
are intercepted. Existing Inter and Archivo Black fonts are supplied temporarily
from font packages for faithful captures. Original screenshots use the same setup.

Shared styling preserves dark surfaces and the existing typefaces. The latest
integration uses the orange accent from the cempasúchil feature branch.
Agenda keeps upcoming reservations ahead of the schedule, with compact class rows
and more room for full-class actions. Profile settings use clearer rows.
Navigation retains Agenda, Historial and Perfil. Calendar event placement now uses
live CSS hour units so orientation/viewport changes keep events aligned. Confirmation and name dialogs
have focus containment, Escape support and scroll limits. Forms have visible
labels, 16px text and browser zoom remains enabled. Staff get section links,
readable mobile forms, a responsive subscription table and the existing calendar.
Safe areas, dynamic viewport height, landscape and reduced motion are handled.

Changed copy: `Reservar!` → `Ver clase` (the row opens details rather than booking);
`Generar/Verificar Clases (Próxima Semana)` → `Completar semana` (the handler fills
classes from today through Saturday, not the entire next week);
`Última actualización: —` / `Próxima actualización en: —` → the same labels with
`Sin datos`. The member profile prompt becomes an `Editar nombre` dialog with
`Nombre y apellido`, `Cancelar` and `Guardar`. Added copy only explains existing
connection requirements, failed loads and accessibility controls.

## Screen and state inventory

| Entry/screen | Existing functionality and connections | Existing state coverage |
| --- | --- | --- |
| `/`, `/index.html`, sign-in / registration | Firebase email/password Auth, client Turnstile widget; creates a user profile if absent; Analytics remains | Initial spinner; missing credentials/challenge and Firebase errors use alerts; toggle sign-in/register |
| `?screen=agenda` | Live classes, own bookings, waitlist, attendance, user subscription/strikes and daily messages; today/tomorrow filters | Skeletons, empty reservations/schedule, booked/full/held/your-turn/queue position; class and booking read errors now get retry instead of false empty results |
| `?screen=history` | Completed classes today and last 14 days, recorded attendance, TotalPass daily code via WhatsApp | Empty today/recent history, attended/absent/unrecorded; no dedicated history skeleton/error state |
| `?screen=profile` | Auth identity, name update in Auth + Firestore, TotalPass preference, subscription/payment/strike status, push permission/token, WhatsApp/Instagram, sign-out | Paid/unpaid/grace notices, push enabled/disabled/unsupported; saved/failed preference feedback |
| `?screen=classDetails&classId=…` | Existing image, instructor, time/date, duration, occupancy; create booking / join or leave waitlist callables | Reserved, monthly payment blocked, full, active hold, queue position, confirmation and callable errors; missing class falls back to agenda |
| Manifest `?screen=schedule` / `?screen=bookings` | Both now resolve to the existing Agenda; no new destination | Previously unrecognized aliases; direct history/details now attach their existing listeners; classId is read from the query |
| `/admin.html` sign-in | Firebase Auth + required admin custom claim; Turnstile widget | Login error, access denied and startup error; no test admin account available |
| Admin weekly calendar / reservation accordions | Real-time classes/bookings/waitlists, concurrent classes, current-time line, today highlight | No classes/reservations, snapshot errors; mobile calendar shows today, reservation accordions retain other days |
| Admin create/edit class, attendance tab | Existing validated CRUD, guarded time changes after attendance exists, manual WhatsApp bookings/removal, attendance save | Required fields, capacity limits, immutable time warnings, no attendees, write errors, delete confirmation |
| Admin subscriptions | Member search/filter, paid status, TotalPass approval/rejection, subscription type change | Loading/empty/error, payment and grace states, confirmations |
| Admin reports | Date/period/class/instructor/metric filters, capacity gauge/heatmap, attendance/revenue/retention/popularity charts, CSV exports and estimates | Skeletons, empty range, cached data; some failures only log to console |
| Admin notifications/messages/users/blacklist | Delivery history and failures, daily message CRUD/activation, user pagination/search, password reset, direct push/token pruning, strikes/reset/rehabilitation | Empty/loading/error and confirmations; existing handlers and permissions preserved |

There is no router/framework build: two static HTML entrypoints contain template
renderers and vanilla event delegation. Member state is a local object; admin
state uses objects, Maps and Sets. Tailwind CDN utilities, Lucide, DOMPurify and
Chart.js remain. Existing monolithic HTML files exceed the repository's 300-line
guideline; new presentation/helper/test files stay below it. No unrelated
business-logic extraction or new runtime dependency was introduced.

## Infrastructure inspection and limitations

- **Firestore:** classes, bookings, users, waitlists, attendance, notifications,
  schedule_template and dailyMessages. Public class/template reads; member data
  scoped to authenticated ownership; admin custom claims gate administration.
  Member bookings and waitlist writes go through transaction-based server
  callables; direct member writes to those collections remain denied.
- **Functions:** `us-central1`; booking creation/cancellation and waitlist join/leave,
  admin direct notifications/reset/backfill; booking-create reminders via task
  queues at 60/30/15 minutes, TotalPass reminder 5–10 minutes after class,
  waitlist cascade with five-minute holds/expiry, unlock notifications; Saturday
  16:00 schedule generation and monthly strike/subscription resets. These are
  implemented code paths, not newly invented backend capabilities.
- **Storage/Realtime Database:** a Storage bucket appears in the client config,
  but no Storage or RTDB client usage, upload flow or corresponding rules was
  found. No emulator configuration or safe test account is supplied.
- **Configuration:** inline Firebase public client configuration is used by both
  pages and the worker. The environment-generated config files are ignored and
  are not imported by these pages. `npm run build` generates config files and
  requires six FIREBASE_* variables; it is not a bundler. No values are printed
  in this report. No credentials were changed.
- **Hosting:** README/AGENTS describe Firebase Hosting, but firebase.json contains
  only Functions and Firestore settings, no Hosting target. Root static files,
  `.nojekyll` and existing CNAME support Pages. No tracked `.github/workflows`
  exists at the base or refreshed default branch. Pages settings GET returned
  Forbidden, so the saved Pages source cannot be independently attested.
- **PWA:** member/admin names, scope `./`, start URLs, standalone mode, portrait
  orientation, theme colors, 192/512 icons and Apple touch icons are unchanged.
  Both manifests share scope; check installing both apps on real devices.
  Existing icons declare maskable support; actual safe-zone/device rendering
  needs inspection on Android. No custom install prompt existed or was added.
- **Worker:** root `/service-worker.js` imports vendored Firebase messaging,
  handles push and notification-click navigation. It has no fetch/cache strategy
  for HTML/assets, so **offline startup is unavailable**. Existing Firestore
  IndexedDB persistence can retain previously read private data on a device;
  this is not a guarantee of a complete offline experience. Reservation and
  waitlist callables require a connection. No new caching or offline writes.
- **Updates:** existing `skipWaiting()`/`clients.claim()` remain. No reload on
  controller change exists; the redesign adds no forced reload. A notification
  click can navigate an existing tab. Unchanged-worker update checks were tested;
  activation of a newly deployed worker version was not tested.
- **Paths:** worker registration, vendored imports, notification destinations and
  callable origin restrictions assume the existing root custom domain. A plain
  GitHub project subpath is not fully compatible. CNAME and all domain settings
  remain untouched. A branch does not isolate Firebase, IndexedDB or localStorage.
- **Security follow-ups, unchanged:** Turnstile tokens are checked client-side but
  not verified by a server in the observed Auth path. Review Firestore user update
  rules using `changedKeys()` rather than `affectedKeys()` (new/removed keys may
  escape the allowlist). Verify with emulators before any rule change. Existing
  FCM payload/token logging and private persistent caches warrant privacy review.
  Token-pruning's legacy boolean lookup may miss current metadata-map tokens.
  Only one composite index is declared; other query combinations may require
  indexes already deployed outside this repository. Production configuration and
  deployed indexes/functions could not be independently audited.
- **Analytics limitations:** revenue is an estimate using price/default ticket
  price, not payment processor income; admin BI calculations are local heuristics.
  Existing native admin confirmations and some alerts remain. No backend or
  database work was done to conceal these limitations.

## Verification

See [checks.txt](checks.txt) for recorded outputs. Chromium used `/usr/bin/chromium`
on Linux with local server and isolated fixtures; this is **not real iOS or Android
verification** and not a Firebase integration test.

Member widths: 320, 375, 390, 430, 768, 1280, 1920. Admin: 390, 768, 1280;
Hallmark render additionally inspected 320, 375, 1280, 1440 and 1920. No supported
light theme existed; the dark theme was preserved. Checks include renderable
member screens, class/full states, stubbed create/cancel/join/leave callables,
profile updates, modal Escape, admin dialog Escape, no page overflow,
offline/reconnection banner and preservation of a name draft. No production writes.

`npm test` prints `No tests specified`; it is not a test suite.
`npm run build` fails because the six required environment variables are absent.
It exits before writing files. Static serving works with existing inline config.
JavaScript syntax and `git diff --check` pass.

Hallmark static comparison keeps 2/2 static links, 4/4 recorded inline handlers
and 118/118 script hooks. The initial live render was blocked by unavailable
external dependencies, so rendered before/after evidence uses isolated fixtures.
Hallmark render uses script-free snapshots produced by the real screen renderers,
plus the actual shared styles and temporary generated Tailwind/fonts.
The baseline linter's rendered URL was not a successful authenticated screen;
its baseline FAIL count is not a valid visual quality score.

Render warning 72 is waived: native closed `details` hides roster descendants,
which the probe counts outside the closed box. Expanded disclosures keep padding.
Calendar control-size warning 39b is waived: event height encodes actual duration,
with a 44px minimum target, rather than a conventional form control.
F4 is answered: attended/absent controls are labeled status selections.
F6 is dismissed: connection-status is prose, not a numerical figure.
Static warnings: legacy Tailwind utility names are retained for wiring, their
visible colors map to shared tokens; admin placeholder-image creation remains
unchanged; the generic success-string heuristic points into notification rendering,
whose actual send path is an authenticated callable, not a fake send. Before-URL
comparison warning is expected; source wiring comparison and matching fixture
screenshots are supplied separately.

Remaining checks: physical iOS Safari and Android Chrome, standalone installation,
notches/home indicator and real keyboard, landscape, VoiceOver/TalkBack, account
login/registration with Turnstile on the actual allowed domain, paid/unpaid/strike
and queue scenarios using an emulator/test account, push permission/delivery and
notification deep links, update activation with multiple open tabs and active forms.

To reproduce locally, install temporary tools outside the repository:

```sh
npm install --prefix /tmp/hallmark --no-save puppeteer-core tailwindcss@3.4.17 lucide@0.468.0 dompurify@3.0.5 chart.js @fontsource/inter @fontsource/archivo-black
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > /tmp/madness-tailwind-input.css
/tmp/hallmark/node_modules/.bin/tailwindcss -i /tmp/madness-tailwind-input.css -o /tmp/madness-tailwind.css --content './index.html,./admin.html' --minify
python3 -m http.server 8085
# In another terminal, from this repository:
node scripts/verify-member.cjs --before
node scripts/verify-member.cjs
node scripts/verify-admin.cjs --before
node scripts/verify-admin.cjs
```

The checks intercept all external requests. The isolated admin check asserts that 16:00 events stay aligned with the 16:00
slot across phone, tablet and desktop widths.

The signed-in renderer is exposed only
in the browser's intercepted test response; no production test hook is shipped.

## Manual Pages publishing and restoration

1. First open repository **Settings → Pages**, and record the current **Source**,
   **branch**, and **folder** (or take a screenshot). The settings API was denied;
   do not assume the current source is main. Preserve that record for rollback.
2. If Source is **Deploy from a branch**, select `redesign/madness-mobile-pwa`
   and **`/ (root)`**, then Save when you decide to publish. The app is the root
   `index.html` plus `admin.html`, `styles`, `scripts`, `images`, `vendor`,
   manifests and worker. There is no `dist`, `build`, `public` or `docs` app output.
   Do not select `/docs`; it contains review evidence, not the application.
3. If Source is **GitHub Actions**, branch selection alone is insufficient.
   No build/deploy workflow is checked into this repository. A Pages artifact
   workflow would need separate authorization and must publish the root static
   app files; do not run `npm run deploy` or `firebase deploy`. This branch does
   not supply or modify a deployment workflow.
4. Leave the custom domain, DNS, HTTPS settings, CNAME and Firebase targets as
   they are. Use the existing root custom domain for the app; a project subpath
   preview has the known worker and notification path limitation above.
5. Wait for GitHub's Pages build/deploy to finish. Open the domain in a fresh
   browser tab, verify sign-in and schedule using an authorized account, then
   launch the installed app. Finish or cancel any open form before manually
   closing/reopening the installed app or refreshing. The worker contains no
   cached UI shell to purge, and this redesign does not force reloads. Do not
   clear site data: that can remove auth, cached private data and device tokens.
6. To restore, return **Source/branch/folder to exactly the values recorded in
   step 1**, then wait for that Pages deployment and manually reopen/refresh
   after finishing forms. If the former source was main/root, reselect
   `main` + `/ (root)`; otherwise use its actual recorded values. For an Actions
   source, restore the previous authorized artifact/deployment through its
   existing process. No branch merge or Firebase rollback is needed for these
   UI-only changes. Neither switching branch nor restoring Pages undoes any real
   bookings made while using the same production backend.

No publishing, domain changes or production activation were performed by this work.
