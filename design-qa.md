<!-- /design-qa.md -->
<!-- Records the visual and interaction checks for the community announcement. -->
<!-- Documents the mockup comparison and limits of the local fixture. -->
<!-- RELEVANT FILES: index.html, scripts/member/feedback.js, styles/member-feedback.css -->

# Community feedback announcement QA

final result: passed

## Evidence

- Source story: /workspace/generated_images/exec-69fc4fff-a72a-43fb-8636-fa71f14be2ad.png
- Source banner: /workspace/generated_images/exec-91d7fec7-a125-43d4-ada4-f7668fb04f07.png
- Chromium captures: /tmp/madness-story-390.png and /tmp/madness-banner-390.png
- Combined comparisons (source left, implementation right): /tmp/madness-compare-story.png and /tmp/madness-compare-banner.png
- Source images: 852 × 1846 pixels, normalized to the 390 × 844 CSS viewport. Implementation: 390 × 844 pixels, device scale factor 1.
- Additional captures: /tmp/madness-story-320.png, /tmp/madness-banner-320.png, /tmp/madness-story-844.png, /tmp/madness-banner-844.png, /tmp/madness-story-1280.png, /tmp/madness-banner-1280.png.
- States: open announcement and closed announcement with agenda visible. Local fixture uses the actual HTML, CSS, component script and agenda renderer with simulated member/class data. Firebase and live sign-in were not exercised.

## Findings and iteration history

- Resolved P2: fallback heading was too light and its wrapping changed the mockup hierarchy. Added a bold fallback and explicit headline break on tall screens. Compared the updated Chromium capture with the source in /tmp/madness-compare-story.png.
- Resolved P2: evenly distributed vertical gaps placed the logo and headline too low. Replaced those gaps with explicit logo spacing and flexible space before the action and pause control. Final comparison confirms the logo, eyebrow and headline hierarchy.
- Resolved P2: the small external-link text glyph rendered incorrectly. Replaced it with the same Lucide arrow icon used by the story. Final banner capture confirms the icon renders.
- No outstanding P0/P1/P2 findings in the new components. The existing agenda layout, class status colors, background logo and class cards were preserved; this change does not redesign those regions to match generated mock data.

## Fidelity surfaces

- Typography: existing Archivo Black / Inter font tokens retained. Google Fonts requests are blocked in this environment; browser evidence verifies the bold system fallback. Exact remote-font rendering remains unverified.
- Layout: banner occupies its own 58px row immediately above navigation. All three navigation controls remain visible at 320 × 568, 390 × 844, 844 × 390 and 1280 × 800. Short story viewports scroll to keep all controls reachable.
- Color: existing pink and green theme retained. Story CTA uses dark text on pink for readable contrast; this deliberately differs from the white-on-pink generated mockup.
- Assets: original logo, texture, green light and pink arcs reused without rasterized UI. Existing Lucide library provides icons.
- Content: Spanish mockup copy retained. Duration changed from 10 to 5 seconds as requested; both links use the supplied Google Form. Pause is an explicit accessible button.
- Full-view comparisons also show readable button labels, link icon and banner placement; separate focused crops were unnecessary at the normalized size.

## Validation

- Chromium fixture passed: visible before five seconds, closes after five seconds, pause/resume, keyboard pause, Escape, reopening on app resume, returning from the form without replay, no announcement while signed out, identical form destinations, banner placement and viewport fit.
- No uncaught browser JavaScript errors in the fixture. External Google Fonts availability is excluded from that result.
- Existing `npm test`: four test files passed. JavaScript syntax and `git diff --check` passed.
- No database access, deployment or GitHub push performed.
