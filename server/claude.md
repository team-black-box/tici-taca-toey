# Server Instructions

This file governs work inside `server/`. The root
[`claude.md`](../claude.md) still applies, especially the task management,
stability, and personality rules.

## Overview

A multiplayer websocket game server built on Bun with **zero runtime
dependencies**. Everything - websockets, UUIDs, timers, TLS - uses Bun and
platform primitives.

- `src/server.ts` - Bun.serve websocket endpoint, message enrichment,
  playerKey resolution, health endpoint, sweep + ping intervals, never-die
  process handlers, ASCII banner.
- `src/TiciTacaToeyGameEngine.ts` - the engine: `validate` -> `transition` ->
  `notify` for every message, plus `sweep` for garbage collection,
  `calculateWinner` for win detection, the robot scheduler (`pickRobot`),
  and the resume grace machinery.
- `src/model.ts` - server message envelopes + engine types over the
  shared protocol (`shared/model.ts` - the single wire-format source).
- `src/timer.ts` - opt-in chess-clock timers (see Timed games).
- `src/notation.ts` - TTN encode/decode (see Notation).
- `src/static.ts` - same-origin serving of the built web app
  (`TTT_WEB_DIR`, production only; see Deployment). It also rewrites the
  index.html title/description/OG tags per route so a shared link unfurls
  with content about that page - crawlers never run the SPA's JavaScript,
  so this has to happen server-side. The meta-tag regexes tolerate the
  bundler's multi-line wrapping (`\s+` between attributes).
- `src/mcp.ts` - MCP over streamable HTTP at `/mcp`, so AI agents connect
  with a URL and no local install. A session is an in-process player (the
  residents.ts trick), keyed by the `Mcp-Session-Id` header; an
  `X-TTT-Player-Key` header gives an agent a durable identity. Idle
  sessions are swept alongside games and end like a closing socket.
- `test/` - engine, winner (fuzz oracle), timer, notation (round-trip fuzz),
  resume, robot, static-serving, sweep/capacity, and performance-floor
  tests.
- `bench/` - `winner.bench.ts` (win-scan micro-benchmark),
  `engine.bench.ts` (full pipeline throughput + memory),
  `sockets.bench.ts` (real-websocket load; see Performance).

## Commands

Run from inside `server/`:

- `bun run dev` - start with watch mode on port 8080.
- `bun start` - start the server (PORT env var overrides the port).
- `bun test` - full test suite (includes conservative performance floors).
- `bun run typecheck` - TypeScript check.
- `bun run bench` - winner calculation benchmark (~3M ops/sec worst case on
  an M-series laptop; investigate if a change drops this an order of
  magnitude).
- `bun run bench:engine` - full pipeline benchmark. 2026-07 baselines on an
  M-series laptop: ~15k full 3x3 games/s fresh, ~12k games/s sustained
  (~114k engine msgs/s, ~217k sends/s), ~1 KB RSS per active game,
  ~8k LIST_GAMES polls/s at 500 active games.
- `bun run bench:sockets [pairs] [seconds]` - real-websocket load (spawns a
  server with the rate limiter relaxed). Baseline: 400 sockets sustained
  ~17k msgs/s delivered, zero errors, with the single-process bench client
  as the bottleneck, not the server.

## Protocol

Clients send JSON messages; the server enriches each with the
connection-scoped `playerId`, a `gameId` (generated if absent), and the
connection, then runs it through the engine.

Message types: `REGISTER_PLAYER`, `REGISTER_ROBOT`, `REQUEST_ROBOT`,
`START_GAME`, `JOIN_GAME` (a spectator may send one to take an open seat -
they are dropped from the spectator list so they are not counted twice),
`MAKE_MOVE`, `FORFEIT` (concede an in-progress game: two sides left, the
other wins; more, the game ends attributed to the forfeiter - not written
to the TTN corpus since a forfeited board has a winner but no winning
line), `SPECTATE_GAME`, `LIST_GAMES`
(returns lobby summaries - name, board, human/robot/spectator counts -
for WAITING/IN_PROGRESS games, sent only to the requester; clients poll
~5s), `LIST_MY_GAMES` (the requester's finished games from the archive,
answered as `MY_GAMES`; handles only, never playerIds, and an empty list
rather than an error when the server has no database). Server-internal:
`PLAYER_DISCONNECT`, `PLAYER_ABANDON`, `PLAYER_TIMEOUT`, `NOTIFY_TIME`.
Response-only: `GAME_COMPLETE` (sent when a game reaches `GAME_WON`,
`GAME_ENDS_IN_A_DRAW`, or `GAME_WON_BY_TIMEOUT`) and `GAME_RESUMED`.
Spectators receive every broadcast re-typed as `SPECTATE_GAME`. Validation
failures are sent only to the offending player as
`{ type: "ERROR", error: <code>, message }`.

## Identity, Handles, and Player Kinds

Every player is one of three `PlayerKind`s: `human`, `robot` (registered
via `REGISTER_ROBOT`, plays through the SDK), or `agent` (connected over
MCP). The kind is **server-assigned only** - `server.ts` strips any
client-supplied `kind` from incoming messages, so a browser cannot badge
itself as an agent. Clients show a distinct icon for each machine kind.

Humans are given a handle the moment they arrive (`shared/handles.ts`, in
the house style: `trinity-x7k`), so nobody is ever "anonymous" and every
leaderboard row is a real, clickable identity. Claiming a handle replaces
the assigned one. Note the ordering in `attachPlayer`: the player row is
persisted *before* asking for a handle, because `ensureHandle` updates
that row - the other order silently assigns nothing on a first connection.

The database migrates itself on open (`GameDb#migrate`), additively:
`CREATE TABLE IF NOT EXISTS` does nothing to an existing table, so a box
carrying an older database needs its new columns added explicitly. A
failed migration logs and continues - the game outlives any one feature.

## Public Games

A game is private until its host opens it, exactly like a robot only
joining when asked. `OPEN_SEATS` flips `game.openSeats`; a `JOIN_GAME`
carrying `fromLobby: true` is refused with `GAME_IS_NOT_OPEN` unless the
game is open. Joining by link is unaffected - holding the link is itself
the invitation.

## Identity, Reconnect, and Resume

Registrations may carry a secret `playerKey` (8-64 chars). The server maps
key -> stable public `playerId` (`resolvePlayerKey`, called in `server.ts`
before the engine sees the message); all later messages on that socket act
as that player. The key is the only credential - never broadcast it.

On socket close the player is marked disconnected and a grace timer starts
(60s default, `disconnectGraceMs` engine option for tests). Within grace, a
re-registration with the same key re-attaches the connection, cancels the
abandon, restores the stored name, and replays every active game to the new
connection as `GAME_RESUMED` (players) or `SPECTATE_GAME` (spectators).
After grace, `PLAYER_ABANDON` fires: games abandon (broadcast with the
legacy `PLAYER_DISCONNECT` response type), the player and key are removed.
Clocks keep running through disconnects. Broadcasts skip disconnected
players.

## Robots and the Scheduler

Robots register with `REGISTER_ROBOT` plus capabilities (boardSizes 2-12,
playerCounts 2-10, maxConcurrentGames 1-100, timed, optional
minTimePerPlayer). After that a robot is a normal player: standard
broadcasts in, standard `MAKE_MOVE` out. Any player in a
`WAITING_FOR_PLAYERS` game can send `REQUEST_ROBOT { gameId }`; the
scheduler (`pickRobot`) seats the least-loaded connected robot whose
capabilities match the game, or rejects with `NO_ROBOT_AVAILABLE`. Seats
count as load (including waiting games) and are released on every completion
path: win, draw, timeout, abandon, sweep. The broadcast for a seated robot
is a plain `JOIN_GAME`, so clients need nothing special. Robot-vs-robot is
just multiple `REQUEST_ROBOT` calls. The SDK in `sdk/` wraps all of this;
reference robots live in `robots/`. Residents and reference robots are
variant-aware: their win test uses the shared rules (so teammates' marks
count and several sequences are required when the game asks for them), and
greedo blocks only genuine opponents, never a teammate. The SDK is
strategy-neutral by policy:
it ships plumbing and board reading only (`emptyCells`), never
move-evaluation helpers - those live with the robots
(`robots/strategy.ts`).

## Notation (TTN)

Every game records a TTN line - see the grammar at the top of
`src/notation.ts`:
`<version>.<size>.<winLen>.<players>.<time>.<moves>.<result>[.<clocks>]`,
with fixed-width 2-char base36 cell tokens (`cell = x * size + y`), `--` for
skipped seats, and `w<i>`/`t<i>`/`d`/`a` results. Untimed games emit v1
(example: `1.3.3.2.u.0003010402.w0`, ~2 bytes per move); timed games emit
v2, which appends a clock track: one 3-char base36 token per move token
holding the mover's thinking time in deciseconds (`000` for skips). The
engine appends move/skip/clock tokens as play happens (`clockLog`,
`turnStartedAt`), sets `game.notation` on completion, includes it in
`GAME_COMPLETE`, and (in `server.ts`) appends finished games to a data file:
`TTN_LOG` env var, default `data/games.ttn`, `TTN_LOG=off` to disable.
Variant games (several sequences, or teams) emit **v3**, which inserts the
two extra fields the classic form has no room for:
`3.<size>.<winLen>.<seqCount>.<players>.<teams>.<time>.<moves>.<result>[.<clocks>]`
(example: `3.5.3.1.4.2.u.000i010o02.w0` - 5x5, win 3, 1 sequence, 4 players,
2 teams). Classic games still emit v1/v2, so the existing corpus and the
playground's readers are untouched. The
engine itself defaults to no file logging (`ttnLogPath` option), so tests
never write files. Data collection must never affect gameplay - the append
is fire-and-forget. The codec lives in `shared/ttn.ts` (one
implementation for every module; `src/notation.ts` is a shim). TTN is the
substrate for the ML playground in `playground/` (see its README).

## Engine Rules

- `validate` never throws and never assumes a game or player exists. Every
  rejection is an `ErrorCodes` value. Reject with an early `return`.
- `transition` is the only place state changes. Guard timer-driven messages
  (`PLAYER_TIMEOUT`, `NOTIFY_TIME`) against games that completed or were swept
  between the tick and the handling.
- `notify` is the only place sends happen, and every send is guarded so a dead
  socket cannot break a broadcast.
- Per-message work must cost O(the game's own seats), never O(all players)
  or O(all games), and `this.games`/`this.players` are updated by targeted
  assignment, never whole-map spreads - the 2020 redux-style copies made
  every message O(server size) and cost 35x sustained throughput
  (found and fixed 2026-07 via `bench/engine.bench.ts`; the floors in
  `test/perf.test.ts` fail loudly if either regression returns). Full-map
  scans are allowed only in periodic or rare paths (sweep, abandon,
  LIST_GAMES).
- Limits live at the top of the engine file: board 2-12, players 2-10 (and
  fewer than the board size), spectators 15, name length 50, payload 16 KB,
  and max active games (`TTT_MAX_GAMES`, default 1000). The companion cap is
  `TTT_MAX_CONNECTIONS` (default 2000) in `server.ts`, which refuses the
  websocket upgrade with a 503 + `Retry-After` - connections, not games, are
  what consume memory (~365 KB RSS each per `bench/sockets.bench.ts`, so
  ~2000 is a 1 GB box's ceiling). `/health` reports `connections` and
  `maxConnections` so a pinger shows the headroom.
- `sweep(now)` runs every minute and does two jobs. It **ends** dead games -
  abandoning them properly via `#abandonGame` (broadcast as
  PLAYER_DISCONNECT, archived to sqlite, robot seats released) rather than
  deleting them silently, which is what used to leave ghosts in clients'
  lobbies. A game is dead when it has sat untouched past `IDLE_GAME_TTL`
  (`TTT_IDLE_GAME_MS`, default 30 min) or is older than 24 hours.
  **Timed games in progress are exempt from the idle rule** - their clocks
  already end them via PLAYER_TIMEOUT, so a long think is legitimate there;
  the 24h backstop still applies. It then **deletes** games that completed
  more than 10 minutes ago, destroying timers as it goes. Abandoned games
  therefore linger for the completed TTL so connected clients see the final
  state. Anything that creates a timer must guarantee a path to `destroy()`.

## Game Variants

Two optional variants generalize the classic game, and their rules live in
`shared/rules.ts` so the engine, web, and mobile all agree:

- **Multiple sequences** (`winningSequenceCount`, default 1): a game can
  require N sequences of the win length. Within one direction a maximal run
  of R counts as `floor(R / winLen)` sequences, so overlapping windows never
  double-count; runs in *different* directions each count, so sequences may
  cross like crossword answers. Validation refuses counts that cannot
  physically fit in a side's share of the board.
- **Teams** (`teamCount`, default 0 = none): equal teams only
  (`playerCount % teamCount == 0`, at least two per team). The team of a
  seat is `seat % teamCount`, which makes the existing rotation interleave
  teams with **no turn-order changes at all**. Sequences may combine
  teammates' marks; clients color and mark by side. A team game ends on
  time only when a whole team's clocks have run out, and ratings settle
  team-vs-team (never between teammates).

## Winner Calculation

`calculateWinner` keeps the classic fast path - a win must run through the
last move, so it scans only the four lines through that cell,
O(4 x winningSequenceLength) per move. Variant games (several sequences, or
teams) fall through to the shared full-board counter instead. It returns the
winner, the `winningSequence` cells the web client highlights, and the
winning team (-1 when teamless).

History note: the original 2020 `calculateWinnerV2` had a broken right
diagonal scan (it decremented `xPosRight` twice). The regression test in
`test/winner.test.ts` pins this case, and a 500-game fuzz run compares the
implementation against a naive full-board oracle on every move. Keep the fuzz
test passing - it is the strongest guarantee of correctness here.

## Timed Games

Chess-clock timers are **opt-in**: a `START_GAME` message with `timePerPlayer`
(ms, 5s-1h) creates a timed game; `incrementPerPlayer` (ms, default 1000) is
added after each move. Untimed games (the web client default) carry an empty
`timers` map and never receive `NOTIFY_TIME`. Timers tick at 250ms and
broadcast clock updates roughly once a second. When only one player has time
left the game ends `GAME_WON_BY_TIMEOUT`.

## Stability Checklist For Changes

- Wrap nothing in a way that lets an exception escape `message()` or
  `close()` in `server.ts`.
- Never index into `this.games[...]` or `this.players[...]` without handling
  `undefined`.
- New limits beat new cleverness: if input can be abused, cap it.
- Add a test for every new validation rule and every new transition.

## Deployment

Production is **one process on one box serving one origin**: set
`TTT_WEB_DIR=<path to web/dist>` and the server serves the web app too
(static files with content-hash-aware caching, SPA fallback to index.html
for client routes; `src/static.ts`, guarded so serving can never break the
game endpoint). The web client then connects via its same-origin
`wss://<host>/ws` fallback - no build-time server URL. `HOST=127.0.0.1`
binds behind the reverse proxy (Caddy terminates TLS); `PORT` picks the
port; `TLS_CERT`/`TLS_KEY` exist for proxyless setups.

Public read endpoints live under **`/api/*`** (`/api/leaderboard`,
`/api/handles/<handle>/games`). The namespace is load-bearing: the client
route `/leaderboard` was once shadowed by an API path of the same name, so
the page served raw JSON to the browser. Everything there is keyed by the
public **handle**, never the internal playerId. `GET /health`
returns the running release plus player/game/robot counts for monitoring -
the version comes from the `VERSION` file at the artifact root (or
`TTT_VERSION`), and reads `dev` in a checkout. Full box runbook,
security stance, and backups: [`DEPLOYMENT.md`](../DEPLOYMENT.md).
