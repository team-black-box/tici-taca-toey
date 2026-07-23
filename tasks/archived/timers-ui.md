# Chess-clock timers in the web UI

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Small-medium - server support already exists
**Created:** 2026-06-10 13:36 IST
**Completed:** 2026-06-11 04:58 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Expose the server's opt-in chess clocks in the web app: create timed games,
see live per-player clocks, and lose on timeout.

## Design Decisions

- Start form gains a "Timed game" toggle; when on, a time-per-player picker
  (1/3/5/10 minutes) and increment picker (0/1/2/5 seconds). Untimed remains
  the default.
- `START_GAME` carries `timePerPlayer` / `incrementPerPlayer` in ms when
  timed (protocol already supports this; web model already has the fields).
- Clocks render inside each player card from `game.timers[playerId]`
  (`timeLeft`, `isRunning`), formatted `m:ss`. Server pushes `NOTIFY_TIME`
  about 1/s; the games reducer already stores those updates.
- Between server updates the running clock also ticks locally (250ms
  interval while `isRunning`) so it looks alive; server values are the truth
  and snap it back on every update.
- `GAME_WON_BY_TIMEOUT` already has a status badge.

## Scope

- [x] Start form: timed toggle + pickers, ms conversion, action plumbing.
- [x] Clock component in the player card with local ticking.
- [x] Verify a timed game end-to-end: clocks tick, increment applies, timeout
      ends the game with the right badge.

## Open Questions

(none)

## Files Likely To Change

`web/src/features/start/Start.tsx`, `web/src/state/actions.ts`,
`web/src/common/model.ts`, `web/src/features/game/players/ActivePlayer.tsx`,
`web/src/styles/app.css`.

## Recovery Hints

The server side is already complete (`server/src/timer.ts`, opt-in via
`timePerPlayer`). Only the client needs work. Test with a 5s clock via a raw
websocket client if the UI looks wrong.

## Checkpoints

- 2026-06-10 13:36 IST - Task created.
- 2026-06-10 18:10 IST - Start form timed toggle + pickers; Clock component
  with local 250ms ticking; actions/model carry timePerPlayer/increment.
- 2026-06-11 04:58 IST - Verified live: clocks tick down on turn, +1s increment visible on
  the robot's clock after each move (3:00 -> 3:03 after 3 moves), low-time
  blink styled, GAME_WON_BY_TIMEOUT badge in place. Completed.
