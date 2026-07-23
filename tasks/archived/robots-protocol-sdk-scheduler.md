# Robots: protocol, SDK, scheduler, reference robots

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Large - new protocol surface, new packages
**Created:** 2026-06-10 13:36 IST
**Completed:** 2026-06-11 04:58 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

A minimal, superfast robots protocol so anyone can implement a robot that
plays tici-taca-toey, an in-server scheduler that routes games to available
robots, an SDK that makes writing a robot a ~10 line affair, and reference
robots people can run and play against. Robots can play robots, play many
games concurrently, and advertise capabilities. Long-term this becomes a
machine learning playground (out of scope here; the notation task feeds it).

## Design Decisions

- **Robots are players.** A robot registers with `REGISTER_ROBOT` and then
  behaves exactly like a player: it receives the standard game broadcasts and
  sends standard `MAKE_MOVE` messages. No parallel game protocol - the robot
  surface is registration + scheduling only. This keeps the protocol minimal
  and means robot-vs-robot needs nothing special.
- **Capabilities** advertised at registration:

  ```ts
  {
    boardSizes: { min: number; max: number },     // inclusive, within 2-12
    playerCounts: { min: number; max: number },   // inclusive, within 2-10
    maxConcurrentGames: number,                   // 1-100
    timed: boolean,                               // accepts timed games
    minTimePerPlayer?: number                     // ms; refuses faster clocks
  }
  ```

- **Scheduler.** In-memory registry `robotId -> { capabilities, activeGames }`.
  `REQUEST_ROBOT { gameId }` (sent by any player in a WAITING_FOR_PLAYERS
  game) picks the least-loaded available robot whose capabilities match the
  game (board size, player count, timed-ness, clock speed), excluding robots
  already seated in that game, and seats it via the normal join transition.
  O(robots) per request, zero allocation hot path - effectively instant at
  any realistic robot count. Error `NO_ROBOT_AVAILABLE` when nothing matches.
- **Load accounting.** The engine increments a robot's load when seated and
  decrements when a game completes, is abandoned, or is swept. Robots in
  WAITING games count as load too (a seat is a commitment).
- **SDK** (`sdk/`): zero-dependency TypeScript, runs on Bun and Node >= 22
  (global WebSocket). `new TiciTacaToeyRobot({ url, name, capabilities,
  onTurn }).start()`. The SDK handles registration, reconnect-with-resume
  (same playerKey machinery as humans), concurrent games, turn dispatch, and
  move submission. `onTurn(view) -> { x, y }` may be async. Helpers exported:
  `emptyCells(game)`, `findWinningMove(game, playerId)` so simple robots stay
  simple. Optional `onGameComplete(game)` callback (receives the TTN
  notation for ML data collection).
- **Reference robots** (`robots/`, run with `bun robots/<name>.ts [url]`):
  - `random.ts` - any board, any players, 25 concurrent. Picks a random
    empty cell.
  - `greedy.ts` - win now if possible, else block an opponent's immediate
    win, else take the most central empty cell.
  - `minimax.ts` - perfect play for 3x3 two-player via memoized minimax;
    advertises only 3x3 so the scheduler never miroutes it.
- **Web UI**: an "add robot" button on games waiting for players, sending
  `REQUEST_ROBOT`.
- Spectating robot games works for free (robots are players).

## Scope

- [x] Protocol: `REGISTER_ROBOT` (with capabilities validation),
      `REQUEST_ROBOT`, `NO_ROBOT_AVAILABLE` + validation error codes, in both
      model files.
- [x] Engine: robot registry, scheduler selection, seat-on-request, load
      accounting on every completion path, robot cleanup on disconnect.
- [x] SDK package with helpers, reconnects, concurrency.
- [x] Three reference robots.
- [x] Web: add-robot button.
- [x] Tests: capability matching (size/count/timed/clock), least-loaded
      selection, no-robot error, robot plays a full game via SDK against the
      engine, robot-vs-robot full game, load release on completion and
      abandon, concurrent games on one robot.
- [x] Docs: `server/claude.md` robots section, `sdk/README.md` quickstart,
      root `claude.md` repository map.

## Open Questions

- Should humans pick which robot? Resolved: no - the scheduler picks;
  simplicity first. Named-robot matchmaking can be a future task.

## Files Likely To Change

`server/src/model.ts`, `server/src/TiciTacaToeyGameEngine.ts`,
`server/src/server.ts`, `server/test/robots.test.ts` (new), `sdk/` (new),
`robots/` (new), `web/src/common/model.ts`, `web/src/state/actions.ts`,
`web/src/features/game/status/Status.tsx`, docs.

## Recovery Hints

Check `server/test/robots.test.ts` against the engine to see what landed.
The SDK and robots are standalone - `bun robots/random.ts` against a dev
server is the fastest sanity check.

## Checkpoints

- 2026-06-10 13:36 IST - Task created; protocol surface settled
  (registration + request only, robots are otherwise normal players).
- 2026-06-10 17:50 IST - Engine: robot registry with capability validation,
  pickRobot least-loaded scheduler, REQUEST_ROBOT seating via the join
  transition (broadcast as JOIN_GAME), load release on every completion
  path. SDK written (zero deps, reconnect + resume, turn dedupe via
  moveLog, helpers). Three reference robots: rando, greedo, minnie-max.
  Web "+ robot" button.
- 2026-06-11 04:58 IST - 9 robot tests green (capabilities, matching, least-loaded, load
  caps, release on completion/abandon, robot-vs-robot). Live e2e: minimax
  seated by the scheduler and never lost vs a random-playing host; a 3-player
  5x5 game with two robots + human completed; played vs greedo through the
  browser UI. Completed.
