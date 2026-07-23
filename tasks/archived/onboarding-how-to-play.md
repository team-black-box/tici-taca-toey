# Onboarding: a first run that teaches the game

**Status:** Completed
**Owner:** unassigned
**Estimated effort:** Small-medium
**Created:** 2026-07-18 08:23 IST
**Completed:**
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

This is meant to be a delightful, *learning* app. A first-time visitor
currently lands on `$ no game selected` with no guidance. Give them a
gorgeous terminal-style introduction that teaches the game in under a
minute and gets them into their first match against a robot in one click.

## Design Decisions (proposed; settle at pickup)

- Replace the empty stage with a `> welcome` panel when the player has no
  games: three short lines (what it is, that boards go 2-12 with custom win
  lengths, that robots are waiting), then two big actions:
  `[ play a robot now ]` (starts a 3x3 game + REQUEST_ROBOT in one go) and
  `[ start a custom game ]` (focuses the start panel).
- A persistent `> help` entry (header or footer) opening a compact overlay:
  rules, timers, spectating, multi-game, share links, and a pointer to the
  robot SDK ("write your own robot in ~10 lines") - the learning-playground
  on-ramp. Terminal styling, keyboard `?` shortcut, Esc to close.
- First-visit hint on the handle field ("pick a handle - your avatar grows
  from it") that never returns after a handle exists (localStorage flag).
- Copy is part of the personality: lowercase, playful, precise. No modal
  walls, nothing blocking - the board is always one keypress away.

## Scope

- [x] Welcome panel with one-click robot game (start + request robot).
- [x] Help overlay + `?` shortcut, content written with care.
- [x] First-visit handle hint.
- [x] Mobile: same content as a `help` entry on the play tab.
- [x] SDK pointer links to `sdk/README.md` on GitHub (until a docs page
      exists).

## Open Questions

- Should the one-click robot game prefer minnie-max (teachable perfect
  play) or rando (winnable, kinder first experience)? Lean rando; decide at
  pickup.

## Files Likely To Change

`web/src/features/game/Game.tsx` (empty state), new
`web/src/features/help/`, `web/src/app/App.tsx`, `web/src/styles/app.css`,
`mobile/src/screens/LobbyScreen.tsx`.

## Recovery Hints

If `stage-empty` still renders bare text, nothing landed yet.

## Checkpoints

- 2026-07-18 08:23 IST - Task created.

- 2026-07-18 18:51 IST - welcome + help + one-click robot shipped; verified end-to-end on the deployed dev environment. Completed.
- 2026-07-19 09:53 IST - mobile welcome + help/sync modal shipped.
