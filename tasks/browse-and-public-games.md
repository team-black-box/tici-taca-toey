# Leaderboard page, agent badges, and public games

**Status:** In progress
**Owner:** claude
**Estimated effort:** Large (protocol + server + web + mobile)
**Created:** 2026-07-23 16:49 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Four asks from the 2026-07-23 session, in one slice because they all touch
identity and the lobby:

1. **Leaderboard page** at its own route: a sortable table of every player
   with full stats (rating, games, wins, draws, losses, win rate).
2. **Replay anyone's games**: click a handle, see their finished games,
   replay any of them.
3. **Agent badges**: players connected over MCP get their own icon, next to
   the robot icon we already have.
4. **Public games on the homepage**: list everything joinable/spectatable,
   and a "start public game" so strangers can join without a link.

## Design notes

- Everything public is keyed by the **handle**, never the playerId. The
  handle is the identity a player chose to publish; the id stays off the
  wire (see the 2026-07-23 privacy change).
- `PlayerKind` (human | robot | agent) replaces the `is_robot` boolean, and
  is server-assigned only: `server.ts` strips any client-supplied `kind` so
  a browser cannot badge itself as an agent.
- The leaderboard lists only players with handles - an unclickable row is
  noise on a browse table.

## Scope

- [x] `shared/model.ts`: PlayerKind, Player.kind, GameSummary.agentCount,
      ArchivedGameSummary players carry kind.
- [x] db: kind column, draws tracked, leaderboard returns full stats,
      `gamesByHandle` for browsing.
- [x] Engine: kind on attach/broadcast, agent counts in lobby summaries.
- [x] MCP sessions register as agents; server strips client `kind`.
- [x] Server: `/handles/<handle>/games` public browse endpoint.
- [x] Web: `/leaderboard` route with a sortable table; `/player/<handle>`
      games list; agent icon wherever the robot icon appears.
- [x] Public games: OPEN_SEATS, joinable from the lobby when open.
- [x] Default handles in the house style, assigned on arrival.
- [x] Move-impact animation and lobby activity indicators.
- [ ] Mobile: agent badge, and the public-games list.

## Open Questions

Resolved (user, 2026-07-23): every game is already listed and spectatable,
so "public" is not a visibility concept - it means *let strangers take a
seat*. A game is closed until its host opens it, exactly like a robot only
joining when asked.

## Files Likely To Change

shared/model.ts, server/src/{db,server,mcp,TiciTacaToeyGameEngine}.ts,
web/src/features/listing/*, web/src/features/leaderboard/*,
web/src/common/{icons,router}.tsx, mobile/src/*.

## Recovery Hints

Server layer is done and green (111 tests). The web layer is next: the
router is a single `/:type?/:gameId?`, so `/leaderboard` and
`/player/<handle>` are new `type` values handled in App.tsx.

## Checkpoints

- 2026-07-23 17:11 IST - Web done and verified in the browser: sortable standings table
  (clicking a header flips the caret and reorders), click-through to
  /player/<handle>, and replaying another player's game. Public games
  verified over live sockets - a lobby join is refused with
  GAME_IS_NOT_OPEN until the host opens the game, then the stranger is
  seated. Default handles are landing (tank-7jh, persephone-s8y). Move
  strikes fire for both my move and the robot's reply; lobby tiles pulse
  with marching dots while a game is live.
  **Found and fixed a route collision**: the client route /leaderboard was
  being shadowed by the server's API path of the same name, so the page
  rendered raw JSON. The read API now lives under /api/*, which makes such
  a collision structurally impossible. Mobile is the remaining scope.

- 2026-07-23 16:49 IST - Server + protocol done: PlayerKind everywhere, draws tracked,
  full leaderboard stats, gamesByHandle, agent registration, and the
  handle-keyed browse endpoint. 111 server tests green. Next: web.
