# Terminal feedback: surface every error and event beautifully

**Status:** Completed
**Owner:** unassigned
**Estimated effort:** Small-medium
**Created:** 2026-07-18 08:23 IST
**Completed:**
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Remove the app's sharpest edge: silence. Today server errors
(`NO_ROBOT_AVAILABLE`, `GAME_NOT_FOUND`, `GAME_ALREADY_IN_PROGRESS`, ...)
and connection events go to `console.warn` - a player who presses
"+ robot" with no robots online gets nothing. A delightful production app
narrates itself.

## Design Decisions (proposed; settle at pickup)

- A terminal **status line**: a one-line feed above the footer (and/or a
  short-lived toast stack in the top right) that prints events in shell
  style: `! no robot available - start one or invite a friend`,
  `✓ link copied`, `~ reconnected, resuming 2 games`, `! game not found`.
- Error strings live in one map keyed by `ErrorCodes` with friendly,
  personality-correct copy (lowercase terminal voice, playful but clear).
  Unknown codes fall back to the raw code - never silence.
- Auto-dismiss after ~5s, hover to pin, `prefers-reduced-motion` respected.
- The store already sees every `{ type: "ERROR" }` response in one place
  (`store.ts` onMessage) - reduce them into a small `feedback` slice
  instead of console.warn. Same for connect/disconnect/resume transitions.
- Mobile gets the equivalent as a slim banner under the header; same copy
  map ported to `mobile/src/theme.ts`.

## Scope

(Observed live on the Vercel dev deployment, 2026-07-18: after an instance
recycle the client can keep rendering a game the server no longer knows -
a resume that comes back with no GAME_RESUMED for a game in `playing`
should mark it abandoned client-side and say so in the status line.)

- [x] `feedback` slice + reducer, event copy map, wiring in store onMessage.
- [x] Status line / toast component styled in app.css (glow, badge colors).
- [x] Emit for: all server errors, connect/disconnect/resume, link copied,
      robot seated, game complete (win/lose/draw from viewer perspective).
- [x] Mobile banner with the same copy map.
- [x] Tests for the copy map (every ErrorCode has copy) and reducer.

## Open Questions

- Sounds (tiny terminal beep on your-turn, muted by default)? Decide at
  pickup; belongs with this task if yes.

## Files Likely To Change

`web/src/state/{feedback.ts,store.ts}`, `web/src/features/**`,
`web/src/styles/app.css`, `web/src/common/model.ts` (ErrorCodes sync),
`mobile/src/state.ts`, `mobile/App.tsx`/screens, tests.

## Recovery Hints

Grep for `console.warn("Server reported an error"` - if it still exists,
the task has not landed.

## Checkpoints

- 2026-07-18 08:23 IST - Task created.

- 2026-07-18 18:51 IST - status feed + ghost purge shipped; verified end-to-end on the deployed dev environment. Completed.
