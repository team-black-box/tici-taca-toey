# Archived Completed Tasks

Completed `TODO.md` items older than 14 days land here, newest first. See
[`../claude.md`](../claude.md) for the archiving workflow.

## 2026-06-13

- Live games lobby (LIST_GAMES + spectate rail with human/robot/spectator
  icons), block-glyph hacker avatars, win/loss viewer perspective,
  multi-game UX with YOUR MOVE tags, dark-mode-only, new neon SVG logo
  ([task file](./live-games-lobby-avatars-multigame.md))
  (completed 2026-06-13)
- SDK neutrality: strategy helpers removed from the SDK (it ships plumbing
  and board reading only); findWinningMove/isWinningPlacement moved to
  robots/strategy.ts (completed 2026-06-13)
- Mobile: React Navigation tabs + pushed game screen, MMKV-persisted
  identity (resume across app restarts), iOS liquid glass tab bar and
  app-level controls with terminal fallback, watch tab; nitro-modules
  pod-install fix ([task file](./mobile-navigation-liquid-glass.md))
  (completed 2026-06-13)

## 2026-06-11

- Terminal / matrix restyle: raw vanilla CSS, dark mode first, system
  monospace, no Tailwind/webfonts
  ([task file](./terminal-restyle.md)) (completed 2026-06-11)
- Chess-clock timers in the web UI
  ([task file](./timers-ui.md)) (completed 2026-06-11)
- Reconnect and resume: durable playerKey identity + 60s disconnect grace
  ([task file](./reconnect-and-resume.md)) (completed 2026-06-11)
- Robots: protocol, zero-dep SDK, in-server scheduler, reference robots
  (rando/greedo/minnie-max), "+ robot" button
  ([task file](./robots-protocol-sdk-scheduler.md)) (completed 2026-06-11)
- TTN v1 game notation: ~2 bytes/move, lossless, logged to data file and
  included in GAME_COMPLETE
  ([task file](./ttn-game-notation.md)) (completed 2026-06-11)
- Bare React Native app, package com.ticitacatoey, terminal styled
  ([task file](./react-native-app.md)) (completed 2026-06-11)

## 2026-06-10

- Revive tici-taca-toey: monorepo merge, Bun migration, zero/minimal
  dependencies, engine fixes + fuzz-tested solver, stability hardening, task
  system, deployment strategy
  ([task file](./revive-tici-taca-toey.md)) (completed 2026-06-10)

## Archived 2026-07-23 (the 2026 revival, at open-sourcing)

Everything below shipped before the repository went public. Task files for
these live beside this one in `tasks/archived/`.

- Upgrades batch (completed 2026-07-20): MCP play service - AI agents play
  via 9 stdio tools, e2e-tested, CI job added
  ([task](./mcp-play-service.md)); performance pass - two
  O(server-size)-per-message defects fixed, 35x sustained throughput
  (114k msgs/s), capacity model + floors
  ([task](./performance-pass.md)); shared/ protocol extraction -
  one model/TTN codec/error copy for all six modules
  ([task](./shared-protocol-extraction.md)); mobile down to
  react + react-native + React Navigation with hand-rolled storage and
  chrome, proven on-simulator ([task](./mobile-zero-deps.md));
  identity now survives server restarts (db-backed key resolution +
  regression test); /dataset endpoint + daily corpus workflow
  (.github/workflows/dataset.yml); OPEN_SOURCING.md checklist with clean
  secret scan; agents.md symlinks + module claude.mds everywhere; Vercel
  remnants (vercel.json x2, Dockerfile.vercel, .vercelignore, Dockerfile,
  Pages workflow, scratch-e2e.ts) deleted; repo references renamed
  tici-taca-toey-web -> tici-taca-toey ahead of the GitHub rename.


- Mobile device polish (completed 2026-07-19): neon icons + near-black
  splash on both platforms (no white flash - iOS root view painted
  natively); ticitacatoey:// deep links proven warm AND cold on the
  iOS 26.5 simulator (found + fixed missing RCTLinkingManager forwarding),
  https app-link filters staged for cutover; safe-area inset fix for the
  Dynamic Island (user-caught); liquid glass chrome + MMKV resume verified
  on-device; store-prep notes in mobile/README.md. gradle assembleDebug +
  xcodebuild + tsc + both metro bundles green
  ([task file](./mobile-device-polish.md)).

- Round three (completed 2026-07-19): TTN v2 - timed games append a
  per-move clock track (3-char base36 deciseconds), encoded by the engine
  and decoded by all three decoders (server/web/mobile), replay viewer
  shows per-move think times; web polish pass completed - og.png unfurl
  image + per-route titles + 12x12-on-a-phone board sizing + lowercase
  copy pass + label/input association, Lighthouse on deployed dev:
  accessibility 100, performance 95-97, best-practices 100
  ([task file](./web-polish-a11y-pass.md)); the learning playground -
  behavior cloning from TTN + engine self-play with symmetry-canonical
  states, evals 93.5% W vs random / 0 losses vs greedy, seated live as the
  `cloney` SDK robot ([task file](./ml-playground.md)). Server 76/76,
  web 9/9, sdk+mobile tsc, both metro bundles, redeployed to dev.

- Round two (completed 2026-07-18): residents claim their handles
  (leaderboards name rando/greedo/minnie-max); named-robot matchmaking
  (REQUEST_ROBOT robotName + robot roster in LIST_GAMES + web picker,
  e2e-proven on deployed dev); full mobile parity - feedback banner with
  error copy, welcome + one-tap robot game, help/sync modal (share code +
  paste import), enter-to-claim handles, ghost purge, on-device TTN replay
  stepper; small-screen game-first ordering. Server 72/72, web 7/7, both
  metro bundles green, redeployed to dev.

- Mega build (completed 2026-07-18): resident robots in-process (+robot
  always answers, e2e-proven on deployed dev); bun:sqlite database - player
  identities (sha256 keys), unique claimed handles (enter-to-claim), game
  archive with TTN, Elo pools, HTTP API (/leaderboard, /games/:id,
  /players/:id[/games]); rate limiting + origin allowlist; terminal status
  feed with copy for every error incl. ghost-game purge; welcome panel with
  one-click robot match; ? help overlay with QR device sync (/sync#key);
  replay viewer (/replay/<ttn>, arrow keys, shareable); leaderboard rail;
  keyboard-playable board + aria + reduced-motion + OG meta. Server 68/68,
  web 7/7, deployed + verified on dev (handle->resident game->Elo).

- Vercel dev deployment: projects tici-taca-toey-web + tici-taca-toey-server
  (untouched everything else), dev custom environments tracking main,
  container server live with websockets, web wired via TTT_SERVER_URL,
  full game verified on the deployed stack; production-branch=release and
  domains documented for cutover
  ([task file](./vercel-dev-deployment.md)) (completed 2026-07-18)

- Post-launch fixes: the production leaderboard was empty because
  `getServerHttpBase` kept the socket's `/ws` path, so `/api/*` fetches
  missed - now takes the origin. Also: history/player cards no longer
  overflow, starting a game from a browse page redirects to it, a
  spectator can take an open seat (upgrade to player), and a player can
  forfeit ("gg"). ([task file](./post-launch-fixes.md)) (completed 2026-07-23)

- Standings, public games, and polish: a sortable **leaderboard page**
  where every row opens that player's games and any game replays;
  **public games** - a game is private until its host opens it, then
  strangers can take a seat from the lobby; **default handles** in the
  house style so nobody is "anonymous" and every row is clickable;
  **agent badges** distinguishing MCP-connected AI from SDK robots; and
  **move animations** plus live-game activity in the lobby. Web and
  mobile ([task file](./browse-and-public-games.md)). Also fixed: a board
  that could overflow its column and slide under the rail, a client route
  shadowed by an API path of the same name (read API now under `/api/`),
  and a production 500 from a database predating the new schema - it now
  migrates itself. (completed 2026-07-23)

- Game variants, ratings, and history: four features shipped together
  across server, web, and mobile ([variants](./game-variants.md),
  [ratings](./difficulty-elo.md), [history](./game-history.md)).
  **Multiple win sequences** (e.g. four length-2 sequences on a 12x12) and
  **teams** (sequences may combine teammates' marks) are new game variants
  whose rules live once in `shared/rules.ts`; TTN v3 records them.
  **Difficulty-weighted Elo** adds a headline `global` pool where the
  K-factor scales with how hard the configuration is, alongside the
  per-config pools. **Personal game history** lists your finished games
  with one-click replay, served over the websocket. Also: the leaderboard
  no longer exposes player ids, and the `/players/*` and `/games/:id`
  endpoints are gone (history moved to the socket). Robots are
  variant-aware. (completed 2026-07-23)

- MCP over streamable HTTP: the game server serves `/mcp` itself, so an
  agent connects with a URL and no local install. A session is an
  in-process player; `shared/mcp.ts` holds the one tool contract both
  transports serve. 6 e2e tests drive the endpoint like an agent,
  including a full game against a resident robot. (completed 2026-07-23)

- Deep-link blank page and UI fixes: absolute asset paths (v1.0.2), logo
  returns home, no spurious error when a game ends, centred sync QR,
  crop-safe OG image (v1.0.3). (completed 2026-07-23)

- Liveness watchdog: restarts the unit after two consecutive /health
  misses, closing the wedged-but-running gap (v1.0.1). (completed 2026-07-23)
