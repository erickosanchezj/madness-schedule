<!-- docs/redesign/pwa-shell-fix.md -->
<!-- Explains the installed-PWA navigation and artwork-layer correction. -->
<!-- Records verification and the remaining physical iPhone check. -->
<!-- RELEVANT FILES: index.html, styles/cempasuchil.css, styles/app.css, scripts/verify-member.cjs -->
# Installed PWA shell correction

The reported iPhone launch showed a gap below navigation, then changed navigation
and flower placement after dragging. The old shell independently fixed navigation
to the viewport and fixed artwork from within the scrolling Agenda stacking
context. Root page scrolling was also possible. These arrangements are fragile
under Safari viewport resizing and rubber-band compositing.

The member body now owns the dynamic viewport as a flex column. The app uses its
remaining space, including when connection guidance appears. Navigation occupies
its own non-scrolling bottom row; its background includes the home-indicator safe
area exactly once. The content stage has a shrinking scroll area and a separate,
absolute floral background sibling beneath it. Flowers are no longer inside the
scrolling screen or fixed independently to the viewport. History/profile/details
hide that decorative layer. Class-details sizing follows its actual remaining
content area. Authentication remains independently scrollable.

Member stylesheet links and the imported tokens have versioned URLs. Source
tokens are orange; the green controls in the report suggest older cached styles,
although that phone's cache was not accessible for inspection. A fresh page load
can retrieve matching current styles without clearing data. No worker cache,
Firebase, manifest identity, deployment settings or data was changed, and no
reload is forced on active forms. Hidden toasts no longer intercept taps.

The isolated member checks pass, including the existing 45 class-state cases.
Targeted checks simulate top/bottom safe areas of 47px/34px at 390×844, 390×720,
back to 390×844, 844×390 and 320×568. At scroll offsets 0/1000/0 and resume events,
they assert no gap below navigation, no gap between content and navigation,
flowers aligned with that boundary, root scroll at zero, correct safe-area
navigation height and current orange tokens. A paint-order probe temporarily
enables pointer hit testing on the decorative layer and asserts that a class
card stays above it. Normal pointer events on flowers remain off.

```sh
# Use the temporary tools/server setup described in README.md first.
node scripts/verify-member.cjs --seasonal --shell
```

These are Chromium geometry/scroll checks on Linux, not physical iOS/Safari
verification. Safari's actual rubber-band compositor is not reproduced by these
assertions. Recheck launch and downward dragging on the reported iPhone after
loading the update. Finish drafts, fully quit and reopen the PWA; there is no need
to reinstall or clear site data.
