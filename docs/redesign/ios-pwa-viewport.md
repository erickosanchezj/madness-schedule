<!-- docs/redesign/ios-pwa-viewport.md -->
<!-- Records the installed-iPhone viewport workaround and its limits. -->
<!-- Prevents repeating CSS-only fixes for a native WebKit clipping issue. -->
<!-- RELEVANT FILES: index.html, styles/member-shell.css, scripts/member/viewport.js, scripts/verify-member.cjs -->
# Installed iPhone viewport

The reported device is an iPhone 17 Pro running iOS 27. Its screenshots show an
extra strip below the navigation, separate from the home-indicator padding.
WebKit reports describe matching 62px viewport loss and fixed-root clipping.
CSS coordinates in Chromium cannot verify Safari's native paintable rectangle.

The member app now removes the deprecated `black-translucent` status-bar setting.
The initial member HTML omits `viewport-fit=cover`, allowing native status-bar
insetting from launch. The root stays in normal document flow;
content scrolls within the flex shell, with overscroll contained.

Native inset mode may return zero safe-area values. Installed iPhones with an
elongated display use a home-indicator padding fallback (34px portrait, 21px
landscape), combined with `env()` through `max()`. Home-button screens receive no
fallback. This display-ratio check is a device heuristic, not an Apple API.
Only installed iPhones receive the fallback; browser tabs and iPads use native insets.

## Evidence

- [WebKit: 62px orphan strip](https://bugs.webkit.org/show_bug.cgi?id=313800).
- [WebKit: fixed roots and cover-mode gaps](https://bugs.webkit.org/show_bug.cgi?id=237961).
- [WebKit engineer: remove the deprecated status-bar key](https://bugs.webkit.org/show_bug.cgi?id=317153#c2).
- [Firsthand implementation: native inset mode on an affected PWA](https://github.com/mdennis281/dispatch/blob/main/docs/ios-pwa-viewport-findings.md).

## Validation

Run `npm test` and the existing fixture browser runner with `--shell --seasonal`.
Add `--ios-standalone` to exercise the bootstrap, portrait/landscape padding and
scrolling in Chromium. It does not emulate iOS's native standalone window.

Physical-device checks remain: cold launch, all member screens, scrolling to both
ends, rotating, opening/closing the name dialog and backgrounding/reopening.
Fully close the installed app after updating. Some iOS releases cache install-time
status-bar settings; a freshly added Home Screen shortcut may be needed to compare
native window configuration. Re-adding can require signing in again.
