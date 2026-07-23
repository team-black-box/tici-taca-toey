# Revive tici-taca-toey

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Large - full revival of both projects
**Created:** 2026-06-10 11:30 IST
**Completed:** 2026-06-10 13:30 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Bring the 2020-era tici-taca-toey project back to life: merge the separate
server repository into this one, migrate both projects to Bun, strip the web
app to core React, fix and fuzz-test the game engine, harden both sides so
they never die, add the oak-style task management system, and produce a
free/low-cost deployment strategy - all while preserving the original look
and personality.

## Scope

- [x] Merge `tici-taca-toey-server` into this repo as `server/` and move the
      web app into `web/` (monorepo, history preserved via `git mv`).
- [x] Rewrite the server on Bun primitives: `Bun.serve` websockets,
      `crypto.randomUUID`, zero runtime dependencies (dropped ws, uuid,
      lodash.uniq and the whole eslint/nyc/good-vibes toolchain).
- [x] Fix engine bugs found during review (see Checkpoints for the list).
- [x] Make chess-clock timers opt-in so the web client's untimed games behave
      exactly like 2020.
- [x] Add stability hardening: validation that never throws, guarded sends,
      game garbage collection, abuse limits, process-level never-die
      handlers, websocket ping keepalive, `/health` endpoint.
- [x] Rewrite engine tests on `bun:test`: explicit winner cases, a 500-game
      fuzz run against a naive full-board oracle, engine integration tests
      with fake connections, timer tests (35 tests).
- [x] Benchmark the winner calculation (`bun run bench`, ~3.3M ops/sec worst
      case).
- [x] Strip the web app to `react` + `react-dom`: hand-rolled store
      (useSyncExternalStore), router, QR encoder (decoder-verified),
      identicons, SVG icons, clipboard; vendored purged Tailwind 1.9.6 CSS;
      React 16 -> 19; CRA -> Bun dev server and bundler.
- [x] Add client-side stability: reconnecting websocket with backoff,
      re-registration on reconnect, undefined-tolerant selectors,
      "Connecting to server..." state.
- [x] Verify end to end: server smoke test over real websockets, full game
      played through the browser UI against a scripted opponent, QR invite
      popup rendered.
- [x] Add the task management system (root `claude.md`, `TODO.md`, `tasks/`)
      and per-project `claude.md` files.
- [x] Write `DEPLOYMENT.md` with a free-tier strategy, plus `Dockerfile`,
      CI workflow, and a GitHub Pages deploy workflow.

## Open Questions

- Timers in the UI? Resolved: server supports them opt-in; UI work tracked as
  a Pending item in `TODO.md`.
- Reconnect identity? Resolved: kept the 2020 semantics (new playerId per
  connection, disconnects abandon games); resume support tracked as Pending.

## Files Likely To Change

Everything - this was a full restructure. Key entry points afterwards:
`server/src/TiciTacaToeyGameEngine.ts`, `server/src/server.ts`,
`web/src/state/store.ts`, `web/src/common/qr.tsx`,
`web/src/styles/tailwind.css`.

## Recovery Hints

The revival is complete and verified. If something looks half-done, run the
verification commands in the root `claude.md`. The original pre-revival code
is in git history before this change (last old commit: `88ed970`).

## Checkpoints

- 2026-06-10 11:45 IST - Explored both repos and oak-app; catalogued engine
  bugs: (1) right-diagonal scan decremented `xPosRight` twice - missed wins /
  walked off the board, (2) `notify` used `case (A, B)` comma expression so
  REGISTER_PLAYER never got a response, (3) MAKE_MOVE validation crashed on
  unknown gameId or out-of-range coordinates, (4) `calculateNextTurn`
  recursed infinitely when others were out of time, (5) abandoned games
  leaked running timers, (6) validation rejects fell through and threw.
- 2026-06-10 12:15 IST - Monorepo restructure done via `git mv`; server
  rewritten on Bun with zero deps; 35 tests + 500-game fuzz pass; typecheck
  clean; bench 3.3M ops/sec; live websocket smoke test passed.
- 2026-06-10 12:50 IST - Web rewrite done: state/store + socket + router +
  icons + identicon + QR (verified against jsQR: 67 codes round-tripped);
  components updated with original markup; purged Tailwind 1.9.6 vendored
  (44 KB, dynamic classes safelisted).
- 2026-06-10 13:05 IST - Web typecheck, tests, and production build green
  (46 modules in 26ms). Played a full game in the browser against a scripted
  opponent: win detection, highlight, status badges, QR invite all working.
- 2026-06-10 13:30 IST - Docs, task system, DEPLOYMENT.md, Dockerfile, CI
  written. Final verification: server `bun test` 35 pass, web `bun test`
  4 pass, both typechecks clean, web build green.
