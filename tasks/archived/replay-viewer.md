# Replay viewer: step through any TTN line

**Status:** Completed
**Owner:** unassigned
**Estimated effort:** Medium
**Created:** 2026-07-18 08:23 IST
**Completed:**
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Every finished game already carries a lossless TTN line. Turn that into a
learning tool: a replay viewer that plays any game back move by move -
review your own games, study a robot's play, share a great finish as a
short string. This is the client half of the replays pillar; it needs no
backend (the leaderboards task later adds fetch-by-id).

## Design Decisions (proposed; settle at pickup)

- Port TTN `decodeGame` from `server/src/notation.ts` to
  `web/src/common/ttn.ts` (kept in sync the way model.ts is; add web tests
  reusing the server test vectors).
- Entry points: a `replay` action on completed game tiles (uses the
  in-store notation), and a `> replay` panel in the sidebar that accepts a
  pasted TTN line.
- Viewer: the standard board rendered read-only with transport controls -
  `|< < play > >|`, move counter `14/23`, autoplay ~1 move/s, arrow-key
  stepping, the winning sequence glowing on the final frame. Seat colors
  and symbols exactly as live games.
- Route `/replay/<ttn>` (TTN is URL-safe) so a replay is a shareable link -
  delightful and zero-backend.
- Mobile: same viewer on the game screen for completed games.

## Scope

- [x] `web/src/common/ttn.ts` decoder + tests (server vectors).
- [x] Replay state machine (frame index from moves; derived positions).
- [x] Viewer UI + transport controls + keyboard; route `/replay/<ttn>`.
- [x] Entry points: completed-game tiles, paste panel, GAME_COMPLETE view.
- [x] Mobile viewer (shared frame logic in `mobile/src`).

## Open Questions

- Autoplay speed control (0.5x/1x/2x)? Cheap; decide at pickup.

## Files Likely To Change

`web/src/common/ttn.ts` (new), `web/src/features/replay/` (new),
`web/src/common/router.ts` (route), web tests, mobile screens.

## Recovery Hints

If `web/src/common/ttn.ts` exists but no viewer route, only the decoder
landed.

## Checkpoints

- 2026-07-18 08:23 IST - Task created.

- 2026-07-18 18:51 IST - viewer + /replay route + tile entry shipped; verified end-to-end on the deployed dev environment. Completed.
- 2026-07-19 09:53 IST - mobile replay stepper shipped (ttn.ts port + frame stepper on completed games).
