# Mobile App Instructions

This file governs work inside `mobile/`. The root
[`claude.md`](../claude.md) applies - especially the approved-dependencies
rule (ask before adding any). `README.md` here covers setup, icons/splash/
deep links, and store prep.

- Bare React Native, package `com.ticitacatoey`. Not part of the Bun
  workspace: run `bun install` inside this folder; Metro owns its own
  node_modules.
- `src/model.ts` and `src/ttn.ts` are thin shims over `shared/`
  (the single protocol source), reached via metro `watchFolders`.
- Persistence is `src/storage.ts`, a thin wrapper over AsyncStorage.
  React Native has no cross-platform storage in core (`Settings` is
  iOS-only), so this is the one dependency taken for something the web
  gets free from localStorage. **AsyncStorage over MMKV on purpose**:
  one autolinking package, versus MMKV v3+ which also needs
  react-native-nitro-modules as a direct dependency plus native setup -
  the wrong trade for a teaching app. Reads are async, so identity loads
  once at bootstrap in `state.ts` before the first connect.
- `src/state.ts` condenses the web client's store/socket/actions - the web
  app is the behavioral source of truth; keep them in sync. That includes
  the `history` slice (finished games from `MY_GAMES`), which feeds the
  lobby's history list and the `Replay` screen.
- `src/rules.ts` shims `shared/rules.ts` so the board, the team grouping,
  and the sequence counters use the same rules the server scores with.
- The game surface is always the terminal look; only app-level chrome may
  be platform-fancy. Palette mirrors `web/src/styles/app.css` variables
  via `src/theme.ts`.
- Browse screens mirror the web: `LeaderboardScreen` (sortable standings,
  horizontally scrollable table) and `PlayerScreen` (anyone's finished
  games, by public handle) feed `ReplayScreen`. They read the server's
  `/api/*` endpoints via helpers in `state.ts` rather than the socket,
  since none of it is live data.
- `ReplayScreen` shows the goal (`describeGoal`, the same words the game
  header used) and a seat legend saying who was which symbol. A TTN line
  carries seats and moves but never names, so the roster travels as an
  optional `roster` route param, handed over by whoever already knew it -
  the lobby history list, `PlayerScreen`. The web does the same thing
  through a query string; without a roster both fall back to "seat 1".
- Machines are badged with a text mark rather than an icon (the terminal
  look is text): gear for an SDK robot, spark for an MCP agent - see
  `kindMark` in `theme.ts`.
- Move impact is `src/burst.tsx`: the web draws sparks on a canvas, which
  React Native does not have, and a graphics library is not a dependency
  this app will take. Instead a small fixed pool of `Animated` views run
  their whole flight as one native-driver timing animation, so JavaScript
  is not involved once a burst starts. Cells set `overflow: "visible"` -
  Android clips by default and would swallow the sparks.
- Verify: `bun run typecheck`, `bun run bundle:android`, `bun run
  bundle:ios` (headless); device builds are manual via Xcode/Android SDK.
