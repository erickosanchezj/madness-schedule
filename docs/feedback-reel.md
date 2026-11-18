<!-- docs/feedback-reel.md -->
<!-- Explains the reels shown when members open the app: the on/off switch and the reel editor. -->
<!-- Documents what staff can edit, how members see it and what the owner must deploy. -->
<!-- RELEVANT FILES: scripts/admin/reels.js, scripts/member/feedback.js, scripts/reel-template.js, firestore.rules -->

# Reels

Open **Avisos → Reels** in the admin.

**Mostrar reels al abrir la app** is the master switch. Off means members never see a reel. It is stored at `appSettings/feedbackReel` (`enabled`). The small form banner above the menu always stays visible.

## Editing reels

Each reel is a document in the `reels` collection. Staff can create, edit, duplicate, activate or deactivate, reorder (↑ ↓) and delete reels. The editor shows a live phone preview built with the same template and styles as the member app (`scripts/reel-template.js`, `styles/member-feedback.css`).

Editable fields: top label, title (line breaks allowed), pink part of the title, description, button text, button link (`https://` only; empty hides the button), text under the button, and duration (3–15 seconds). "Nuevo reel" starts from the original reel's text.

## What members see

Active reels play one after another, in the list order, like stories: one segment per reel at the top. Each reel lasts its own seconds. Tapping the left 30% of the screen goes back; tapping anywhere else goes forward; after the last reel the story closes. Pause and close work as before.

If no reel is active, or reels cannot be read, the original reel is shown. The member app waits for both the switch and the reels before opening, so the original reel never flashes first. An open story keeps its reels until it closes.

## Release requirement

The owner must deploy `firestore.rules`. They let signed-in members read `reels` and only admins write them, with a fixed set of fields and size limits. Until the rules are deployed, the editor cannot save and members keep seeing the original reel.

## Checks

`npm test` (`scripts/feedback-reel.test.cjs`) covers the switch, the reel sequence and order, per-reel seconds, taps, waiting for reels, escaping editor text and fallbacks. Validation uses in-memory Firebase fakes.
