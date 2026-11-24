# Live cursors on the board

**Status:** Completed
**Owner:** Claude
**Estimated effort:** ~1.5 days
**Created:** 2026-07-24 18:38 IST
**Completed:** 2026-07-24 19:05 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Show the other people in a game as floating ghost symbols (X, O, Y...)
hovering over the cell they are considering, so a game feels inhabited
rather than turn-by-turn silent. Cursors are **presence**, never game
state: they never touch `Game`, the TTN line, or the archive.

## Decisions (from the user, 2026-07-24)

- **Mobile is receive-only** for now. Touch has no hover; the phone shows
  everyone else's cursors and sends none.
- **Teammates and spectators always see cursors.** Teammates get free
  coordination; spectators get a much better watch.
- **Opponents see them only when the host ticks "show cursors" at game
  start**, and the game must visibly say so while it is on. Telegraphing
  a move you do not intend is a bluff, and bluffing is a feature.
- You never need the server to draw *your own* ghost - the client knows
  its own pointer. The server only ever sends other people's.

## Design

Cell coordinates, not pixels. A ghost that snaps cell to cell is bounded
by how fast a hand crosses a grid (a few changes per second, zero when
still), matches the terminal identity, and costs a fraction of a
pixel-smooth pointer.

Server coalesces, exactly like the timer does: a per-game
`Map<seat, {x,y}>` held **outside** `Game`, flushed on a ~100ms interval
as one message per audience. That turns P broadcasts into one per tick,
independent of player count.

Audiences per game (at most `teamCount + 1` distinct payloads):
- spectators: every cursor
- `showCursors` on: every cursor, to everyone
- `showCursors` off + teams: each player sees only their own team
- `showCursors` off + no teams: players see nothing (spectators still do)

Wire:

```
client -> { type: "CURSOR", gameId, x, y }        // -1,-1 = left the board
server -> { type: "CURSORS", gameId, cursors: [[seat, x, y], ...] }
```

Keyed by **seat**, not playerId: seat is all a client needs to pick the
symbol and neon, and it does not widen playerId exposure.

## Constraints found in the analysis pass

- **Rate limiter**: the main bucket is capacity 40, refill 15/s
  (`server.ts`). A cursor stream would starve moves and the LIST_GAMES
  poll, then close the socket on strikes. Cursors get their **own**
  smaller bucket and never consume the main one.
- **Store re-renders**: `reduce()` in `web/src/state/store.ts` runs six
  reducers and notifies every listener. Cursors must never enter the
  store - they ride a side channel out of `socket.ts`, like the particle
  field lives outside React.
- **Fan-out**: 10 players + 15 spectators means every raw cursor message
  would go to 24 others. Coalescing is what makes this affordable.
- **Sweep is immune already**: idle is measured from `turnStartedAt`, not
  last message, so cursor traffic cannot keep a dead game alive.
- Per-message engine work must stay O(the game's own seats); the flush is
  a periodic path and iterates only games with live cursors.

## Scope

- [x] `shared/model.ts`: `CURSOR`/`CURSORS` types, `Game.showCursors`,
      `showCursors` on START_GAME.
- [x] Engine: validate, cursor store outside `Game`, flush + audience
      filtering, cleanup on disconnect/complete/sweep.
- [x] `server.ts`: separate cursor rate budget; flush interval.
- [x] Server tests: validation, audience filtering, cleanup (13 tests in
      `server/test/cursors.test.ts`).
- [x] Web: side channel in `state/cursors.ts`, cursor layer on the board,
      throttled pointer send, start-form toggle, header badge, CSS.
- [x] Mobile: receive-and-display, header badge, no sending.
- [x] Docs: `server/claude.md`, `web/claude.md`, `mobile/claude.md`.
- [x] Full verification matrix (protocol change) + release.

## What changed from the plan

- The pointer listener could not live on the cells. They are `<button>`s
  and a disabled button dispatches no pointer events, so hovering would
  have gone dead exactly when it is not your turn. It sits on `.board`
  and derives the cell from the grid's own geometry.
- Clearing ghosts when a game ends is done by the flush noticing for
  itself, not by hooking the completion paths. A forfeit found this: the
  last CURSOR arrives while the game is still in progress and validation
  then refuses any further one, so nothing would ever mark it dirty
  again and the ghosts stayed on a finished board.
- The cursor rate budget refunds the main token rather than bypassing the
  main bucket, so an unparseable flood is still throttled exactly as
  before while ordinary pointer movement cannot cost a player the tokens
  their moves need.

## Files Likely To Change

`shared/model.ts`, `server/src/TiciTacaToeyGameEngine.ts`,
`server/src/server.ts`, `server/src/model.ts`, `server/test/cursors.test.ts`,
`web/src/state/socket.ts`, `web/src/state/actions.ts`,
`web/src/features/game/board/Board.tsx`,
`web/src/features/start/Start.tsx`,
`web/src/features/game/status/Status.tsx`, `web/src/styles/app.css`,
`mobile/src/state.ts`, `mobile/src/screens/GameScreen.tsx`.

## Recovery Hints

If found half-done: the protocol in `shared/model.ts` is the spine - check
whether `showCursors` exists on `Game` and whether the engine has a
`#cursors` map. Server-first, then web, then mobile. `bun test` in
`server/` is the fastest signal that the engine half is coherent.

## Checkpoints

- 2026-07-24 18:38 IST - Task opened. Analysis done and decisions taken;
  starting on the shared protocol.
- 2026-07-24 19:05 IST - Shipped. Server, web, and mobile complete.
  Verified: 141 server tests (13 new), web tests/typecheck/build, sdk
  typecheck, mobile typecheck + both bundles, engine bench unchanged
  (~103k msgs/s). Browser-verified both directions against a scripted
  second player: hovering the browser produced `[0,0,2]` and `[0,1,0]`
  at the peer (coordinates exact), the peer's hover drew a ghost O on
  the board, the badge appeared only on the showCursors game, and a
  private game sent the opponent nothing at all while both hovered.
  Pre-existing and unrelated: `bun test mcp` (stdio bridge) fails 3/9
  locally with EPIPE on a clean tree too; MCP-over-HTTP is 6/6 green.
