<!-- docs/redesign/cempasuchil.md -->
<!-- Records feature-branch integration, design verification and the deployment hold. -->
<!-- Keeps the combined work reviewable before any production publishing. -->
<!-- RELEVANT FILES: index.html, styles/cempasuchil.css, scripts/verify-member.cjs, README.md -->
# Cempasúchil integration

Integrated all 11 commits from `codex/cempasuchil-class-screen` through
`eab231977cf717897c3a6b63eccf06d4d4b81503` into `redesign/madness-mobile-pwa`.
The integration is a merge preserving the original commit ancestry.
The working tree was clean before integration. `main` was not changed.

## What carries over

- Original transparent cempasúchil image, docked above navigation behind the
  Agenda cards. The image remains unchanged from the source branch.
- Orange accent colors, square bottom navigation and Agenda selection while
  viewing class details. Shared tokens keep member and admin controls consistent.
- Photo-led class screen, time/date badges, instructor, duration, occupancy and
  an accessible booking action. Existing class data and state/permission rules
  continue to determine the actions, including payment blocks and waitlist holds.
- Occupancy uses a native meter with clamped display values. Undefined capacity
  displays its existing message, without an invalid zero-range progress control.

## Design improvements applied

The incoming inline styles were moved into `styles/cempasuchil.css`, using the
shared palette, spacing and font tokens. Gradients/glows on controls, tracked
capital labels, animated width changes and viewport-wide artwork overflow were
removed. The source photo layout and floral material remain.

Class details have separate toolbar, scrollable content, feedback and action
areas. The back control stays reachable without covering scrolled text. Status
messages occupy their own row instead of covering the booking action. Short
landscape screens, long names and payment notices can scroll within the content
pane. Input, modal, zoom, safe-area and reduced-motion improvements remain.

No routes, server callables, Firebase rules, schemas, data records, service-worker
behavior, manifest identity, CNAME or deployment settings were changed.
No new runtime dependency was added.

## Evidence and checks

[Incoming class screen](screenshots/incoming-cempasuchil-classDetails.png) ·
[Integrated class screen](screenshots/after-classDetails.png) ·
[Integrated Agenda](screenshots/after-agenda.png) ·
[Comparison](compare.html) · [Recorded checks](cempasuchil-checks.txt)

Chromium on Linux with isolated in-memory fixtures and all external requests
intercepted. No production reads/writes or real account login. This is not
physical iOS/Android verification.

The existing member/admin checks pass. Additional class-detail tests exercise
nine states at 320×568, 390×844, 844×390, 768×1024 and 1280×800:
available, booked, full, waiting, own hold, another member's hold, unpaid,
unknown capacity and long content. All 45 cases have no page overflow, a visible
44px-or-larger action, and the correct active navigation. They test the UI against
stubs, not Firebase enforcement. Reproduce with:

```sh
# Use the temporary tools/server setup in README.md first.
node scripts/verify-member.cjs --seasonal
node scripts/verify-admin.cjs
```

Hallmark source comparison retains 118/118 existing script hooks and reports zero
failures. Render checks report zero failures and zero warnings, with the two
existing documented calendar waivers. Fresh Hallmark finish review: ship; both
original overlap findings resolved. Syntax and whitespace checks pass.
`npm test` is still a placeholder. `npm run build` still requires the missing
Firebase environment variables and exits before writing files.

Physical-device installation, keyboard/notch behavior, push delivery and real
Firebase account verification remain as documented in the original handoff.

## Pages publication authorized

A fresh deployment-history inspection found a successful **pages build and
deployment** run for `redesign/madness-mobile-pwa` at commit
`81304294d6d68e04497a8d2d50723361b9fa52b0`, created 2026-10-24 09:04:29 UTC:

https://github.com/erickosanchezj/madness-schedule/actions/runs/40080510669

Its `deploy` job completed **Deploy to GitHub Pages** successfully. This is a
GitHub-generated `dynamic` Pages workflow; there is still no tracked workflow
file in the repository. The Pages settings endpoint remains forbidden, so the
saved folder/source cannot be read directly, but successful deployment history
shows that this branch is being used to publish Pages.

The owner confirmed that Pages is intentionally publishing this branch and
explicitly authorized proceeding after the deployment trigger was explained.
The combined integration can therefore be pushed to this same branch. No Pages,
domain, Firebase or workflow settings were changed. Before integration the remote
branch was at `81304294d6d68e04497a8d2d50723361b9fa52b0`.
