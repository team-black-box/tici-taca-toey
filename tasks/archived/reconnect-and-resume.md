# Reconnect and resume

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Medium - protocol + engine + client identity change
**Created:** 2026-06-10 13:36 IST
**Completed:** 2026-06-11 04:58 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

A page refresh or network blip must not kill a player's games. Players get a
durable identity and a grace window to come back; their games resume exactly
where they were.

## Design Decisions

- **Durable identity via secret player key.** The client generates a UUID
  `playerKey` once, stores it in `localStorage` (`ttt-player-key`), and sends
  it with every `REGISTER_PLAYER`. The server maps `playerKey -> playerId`.
  The public `playerId` (visible to all in game state) never grants control;
  only the socket whose key resolved to it does. Mobile and SDK clients use
  the same mechanism.
- **The server resolves identity before the engine.** `server.ts` keeps the
  per-connection playerId in `ws.data`; when a `REGISTER_PLAYER` carries a
  `playerKey`, the engine's key registry resolves (or creates) the stable
  playerId and the connection's `ws.data.playerId` is updated so all later
  messages act as that player.
- **Disconnect grace.** On socket close the player is marked
  `connected: false` and a grace timer starts (default 60s, configurable for
  tests). Within grace: a reconnect with the same key re-attaches the new
  connection, cancels the abandon, and the server re-sends every active game
  the player is part of as `GAME_RESUMED` (players) / `SPECTATE_GAME`
  (spectators). After grace: the previous behavior runs (games abandoned,
  player removed, others notified).
- Timed games keep their clocks running during the grace window - vanishing
  must not pause your clock.
- Broadcasts skip disconnected players (no send into the void).
- New message/response type: `GAME_RESUMED`. Client reducers treat it like
  `JOIN_GAME` (re-adds to playing list, refreshes game state).
- Robots use the same machinery, so a restarted robot process resumes its
  games if it comes back within grace.

## Scope

- [x] Engine: player key registry, `resolvePlayerKey`, connected flag,
      grace-timer disconnect path, resume notification, broadcast filtering.
- [x] server.ts: key resolution on REGISTER_PLAYER, ws.data update.
- [x] Web client: persistent playerKey, register-on-connect, GAME_RESUMED
      reducer handling.
- [x] Tests: resume within grace (state intact, can keep playing), abandon
      after grace, spectator resume, timed game clock unaffected by
      disconnect, impersonation rejected (unknown key gets fresh identity).
- [x] Update `server/claude.md` protocol section (identity is no longer
      connection-scoped).

## Open Questions

- Should grace be longer for timed games? Resolved: no - one 60s rule, the
  clock punishes long absences naturally.

## Files Likely To Change

`server/src/model.ts`, `server/src/TiciTacaToeyGameEngine.ts`,
`server/src/server.ts`, `server/test/engine.test.ts` (+ new resume tests),
`web/src/state/socket.ts`, `web/src/state/store.ts`,
`web/src/state/currentPlayer.ts`, `web/src/common/model.ts`,
`server/claude.md`.

## Recovery Hints

Grep for `playerKey` and `GAME_RESUMED` to see how far the wiring got. The
grace interval must be injectable (env or constructor) or the tests will be
60s slow - check `DISCONNECT_GRACE_MS`.

## Checkpoints

- 2026-06-10 13:36 IST - Task created with the identity design settled.
- 2026-06-10 17:30 IST - Engine: playerKey registry + resolvePlayerKey,
  connected flag, grace timers, PLAYER_ABANDON internal message,
  GAME_RESUMED replay, broadcast filtering. server.ts resolves keys before
  the engine. Web: identity.ts (localStorage), register-on-connect,
  GAME_RESUMED reducers, handle restored from the server's echo.
- 2026-06-11 04:58 IST - 6 resume tests green (resume within grace incl. continuing play,
  abandon after grace + key cleanup, spectator resume, clocks run through
  disconnects, broadcast filtering, impersonation impossible). Verified live
  in the browser: full page reload mid-game resumed the board, clocks, and
  handle. Completed.
