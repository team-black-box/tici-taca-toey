# Strategy: minimal database + auth for leaderboards and replays

**Status:** Completed
**Owner:** unassigned
**Estimated effort:** Medium - one new server module + small client surfaces
**Created:** 2026-06-13 06:31 IST
**Completed:**
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Let players appear on leaderboards and replay their past games, without
betraying the project's principles: zero new runtime dependencies, no PII,
nothing to operate, costs ~nothing for decades.

## The Strategy

### Database: `bun:sqlite`, one file, zero dependencies

Bun ships SQLite natively (`import { Database } from "bun:sqlite"`), so the
server gets persistence with **no new dependency**. One file
(`data/tici-taca-toey.db`, next to the TTN log), WAL mode, written only at
game completion - gameplay stays purely in-memory. Backup = copy one file.
At ~150 bytes per finished game (TTN line + metadata), a million games is
~150 MB: a free-tier disk holds decades of play.

Schema (v1):

```sql
CREATE TABLE players (
  player_id   TEXT PRIMARY KEY,   -- stable public id
  key_hash    TEXT NOT NULL,      -- sha256(playerKey); never the key itself
  handle      TEXT NOT NULL DEFAULT '',
  is_robot    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

CREATE TABLE games (
  game_id      TEXT PRIMARY KEY,
  ttn          TEXT NOT NULL,     -- the whole replay, ~2 bytes/move
  status       TEXT NOT NULL,     -- GAME_WON | DRAW | TIMEOUT | ABANDONED
  winner_seat  INTEGER,
  started_at   INTEGER NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE TABLE game_players (
  game_id   TEXT NOT NULL,
  seat      INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  PRIMARY KEY (game_id, seat)
);

CREATE TABLE ratings (
  player_id  TEXT NOT NULL,
  pool       TEXT NOT NULL,       -- rating pool, e.g. "3x3x2", "5x4x3-timed"
  rating     REAL NOT NULL DEFAULT 1000,
  games      INTEGER NOT NULL DEFAULT 0,
  wins       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, pool)
);
```

### Auth: the playerKey already is the credential

No passwords, no email, no OAuth, no PII - the existing durable secret
`playerKey` becomes the account:

- The server stores only `sha256(playerKey)`; presenting the key on
  REGISTER_PLAYER *is* login (this is exactly how resume works today).
- "Claim a handle": a registered player sets a unique handle for the
  leaderboard; first-come-first-served, rename allowed, profanity-capped
  length. Handles are display names, not credentials.
- Cross-device transfer: show the playerKey as a QR / copyable phrase
  ("sync to phone"); scanning it on another device imports the identity.
  Lose the key = lose the account; that is an accepted, documented
  trade-off for zero-PII auth. (Optional later: recovery phrase encoding of
  the key.)
- Robots authenticate identically; their leaderboard lives in separate
  pools (`is_robot`), so SDK authors can compete too - a nice on-ramp for
  the ML playground.

### Leaderboards

- Elo (K=32) updated transactionally at GAME_COMPLETE; multiplayer games
  update pairwise against the winner. Pools keyed by board size, win
  length, player count, and timed-ness so 3x3 grinders do not farm 12x12.
- Read API on the existing HTTP server (no framework, plain fetch routes):
  `GET /leaderboard?pool=3x3x2&limit=50`, `GET /players/:id` (rating,
  recent games). Cache in memory for 5s - that is all the scale needed.

### Replays

- A finished game's TTN line is already lossless. `GET /games/:id` returns
  `{ ttn, players, completedAt }`; the web client gets a replay view that
  decodes TTN (port of `server/src/notation.ts` decode) with step
  forward/back - pure client-side, no new protocol.
- "My games": `GET /players/:id/games?limit=50` from `game_players`.
- Retention: keep everything (it is tiny); the TTN flat file stays as the
  ML/export firehose, the DB is the queryable index.

### Durable storage on Vercel (decision forced by the 2026-07-18 deploy)

`bun:sqlite` assumes a disk that persists. Vercel container instances have
**ephemeral** filesystems - which is also why `TTN_LOG=off` is set on the
dev environment: nothing durable is being archived from deployed games
today (each GAME_COMPLETE still hands every client its notation, so no
data is unrecoverable in the moment, but the server keeps no archive).
When this task is picked up, choose one:

1. **Always-on host for the server** (VPS/Fly per the DEPLOYMENT.md
   appendix): keeps bun:sqlite + the flat `.ttn` firehose exactly as
   designed, zero new dependencies. Also dissolves the multi-instance
   state split. The simplest honest option.
2. **Stay on Vercel**: state and archive move to managed stores - Redis
   (Marketplace) for live shared game state, and Postgres/Turso for the
   games/players/ratings tables (Turso is closest to the sqlite design).
   More moving parts, keeps the single-platform story.

The auth design (playerKey -> sha256, handles, QR transfer) is identical
under both options.

### What stays true

- Zero new runtime dependencies (bun:sqlite is built in).
- The engine never blocks on the DB: writes are fire-and-forget post-
  completion, same rule as the TTN log.
- Anonymous-by-default play keeps working with no signup wall; the DB rows
  exist whether or not a handle is claimed.

## Scope (when picked up)

- [x] `server/src/db.ts`: schema bootstrap, write-on-complete, Elo update.
- [x] Handle claiming message + uniqueness rules + tests.
- [x] HTTP read routes: leaderboard, player profile, game replay, my-games.
- [x] Web: leaderboard rail/page + replay viewer (TTN decoder port).
- [x] Key export/import (QR) on web and mobile (MMKV).
- [x] DEPLOYMENT.md: persistent disk note for Render/Fly/VPS.

## Open Questions

- Elo vs Glicko-2? Start Elo (simple, decades-stable); revisit only if
  ratings feel off.
- Should abandoned games rate? Proposal: yes as a loss for the abandoner if
  the game was in progress >= 4 moves, else unrated - decide at pickup.

## Files Likely To Change

`server/src/db.ts` (new), `server/src/server.ts`,
`server/src/TiciTacaToeyGameEngine.ts` (completion hook), web + mobile
surfaces, `DEPLOYMENT.md`.

## Recovery Hints

This file is the strategy of record. Nothing is implemented yet.

## Checkpoints

- 2026-06-13 06:31 IST - Strategy written and parked as Pending.

- 2026-07-18 18:51 IST - db/auth/Elo/API/UI shipped on bun:sqlite; storage swap deferred to prod cutover; verified end-to-end on the deployed dev environment. Completed.
