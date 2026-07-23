# Live games lobby, hacker avatars, win/loss perspective, multi-game UX

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Medium - one protocol addition + web UI work
**Created:** 2026-06-13 06:31 IST
**Completed:** 2026-06-13 07:00 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Make the right rail a living lobby: every running game listed for one-click
spectating, with human/robot/spectator counts shown via icons. Replace
identicons with fast, hacker-style generated avatars. Show win/loss from each
viewer's perspective (a loser must see GAME LOST, not GAME WON). Make playing
several games at once a first-class flow. Dark mode only. New hacker logo.

## Design Decisions

- **LIST_GAMES protocol.** New client message `LIST_GAMES` -> direct response
  `{ type: "LIST_GAMES", games: GameSummary[] }` where a summary carries
  gameId, name, boardSize, playerCount, humanCount, robotCount,
  spectatorCount, status, timed. Only WAITING/IN_PROGRESS games are listed.
  The web client refreshes on connect and polls every 5s - no broadcast
  fan-out, the lobby is allowed to be ~5s stale.
- **Win/loss perspective is a client concern.** The server status stays
  GAME_WON (game state, not viewer state). `getStatusForViewer(game,
  playerId, players)` in the clients renders: winner -> "GAME WON", losing
  player -> "GAME LOST" (red), spectator -> "WON BY <name>". Same for
  timeout wins; draws/abandoned unchanged.
- **Avatars.** `generateAvatar(name)` - FNV hash -> one of the 10 neon sym
  colors + a 5x3 vertically-symmetric grid of block glyphs (' ░▒▓█'),
  rendered as monospace text. No images, no canvas, instant, deterministic.
  identicon.ts is deleted.
- **Multi-game UX.** The engine already supports a player in many games;
  the web adds a "YOUR MOVE" pulse tag on tiles where it is your turn in a
  non-active game, so you can hop between boards.
- **Dark only.** The light "paper terminal" theme is removed from app.css.
- **Logo.** New inline-SVG hacker logo (dark tile, neon grid, glowing X/O)
  as a React component plus `public/favicon.svg`; the 2020 PNG logo and
  favicons are deleted.

## Scope

- [x] Server: LIST_GAMES message + summaries with robot counts, tests.
- [x] Web: lobby rail section with icons (user/robot/eye) + click-to-spectate,
      5s polling.
- [x] Web: avatar.tsx replacing identicon.ts everywhere (persona, player
      cards, spectators).
- [x] Web + mobile: viewer-perspective status (GAME WON / GAME LOST /
      WON BY <name>).
- [x] Web: "YOUR MOVE" indicator on game tiles; verify two concurrent games.
- [x] app.css dark-only; remove prefers-color-scheme block.
- [x] Logo component + favicon.svg; delete old PNG logo/favicons.
- [x] Docs: claude.md files updated.

## Open Questions

- Push lobby updates instead of polling? Resolved: poll at 5s; revisit only
  if the lobby ever feels stale.

## Files Likely To Change

`server/src/model.ts`, `server/src/TiciTacaToeyGameEngine.ts`,
`server/test/lobby.test.ts` (new), `web/src/common/{model,avatar,logo,status}`,
`web/src/state/{store,lobby,actions}`, `web/src/features/**`,
`web/src/styles/app.css`, `web/index.html`, `web/public/`,
`mobile/App.tsx`, docs.

## Recovery Hints

Grep for `LIST_GAMES` and `generateAvatar` to see what landed. The lobby
poll lives in `web/src/state/store.ts`.

## Checkpoints

- 2026-06-13 06:31 IST - Task created.
- 2026-06-13 06:50 IST - Server: LIST_GAMES + GameSummary with
  human/robot/spectator counts (test green, 60 total). Web: lobby reducer +
  5s poll, "live on the server" rail with user/robot/eye icons and
  click-to-spectate, block-glyph avatars replacing identicons everywhere,
  viewer-perspective status (GAME WON / GAME LOST / WON BY <name>),
  YOUR MOVE tag on background-game tiles, dark-only app.css, new neon SVG
  logo + favicon.svg (old PNG logo/favicons deleted).
- 2026-06-13 07:00 IST - Verified live in the browser: spectated an exhibition game from
  the lobby (badge read WON BY GREEDO), lost to minnie-max and saw GAME
  LOST in red, played two games simultaneously with the YOUR MOVE pulse and
  switched between boards. Typecheck + build green. Completed.
