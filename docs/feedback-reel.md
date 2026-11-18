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

Layout choices (fixed values, so every phone looks right):

- **Alignment:** left or centered.
- **Text position:** top, middle or bottom. The button always stays at the bottom.
- **Title size:** S, M or L. It follows the phone width.
- **Logo:** on or off.
- **Background:** texture (the original), pink arcs, plain, or a class photo (TRX, Yoga, HIIT, Funcional, Capoeira). Photos get a dark veil so the text stays readable.
- **Frequency:** 3 times a day (default), once a day, only once, or every time the app opens.

Reels saved before these choices existed keep the original look and show up to 3 times a day.

The preview has three phone sizes (Chico 320×568, Mediano 360×640, Grande 390×844). "Chico" also applies the short-screen rules. **Reproducir activos** plays the saved active reels in order, each for its seconds; editing the form stops it.

## What members see

Active reels play one after another, in the list order, like stories: one segment per reel at the top. Each reel lasts its own seconds. Tapping the left 30% of the screen goes back; tapping anywhere else goes forward; after the last reel the story closes. Pause and close work as before.

Frequency is counted on each phone (`localStorage` key `madnessReelViews`), per reel and per Mexico City day. A reel counts once per story, even if the member taps back to it. "Only once" means the first time that phone sees it; to show it again, duplicate the reel (a copy is a new reel). Reels the member may not see right now are skipped; if none are left, no story opens.

Only active reels are shown. If no reel is active, or reels cannot be read, members see no story, even with the switch on. The original reel's text is only a starting point for "Nuevo reel". The member app waits for both the switch and the reels before opening. An open story keeps its reels until it closes.

## Release requirement

The owner must deploy `firestore.rules`. They let signed-in members read `reels` and only admins write them, with a fixed set of fields and size limits. The layout fields (`align`, `position`, `size`, `logo`, `background`, `frequency`) are optional and only accept the listed values; until the new rules are deployed, saving a reel from the new editor fails. Until the rules are deployed, the editor cannot save and members see no reel.

## Checks

`npm test` (`scripts/feedback-reel.test.cjs`) covers the switch, the reel sequence and order, per-reel seconds, taps, waiting for reels, escaping editor text, showing nothing when no reel is active or reels cannot be read, layout classes and defaults, and each frequency. Validation uses in-memory Firebase fakes.
