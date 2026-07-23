# Web App Instructions

This file governs work inside `web/`. The root [`claude.md`](../claude.md)
still applies, especially the task management, stability, and personality
rules.

## Overview

The Tici Taca Toey web client: a React app bundled and served by Bun. The
only runtime dependencies are `react` and `react-dom`. Everything else that
used to be a library is hand-rolled or vendored in this repository so the app
can build and run unchanged for decades:

| Old dependency | Replacement |
| --- | --- |
| redux, react-redux, redux-thunk, reselect | `src/state/store.ts` - a small store on `useSyncExternalStore` with the same reducer files |
| react-router-dom | `src/common/router.ts` - `useRoute()` + `navigate()` for the single `/:type?/:gameId?` route |
| react-qr-code | `src/common/qr.tsx` - a full QR encoder (byte mode, level M, versions 1-10), decoder-verified, fixture-tested |
| identicon.js | `src/common/avatar.tsx` - deterministic block-glyph hacker avatars (pure text) |
| @fortawesome/fontawesome-free | `src/common/icons.tsx` - inline SVG icons |
| react-copy-to-clipboard | `navigator.clipboard` in `src/features/share/Share.tsx` |
| tailwindcss, webfonts | `src/styles/app.css` - one hand-written vanilla stylesheet, system monospace |
| react-scripts / CRA | `bun ./index.html` (dev) and `bun build` (production) |

## Commands

Run from inside `web/`:

- `bun run dev` - dev server with hot reload on port 3000 (start the game
  server too: `bun run dev` inside `server/`).
- `bun run build` - production bundle into `dist/` (static files, deploy
  anywhere). **`--public-path=/` is load-bearing**: without it Bun emits
  relative asset URLs (`./index-<hash>.js`), which a browser resolves
  against the current path - so `/play/<id>` requests
  `/play/index-<hash>.js`, misses, gets the SPA fallback's HTML where
  JavaScript was expected, and renders a blank page. Every deep link
  (share, spectate, replay) breaks while `/` looks fine. This shipped once
  in v1.0.1; both CI workflows now fail the build if any asset path in
  `dist/index.html` starts with `./`.
- `bun test` - tests (QR encoder fixtures and invariants).
- `bun run typecheck` - TypeScript check.

## Architecture

- `src/state/` - the store. `socket.ts` owns a self-healing websocket
  (capped exponential backoff reconnect). `identity.ts` keeps the secret
  durable `playerKey` in localStorage; every (re)connect registers with it,
  and the server resumes the player's games (`GAME_RESUMED`) and restores
  their handle. `store.ts` routes actions: local action types reduce
  immediately; game actions are sent to the server; server responses are
  reduced as they arrive. Reducers in `currentPlayer.ts`, `games.ts`,
  `players.ts` keep the original redux shapes. Components use
  `useAppSelector` and the action helpers in `actions.ts` (including
  `requestRobot` for the "+ robot" button and timed-game parameters on
  `startGame`).
- `src/common/model.ts` - client message envelopes over the shared
  protocol (`shared/model.ts` is the single wire-format source).
- The lobby: `state/lobby.ts` holds `GameSummary[]` refreshed by a
  `LIST_GAMES` poll (5s, in `store.ts`); `Listing.tsx` renders "your games"
  (with a blinking YOUR MOVE tag when it is your turn in a background game -
  players can be in many games at once), "spectating", and "live on the
  server" (click to spectate).
- Finished games render from the viewer's perspective via
  `getStatusForViewer` in `src/common/status.ts`: GAME WON for the winner,
  GAME LOST for beaten players, WON BY <name> for spectators. In a team
  game the whole winning team sees GAME WON.
- Game variants (see `server/claude.md` for the rules): the start form
  offers `# to win` and a teams picker; `src/common/rules.ts` shims
  `shared/rules.ts` so the sequence counters in `Status.tsx` are computed
  with the same code the server scores with. Team games color and mark by
  side via `getSideSymbol`, and `Players.tsx` groups the roster per team.
- Personal history: `state/history.ts` holds the `MY_GAMES` response,
  refreshed on registration and whenever a game of yours ends;
  `features/listing/History.tsx` renders it in the rail, one click to the
  replay viewer. It travels over the websocket precisely so **no player id
  ever appears in a URL** - the leaderboard API returns handles only.
- The replay viewer (`src/features/replay/Replay.tsx`, route
  `/replay/<ttn>`) is fully client-side: the TTN codec lives in
  `shared/ttn.ts` (one copy for every module) and v2 clock tracks render
  as per-move think times. The URL is the replay.
- Social unfurls: `index.html` carries OG/Twitter meta and
  `public/og.png` (1200x630, regenerate from the logo art if the identity
  changes); `App.tsx` sets per-route `document.title`.
- Move impact (`src/common/particles.ts` + the canvas in `Board.tsx`): a
  hand-rolled canvas particle engine - sparks with motion trails, a quick
  shockwave ring, and glyph debris, drawn additively so overlaps bloom like
  phosphor. The burst takes its colour from the rendered cell, so team
  colours come along for free. Two things to preserve: velocities are
  **px per second** multiplied by the frame delta (the first cut moved by
  velocity per *frame*, so sparks left the canvas in one tick and nothing
  was ever visible), and the effect's layout hook depends on the board
  existing - with an empty dependency list it bailed once on a lobby with
  no game and never ran again. The loop releases its frame callback when
  nothing is alive, and clears on `visibilitychange` so a backgrounded tab
  does not come back to a frozen burst.
- The logo is an inline SVG component (`src/common/logo.tsx`), mirrored as
  `public/favicon.svg` - keep the two in sync.
- `src/features/` - one folder per UI feature, unchanged from the 2020
  layout: header, player-persona, start, join, game (board/players/status),
  listing, share.
- The running release is shown in the footer and links to its GitHub
  release page (`src/common/version.ts`). `TTT_VERSION` is inlined at build
  time by `--env 'TTT_*'`, so it must stay a bare `process.env.TTT_VERSION`
  reference; local builds have no tag and read `dev`. The server reports
  the same value at `/health`, so "what is live?" is answerable from either
  the page or a curl.
- Server URL resolution (`src/state/socket.ts`): `TTT_SERVER_URL` env var
  inlined at build time (`bun build --env 'TTT_*'`), else
  `ws://localhost:8080` on localhost, else same-origin `wss://<host>/ws`.
  **Production uses the same-origin path**: the game server serves `dist/`
  itself (`TTT_WEB_DIR`, see `DEPLOYMENT.md`), so production builds run
  with `TTT_SERVER_URL` unset and bake in no URL at all.

## Styling

Since the 2026-06 terminal restyle, all styling lives in one hand-written
vanilla stylesheet: `src/styles/app.css` (~8 KB). No Tailwind, no webfonts,
no CSS build step, no CSS-in-JS - keep it that way.

- CSS custom properties at the top define the whole identity. **Dark mode
  only** - phosphor green on near-black, no light theme, by explicit
  decision (2026-06-13). Never hardcode a color in a component - add a
  variable.
- Per-player neon colors are the `--sym-0..9` variables exposed as
  `.sym-0..9` classes; `src/common/symbol.ts` maps players to them. Status
  badges come from `src/common/status.ts` (`badge badge--wait|live|done|dead`).
- Components use semantic classes (`panel`, `btn`, `board`, `cell`, `tile`,
  `player-card`, `clock`, `popover`...). The board's grid dimension is the
  `--n` custom property set inline by `Board.tsx`.
- Typography is the system monospace stack (`--mono`); terminal flourishes
  are the blinking brand cursor, `> ` section prefixes, soft glows, and a
  faint scanline overlay (dark mode only). Keep effects subtle.
- The QR card keeps a white background - scanners need the contrast.
- The mobile app mirrors this palette in `mobile/App.tsx` StyleSheets; if
  you change the variables, update it too.

## The QR Encoder

`src/common/qr.tsx` implements QR generation from scratch (byte mode, error
correction level M, versions 1-10, mask selection by penalty). Its output was
verified by round-tripping through an independent decoder (jsQR), and
`test/qr.test.ts` pins decoder-verified module matrices as fixtures. If you
touch the encoder, the fixtures must still pass; if you intentionally change
output, re-verify with a real decoder before regenerating fixtures.

## Stability Rules

- The app must render something sensible with no server: the footer shows
  "reconnecting to server..." and the socket retries forever.
- Selectors must tolerate missing games/players (`undefined` guards).
- Server error responses are logged, never thrown.
- The durable playerKey in localStorage is a secret; never render it or put
  it in URLs.
