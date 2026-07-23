# Web polish: accessibility, small screens, social sharing

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium
**Created:** 2026-07-18 08:23 IST
**Completed:** 2026-07-19 15:57 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Production means no sharp edges for anyone: keyboard players, screen
readers, phone browsers, and people pasting game links into chat apps.
One deliberate pass with taste, not a checkbox exercise.

## Scope

- [x] **Keyboard play**: board cells focusable, Enter places, visible
      focus ring in accent green. (Landed in the mega build.)
- [x] **Screen readers**: aria-labels for cells, status live regions,
      labelled avatars/icons/landmarks; form labels now programmatically
      associated via htmlFor/id - this was the last failing Lighthouse
      audit.
- [x] **Reduced motion**: `prefers-reduced-motion` disables blink/pulse
      animations and scanlines. (Landed in the mega build.)
- [x] **Small screens**: game-first single-column ordering; board cells
      sized `min(calc((100vw - 64px)/n), calc(620px/n))` so 12x12 fits a
      360px phone; share popover fits.
- [x] **Social unfurls**: OG + Twitter meta with a dark 1200x630
      `public/og.png` rendered from the logo art (copied into `dist/` by
      the build script - bare meta URLs are not bundler imports, so the
      bundler alone would drop it); per-route `document.title` in
      `App.tsx`.
- [x] **Copy pass**: form labels and buttons lowercased to the terminal
      voice ("game name", "board size", "start game"), placeholder copy
      tightened; full JSX string sweep found no typos.
- [x] Verify: Lighthouse on the deployed dev URL - **accessibility 100**,
      performance 95-97, best-practices 100. (SEO 63 is Vercel's automatic
      noindex on non-production environments - correct for dev, resolves
      at production cutover. The bfcache warning is inherent to a live
      websocket app.) A human VoiceOver walkthrough on a real device
      remains a nice-to-have beyond this.

## Open Questions

- Static OG image vs per-game dynamic (needs a function)? Went static;
  dynamic unfurls stay a future idea.

## Files Likely To Change

`web/index.html`, `web/src/features/**`, `web/src/styles/app.css`,
`web/public/og.png`, `web/package.json` (build copies og.png),
`web/src/app/App.tsx` (titles).

## Recovery Hints

Run Lighthouse on the deployed dev URL; the a11y score tells you how much
of this landed.

## Checkpoints

- 2026-07-18 08:23 IST - Task created.
- 2026-07-19 15:45 IST - Board cell sizing for 12x12 at 360px; per-route
  document.title; og.png (1200x630 from the logo art) + og:image/twitter
  meta wired; build script copies og.png into dist.
- 2026-07-19 15:52 IST - Copy pass: labels/buttons lowercased to the
  terminal voice; htmlFor/id label association fixed the one failing
  Lighthouse a11y audit.
- 2026-07-19 15:57 IST - Verified on deployed dev: Lighthouse
  accessibility 100, performance 95-97, best-practices 100. Completed.
