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
- Navigation is React Navigation, declared in `App.tsx`: a native stack
  over a **five-tab bar** (play / watch / daily / ranks / you). The tabs
  are the places you *are*; the stack holds the places you go into and
  come back from (a game, a replay, someone else's profile). The web
  reaches the leaderboard and the daily from a sidebar; a phone has a tab
  bar, so they live there and the lobby gets to be about playing.
  - **iOS** uses `createNativeBottomTabNavigator`
    (`@react-navigation/bottom-tabs/unstable`) - a real
    UITabBarController, so on iOS 26 the bar is Liquid Glass and comes
    with the system's switch animation, scroll-edge behavior and
    accessibility. Icons are SF Symbols: a system font, so no assets.
  - **Android** uses the JS `createBottomTabNavigator` from the same
    package. The native one draws a Material `BottomNavigationView`,
    which accepts only a bitmap for an icon and *silently collapses
    items that have none* - five PNGs at three densities, for an app
    whose identity is text. The JS bar takes a rendered element, so the
    icon is a monospace glyph and the bar wears the palette. Do not set a
    fixed `height` on it: it adds the gesture inset to its own padding,
    so pinning the height crushes the labels into the home indicator.
  - Screens, order, and labels are declared once in the `TABS` array and
    shared by both bars; only the icon differs.
- Deep links are React Navigation's `linking` config in `App.tsx` - one
  declaration covering cold start, warm arrival, and the back stack, not
  a `Linking` listener plus a regex. Paths match the web's routes where
  the web has one (`""`, `/daily`, `/leaderboard`, `/player/`,
  `/replay/`, `/play/`, `/spectate/`) so a `ticitacatoey.com` link means
  the same thing in a browser and in the app; `watch` and `me` are
  custom-scheme only, having no web page. Two things are load-bearing:
  `initialRouteName: "Tabs"` puts the tabs under any deep-linked stack
  screen, without which "< back" is a dead button; and `Game`'s
  deliberately loose `:mode/:gameId` does not shadow `replay/:ttn` or
  `player/:handle` because React Navigation ranks by specificity. A game
  link does not just show a screen, it seats you - `GameScreen` reads the
  params and calls `openGame`, which validates the mode and id itself.
  `AndroidManifest.xml`'s App Links filter must list any new path.
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
- Live cursors are **receive-only** here: a finger has no hover, so the
  app draws everyone else's ghosts (`CursorGhosts` in `GameScreen.tsx`,
  fed by `subscribeToCursors` in `state.ts`) and never sends a `CURSOR`.
  Presence stays out of the store for the same reason as on the web -
  reducing it would re-render every subscribed screen several times a
  second. Hosting a game with cursors public still works from the lobby
  form; the game header badges it. Who sees whom is the server's call,
  see `server/claude.md`.
- Rematch, post-game analysis, and the daily position mirror the web:
  `src/analysis.ts` and `src/daily.ts` are shims over `shared/`, so a
  replay annotates identically on both and the daily board is the same
  one everywhere on a given date. Turn alerts are web-only - a real
  notification here needs FCM/APNs, which is a service dependency this
  app has not taken.
- Move impact is `src/burst.tsx`: the web draws sparks on a canvas, which
  React Native does not have, and a graphics library is not a dependency
  this app will take. Instead a small fixed pool of `Animated` views run
  their whole flight as one native-driver timing animation, so JavaScript
  is not involved once a burst starts. Cells set `overflow: "visible"` -
  Android clips by default and would swallow the sparks.
- Verify: `bun run typecheck`, `bun run bundle:android`, `bun run
  bundle:ios` (headless); device builds are manual via Xcode/Android SDK.
