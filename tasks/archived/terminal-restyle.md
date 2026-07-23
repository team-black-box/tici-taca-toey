# Terminal / matrix restyle of the web app

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Medium - touches every component's classes, one new stylesheet
**Created:** 2026-06-10 13:36 IST
**Completed:** 2026-06-11 04:58 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Retire the 2020 nostalgia look. Make the app modern and hacker-like: matrix /
terminal vibes, dark mode first, raw vanilla CSS, no webfonts, no Tailwind.
Fast: one small stylesheet, system monospace fonts, zero font/CSS network
fetches.

## Design Decisions

- One stylesheet `web/src/styles/app.css` built on CSS custom properties.
- Dark is the default (`color-scheme: dark`); light mode supported via
  `@media (prefers-color-scheme: light)` as a "paper terminal" theme.
- Palette: near-black green-tinted background, phosphor-green foreground
  (#00ff66 family accents), neon player colors as `sym-0..sym-9` classes.
- Typography: system monospace stack (ui-monospace, SFMono-Regular, Menlo,
  Consolas, monospace). The Google Fonts Comfortaa import is removed.
- Components swap Tailwind utility soup for semantic classes (panel, btn,
  board, cell, tile, badge, clock...). Markup structure stays the same.
- Tasteful terminal effects: blinking cursor on the brand, soft text glow on
  accents, glowing win cells. No heavy animations.
- The QR code keeps a white quiet zone (scanners need contrast).
- `web/src/styles/tailwind.css` is deleted; `symbol.ts` returns CSS classes
  instead of Tailwind color names; `status.ts` returns badge classes.
- ASCII server banner and "Made with ♥ in Bengaluru, India" stay - the
  personality moves to terminal-chic, it does not disappear.

## Scope

- [x] Write `app.css` with variables, dark/light themes, all component styles.
- [x] Rewrite className usage across all components in `web/src/features/`,
      `app/App.tsx`, `symbol.ts`, `status.ts`.
- [x] Delete vendored Tailwind CSS and the font import; update `index.css`
      usage (fold into app.css).
- [x] Update `web/claude.md` styling section and root `claude.md` personality
      section for the new direction.
- [x] Verify visually in the browser (dark + light) and rerun typecheck/build.

## Open Questions

- Keep identicons? Resolved: yes - pixelated avatars fit the terminal vibe.

## Files Likely To Change

`web/src/styles/app.css` (new), `web/src/styles/tailwind.css` (deleted),
`web/src/index.css` (deleted), all `web/src/features/**/*.tsx`,
`web/src/app/App.tsx`, `web/src/common/{symbol,status}.ts`,
`web/src/index.tsx`, `web/claude.md`, `claude.md`.

## Recovery Hints

If classes look half-migrated, grep for `text-` / `bg-` / `grid-cols` Tailwind
patterns in `web/src` - none should remain. The app must build with only
`app.css`.

## Checkpoints

- 2026-06-10 13:36 IST - Task created with design decisions.
- 2026-06-10 18:00 IST - app.css written (CSS vars, dark/light, ~8 KB); all
  components migrated to semantic classes; symbol.ts/status.ts now map to
  CSS classes; tailwind.css + index.css + Google Fonts removed.
- 2026-06-11 04:58 IST - Verified in the browser in both color schemes (screenshots taken
  during a live game), typecheck + build green. Docs updated. Completed.
