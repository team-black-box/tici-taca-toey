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
- Verify: `bun run typecheck`, `bun run bundle:android`, `bun run
  bundle:ios` (headless); device builds are manual via Xcode/Android SDK.
