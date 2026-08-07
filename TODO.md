# TODO

Operational task tracker. See [`claude.md`](./claude.md) for the workflow and
[`tasks/claude.md`](./tasks/claude.md) for task-file rules.

**Mission**: a delightful, learning, production-ready app - no sharp edges,
exquisite taste in design.

## In progress

- (nothing)

## Pending

- **Publish the mobile app** to the App Store and Play Store
  ([task file](./tasks/mobile-store-launch.md)). A 2026-08-07 drift audit
  found protocol parity with the web is exact and every game feature is
  present; what is missing is the shell around it plus store mechanics.
  Blockers: the playerKey is built from `Math.random()`
  (`mobile/src/state.ts:383`) and should be server-minted; no
  privacy/terms/version anywhere in the app; versions still at 1.0;
  release builds still signed with the debug key; iOS signing is
  Developer not Distribution; this Mac's Xcode cannot currently build
  iOS at all (26.6 selected, only 27.0 simulator runtimes installed);
  and the app has still never been run on a device or emulator. Also
  found: both deep-link association files serve SPA HTML, so Universal
  Links and App Links are silently dead - which breaks the share-a-link
  invite loop the app is built around.
  Absorbs the two older mobile bullets (playerKey CSPRNG, device pass).

## Completed

- Five features after the launch (2026-08-07): **rematch** (a finished
  game was a dead end; same board, same rules, same robots by name),
  **post-game analysis** (a replay now names the move that decided it -
  a win that was there, a block that was not made - from data the
  notation already kept), **turn alerts** (favicon and title carry the
  count; a system notification when the tab is hidden - not when the
  browser is closed, which needs Web Push and is still an open call),
  **humans/machines on the leaderboard** with a route into the SDK and
  MCP, and a **daily position** - one puzzle a day, generated from the
  date so every device derives the same board, needing no opponent and
  no lobby. Also fixed: per-player neon had silently died on every web
  board, `.cell`'s colour reset having outranked `.sym-*`.
  ([task file](./tasks/post-launch-features.md))

- Live cursors (2026-07-24): the other people in a game now appear as dim
  ghosts of their own mark over the cell they are considering, so a board
  feels inhabited between moves. Teammates and spectators always see
  them; opponents only when the host ticks "show cursors to everyone" at
  start, which the game header then says plainly - so hovering a cell you
  have no intention of taking is a legitimate bluff. Presence is never
  game state: it never touches the board, the notation, or the archive,
  it rides its own rate budget so a moving pointer can never cost a
  player the tokens their moves need, and the server coalesces it into
  one broadcast per audience every 100ms. Mobile draws cursors and never
  sends one - a finger has no hover. ([task file](./tasks/live-cursors.md))

- Replays name their players, and Dependabot goes security-only
  (2026-07-24): a replay now opens with the goal in plain words and a seat
  legend saying who was which symbol - team, machine badge, and who won.
  A TTN line has no names in it by design, so the roster rides in the
  replay link (`?p=<handle>&k=<kind>` on web, a `roster` route param on
  mobile) and a bare link still replays, labelled by seat. Dependabot now
  opens security PRs only (`open-pull-requests-limit: 0` on every
  ecosystem). Also fixed: `bun run dev` had been crashing on
  `process is not defined` since the version footer shipped - the bare
  `process.env` read is now guarded, with the production substitution
  verified intact.

- Production cutover (2026-07-24, bookkeeping closed 2026-08-07): the
  Hetzner CX23 in Nuremberg serving one origin - Caddy, systemd, the
  zero-dep Bun server hosting web + websocket + API, releases installed
  by the box itself from GitHub Releases with checksum verification and
  health-checked auto-rollback. Live since 2026-07-23 and has served ten
  releases; the task file simply never got its final checkpoint.
  ([task file](./tasks/production-cutover.md))

Older completed work is in
[`tasks/archived/todo.md`](./tasks/archived/todo.md).
