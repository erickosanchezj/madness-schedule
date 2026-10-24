<!-- docs/static-tailwind/README.md -->
<!-- Records the static Tailwind build and its isolated browser verification. -->
<!-- Explains regeneration for root-served Pages without a deployment build. -->
<!-- RELEVANT FILES: tailwind.config.cjs, styles/tailwind.input.css, styles/tailwind.css, scripts/verify-tailwind-states.cjs -->
# Static Tailwind CSS

Branch: `optimization/static-tailwind`, based on refreshed main `dfd478e`.
The working tree was clean before branching. No push, merge or publication was
performed. Only the two Tailwind script tags changed in application HTML.

## Serving and rebuilding

The application is served from root `index.html` and `admin.html`, with `.nojekyll`
and CNAME present. There is no tracked `.github/workflows`, bundler, output folder,
or application build step. `firebase.json` has Functions/Firestore settings and no
Hosting target. `npm run build` only calls `build-config.js`; it requires Firebase
variables and does not build the application. This confirms the repository's
static-root layout described in the redesign report. The saved remote Pages
source was not independently queried or changed.

The generated `styles/tailwind.css` is intentionally committed. Pages can serve
it directly. No new deploy/build integration is required.

```sh
npm ci --ignore-scripts
npm run build:css
```

Use the repository's Node 22 version. This environment had Node 24.19.0 and npm
11.9.0; npm reported the existing Node 22 engine mismatch. Installation and checks
succeeded. The existing Browserslist database reports its age; no dependency
refresh unrelated to Tailwind was made.

After changing utility classes, run `npm run build:css` and commit both the source
change and generated CSS. This command calls the pinned Tailwind **3.4.17** CLI
alone. It needs no Firebase variables and never calls `build-config.js` or deploy.
Do not add runtime Tailwind or a second injected stylesheet for browser checks.

Both entrypoints load Tailwind first, before app.css and cempasuchil.css/admin.css.
The existing tokens, fonts, orange overrides, floral layer, back button, bottom
navigation and safe-area styles remain unchanged. The worker, Firebase code/rules,
schemas, manifests, CNAME and deployment configuration remain unchanged.

## Class inventory

Content scanning covers root HTML (including inline JS renderers) and
`scripts/app-accessibility.js`, the only separate runtime template helper.
Verification scripts, docs, dependencies and Firebase vendor bundles are excluded
so fixture-only classes do not hide missing application utilities.

Reviewed both HTML entrypoints' templates, className assignments, classList calls,
ternaries, variable class values and escaped attribute strings, plus the separate
helper. Backend scripts, config generation and the messaging worker contain no UI
templates; the docs comparison page is not an app entrypoint.

Member countdowns, booked/full/hold/queue/unpaid actions, history badges,
subscription badges, push toggles, nav, toast and modal transitions all use complete
utility strings. Admin capacity colors, report warnings/gauge, message activation,
subscription/TotalPass/payment badges, strike actions, disabled inputs and tabs
also use complete strings. Attendance selections, calendar states and shell classes
are defined by existing shared/screen CSS.

The sole partial utility construction is admin `showToast`: `bg-${color}-500/20`
and `text-${color}-300`, where color is rose, amber or emerald. The config lists
exactly those six utilities as a targeted safelist. No broad palette safelist or
business-logic change was needed.

## Verification and evidence

[Before/after gallery](compare.html), [check output](checks.txt), and
[screenshots](screenshots/).

- Existing member workflows pass: create/cancel booking, join/leave waitlist,
  profile update, dialog Escape/focus, offline/reconnect and draft preservation.
- All 45 detail state/viewport combinations pass: available, booked, full, waiting,
  your hold, another member's hold, unpaid, unknown capacity and long content at
  320×568, 390×844, 844×390, 768×1024 and 1280×800.
- Agenda overflow checks pass at 320, 375, 430, 768, 1280 and 1920 pixels.
- Shell checks pass at 390×844, 390×720, restored 390×844, 844×390 and 320×568,
  with simulated 47px top/34px bottom safe areas: scrolling/resume, flowers behind
  cards, orange token, no root scrolling and no navigation gaps. Back button
  remains pinned, focusable and tappable while details scroll on three viewports.
- Existing admin calendar alignment checks pass at 390/768/1280 pixels, populated
  subscriptions at 320px and create-dialog Escape. Added edit/attendance tab,
  attended/absent selection, three dynamic toast colors and no-overflow checks
  pass at 320×568, 430×932, 844×390, 768×1024 and 1280×800 with simulated safe areas.
  Tests exercise in-memory selections, without saving attendance to a database.
- Both suites assert one loaded repository Tailwind stylesheet, zero Tailwind CDN
  requests, no `window.tailwind` runtime and zero browser page errors. Other
  external requests are intercepted with isolated Firebase fixtures and local
  fonts/icons. The application source contains no runtime Tailwind compiler.
- Deleting the output and rebuilding twice matched byte for byte. A fresh
  `npm ci --ignore-scripts` followed by `npm run build:css` also matched.
  Generated size: **24,251 bytes**, **5,494 bytes gzip** (`gzip -nc`).
  SHA-256: `52a570918723e48b1a3aa717991e677ee13ee60807c9a2d540c1834e3f7b012c`.
- JavaScript syntax checks and `git diff --check` pass. `npm test` succeeds but
  explicitly prints “No tests specified”; the browser suites are the useful tests.

The extended admin check initially sampled a 150ms CSS transition immediately
after clicking. Waiting 200ms for the existing transition resolved the assertion;
no application change was required.

### Reproduce browser checks

```sh
npm install --prefix /tmp/hallmark --no-save puppeteer-core lucide@0.468.0 dompurify@3.0.5 chart.js @fontsource/inter @fontsource/archivo-black
python3 -m http.server 8085
# From another terminal, in the repository:
MADNESS_SCREENSHOTS="$PWD/docs/static-tailwind/screenshots" node scripts/verify-member.cjs --seasonal --shell
MADNESS_SCREENSHOTS="$PWD/docs/static-tailwind/screenshots" node scripts/verify-admin.cjs
```

`MADNESS_TEST_TOOLS` can override `/tmp/hallmark/node_modules`. Chromium is expected
at `/usr/bin/chromium`. Checks fetch the real generated CSS through the local
server; they do not inject `/tmp/madness-tailwind.css`.

### Baseline and limitations

Before captures use **current main dfd478e**, not the old redesign base. The live
Tailwind CDN returned HTTP 403 in this environment. Before screenshots therefore
substitute a frozen v3.4.17 CLI stylesheet at the original CDN tag position in the
intercepted main HTML. They are a controlled v3 baseline, **not evidence of a
successful live CDN render**. Baseline generation used the same utility inventory
and targeted toast safelist described above. To repeat that comparison:

```sh
cp styles/tailwind.css /tmp/static-tailwind-baseline.css
MADNESS_SCREENSHOTS="$PWD/docs/static-tailwind/screenshots" node scripts/verify-member.cjs --before
MADNESS_SCREENSHOTS="$PWD/docs/static-tailwind/screenshots" node scripts/verify-admin.cjs --before
```

`MADNESS_BEFORE_REF` can override the pinned main commit. Before mode only captures
representative screens; after mode runs assertions. The member login, agenda,
history, profile, class details and admin login pairs have zero changed pixels.
The admin full-page pairs differ in the live current-time indicator (captures were
several minutes apart); visual inspection shows the same layout and styling.

All tests are **Linux Chromium emulation**, not physical iOS Safari or Android
Chrome. Actual notches, keyboard, installed-PWA compositor, authenticated Firebase
integration, push delivery and production data remain outside these isolated
checks. No production records were read or modified by the browser fixtures.
