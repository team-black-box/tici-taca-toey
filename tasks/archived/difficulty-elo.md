# Difficulty-weighted Elo and leaderboard privacy

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium (server db + leaderboard UI on web/mobile)
**Created:** 2026-07-23 13:26 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

A single headline **global** Elo rating per player where the K-factor
scales with game difficulty (win length, sequence count, player count,
timed), alongside the existing per-config pools. Leaderboard defaults to
global. Also: remove playerId from all public HTTP responses (user
request, 2026-07-23) - playerKey is the only credential so impersonation
was never possible, but public ids allowed history enumeration.

## Scope

- [x] db.ts: difficultyOf(game), global pool settle, pool naming with
      -s<count>/-t<teams> suffixes, leaderboard rows without playerId.
- [x] server.ts: /leaderboard default pool global; delete /players/* and
      /games/:id endpoints (history moves to the websocket).
- [x] Web + mobile leaderboard UI updates.
- [x] Tests for difficulty scaling and the global pool.

## Checkpoints

- 2026-07-23 13:26 IST - Task created.
