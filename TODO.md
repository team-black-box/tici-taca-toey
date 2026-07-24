# TODO

Operational task tracker. See [`claude.md`](./claude.md) for the workflow and
[`tasks/claude.md`](./tasks/claude.md) for task-file rules.

**Mission**: a delightful, learning, production-ready app - no sharp edges,
exquisite taste in design.

## In progress

- Production cutover: one Hetzner box (CX23, Nuremberg), one origin,
  releases installed by the box itself (Caddy + systemd, key-only SSH)
  ([task file](./tasks/production-cutover.md)).
  Last checkpoint: 2026-07-23 11:20 IST - box provisioned and hardened;
  DNS pointed; remaining: push the repo, cut the first release, run the
  on-box install, verify a live game.

## Pending

- Mobile: strengthen playerKey generation. `mobile/src/state.ts` builds the
  credential from `Math.random()`, which is not a CSPRNG (the web uses
  `crypto.randomUUID`). Options: a `getRandomValues` polyfill, or have the
  server mint the key on first registration (zero new dependencies). Found
  by the pre-open-sourcing security review; not exploitable remotely, but
  it is the only credential in the system.
- Mobile follow-up (needs hardware): Android emulator/device pass for the
  chrome, and a physical-device game against the production box once live.

## Completed

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

- Post-launch fixes (2026-07-23): the production leaderboard was empty because
  `getServerHttpBase` kept the socket's `/ws` path, so `/api/*` fetches
  missed - now takes the origin. Also: history/player cards no longer
  overflow, starting a game from a browse page redirects to it, a
  spectator can take an open seat (upgrade to player), and a player can
  forfeit ("gg"). ([task file](./tasks/post-launch-fixes.md))

- Standings, public games, and polish (2026-07-23): a sortable
  **leaderboard page** where every row opens that player's games and any
  game replays; **public games** - a game is private until its host opens
  it, then strangers can take a seat from the lobby; **default handles**
  in the house style so nobody is "anonymous" and every row is clickable;
  **agent badges** distinguishing MCP-connected AI from SDK robots; and
  **move animations** plus live-game activity in the lobby. Web and mobile
  ([task file](./tasks/browse-and-public-games.md)). Also fixed: a board
  that could overflow its column and slide under the rail, a client route
  shadowed by an API path of the same name (read API now under `/api/`),
  and a production 500 from a database predating the new schema - it now
  migrates itself.

- Game variants, ratings, and history (2026-07-23): four features shipped
  together across server, web, and mobile
  ([variants](./tasks/game-variants.md),
  [ratings](./tasks/difficulty-elo.md), [history](./tasks/game-history.md)).
  **Multiple win sequences** (e.g. four length-2 sequences on a 12x12) and
  **teams** (sequences may combine teammates' marks) are new game variants
  whose rules live once in `shared/rules.ts`; TTN v3 records them.
  **Difficulty-weighted Elo** adds a headline `global` pool where the
  K-factor scales with how hard the configuration is, alongside the
  per-config pools. **Personal game history** lists your finished games
  with one-click replay, served over the websocket. Also: the leaderboard
  no longer exposes player ids, and the `/players/*` and `/games/:id`
  endpoints are gone (history moved to the socket). Robots are
  variant-aware.
- MCP over streamable HTTP (2026-07-23): the game server serves `/mcp`
  itself, so an agent connects with a URL and no local install. A session
  is an in-process player; `shared/mcp.ts` holds the one tool contract
  both transports serve. 6 e2e tests drive the endpoint like an agent,
  including a full game against a resident robot.
- Deep-link blank page and UI fixes (2026-07-23): absolute asset paths
  (v1.0.2), logo returns home, no spurious error when a game ends,
  centred sync QR, crop-safe OG image (v1.0.3).
- Liveness watchdog (2026-07-23): restarts the unit after two consecutive
  /health misses, closing the wedged-but-running gap (v1.0.1).

Pre-launch history is in
[`tasks/archived/todo.md`](./tasks/archived/todo.md).
