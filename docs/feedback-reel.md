<!-- docs/feedback-reel.md -->
<!-- Explains the global admin switch for the five-second feedback reel. -->
<!-- Documents activation requirements without changing the live database. -->
<!-- RELEVANT FILES: admin.html, scripts/admin/feedback-reel.js, scripts/member/feedback.js, firestore.rules -->

# Feedback reel switch

Open **Reel** in the admin navigation and change **Mostrar reel al abrir la app**. Changes save automatically for all members. The small form banner remains visible when the reel is disabled. Turning the switch off also closes an open reel on connected member apps.

The boolean setting is stored at `appSettings/feedbackReel`, in the `enabled` field. If the document does not exist, the reel retains its previous enabled behavior. No manual document creation or migration is needed: the first admin change creates it.

## Release requirement

The owner must publish the updated `firestore.rules` together with the frontend release. Those rules allow signed-in members to read this one setting and only admins to save a boolean value. Other `appSettings` documents remain inaccessible.

Until the rules are published, the switch reports a loading error and cannot be changed. The member app suppresses the reel when settings cannot be read. On a fresh app load it waits for server-confirmed settings rather than displaying a potentially stale cached value. The form banner still works.

No live settings have been created or changed during implementation. Validation uses in-memory Firebase fakes.

## Checks

- `npm test` includes settings synchronization, stale-cache suppression, five-second playback, failed-save rollback, sign-out cleanup, and requests completing after logout.
- Chromium verification with simulated Firebase checks actual admin initialization, switch changes, failed saves, remote updates, logout and layouts at 320px, 390px and 1280px.
