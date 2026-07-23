# Bare React Native app (com.ticitacatoey)

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Large - new platform
**Created:** 2026-06-10 13:36 IST
**Completed:** 2026-06-11 04:58 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

A vanilla React Native app (no Expo, no navigation framework, minimal
dependencies) that lets people play tici-taca-toey on their phones, with the
terminal/matrix styling matching the web app. Package id `com.ticitacatoey`
(we own ticitacatoey.com).

## Design Decisions

- Scaffold with `@react-native-community/cli init` (bare template), app name
  `TiciTacaToey`, package `com.ticitacatoey`, then strip boilerplate. The
  cli-generated `android/` and `ios/` projects are checked in as-is - that
  is what "bare React Native" means; they are not dependencies.
- Runtime dependencies: `react` and `react-native` only. No navigation
  library - the app is a single-screen state machine (lobby <-> game), like
  the web app's conditional rendering.
- `mobile/` stays **out** of the Bun workspace (Metro wants its own
  node_modules layout); it has its own package.json. Bun is still the
  package manager.
- Protocol code is a small copy of the web client's `model.ts`, `socket.ts`
  (React Native has WebSocket built in), and the store (React Native ships
  React 19, so `useSyncExternalStore` works unchanged). Reconnect + resume
  via the same playerKey design, persisted with a tiny AsyncStorage-free
  file-based helper... resolved: use the simplest durable option with zero
  deps - `react-native`'s built-in nothing - so we keep the key in memory
  per session for v1 and note AsyncStorage as a follow-up. (Do not add a
  storage dependency without asking.)
- Styling: `StyleSheet` objects mirroring `app.css` variables (same hex
  palette), monospace via `Menlo` (iOS) / `monospace` (Android).
- Server URL: dev defaults to `ws://10.0.2.2:8080` on Android emulator,
  `ws://localhost:8080` on iOS sim, `wss://play.ticitacatoey.com` in release
  builds (constant in `src/config.ts`).
- Headless verification (no Xcode/Android SDK in the loop): TypeScript
  check + `react-native bundle` for both platforms proves the JS app
  compiles and resolves. Device builds are a manual step documented in
  `mobile/README.md`.

## Scope

- [x] Scaffold bare RN app into `mobile/` with package id com.ticitacatoey.
- [x] Strip template boilerplate; minimal deps.
- [x] Port model/socket/store; build lobby (handle, start, join) and game
      (board, players, clocks, status) screens; share link via RN Share API.
- [x] Terminal styles matching the web palette.
- [x] Headless verification: tsc + metro bundle (android + ios entry).
- [x] `mobile/README.md`: how to run on device/simulator, build release.
- [x] Root docs: repository map + verification sections.

## Open Questions

- Persistent playerKey storage without a dependency? v1 ships in-memory
  (resume works across network blips, not app restarts); AsyncStorage or
  MMKV is a follow-up decision for the user.

## Files Likely To Change

`mobile/` (new tree), root `claude.md`, `README.md`.

## Recovery Hints

If `mobile/` exists but is half-ported, run `cd mobile && bunx tsc --noEmit`
and `bun run bundle:android` - the gaps will show. The web app is the
behavioral reference; keep screens 1:1 with its features.

## Checkpoints

- 2026-06-10 13:36 IST - Task created.
- 2026-06-10 18:30 IST - Scaffolded bare RN 0.86 app (com.ticitacatoey) via
  @react-native-community/cli; stripped to react + react-native only;
  ported model + condensed store/socket (src/state.ts); built lobby + game
  screens with terminal StyleSheets, clocks, + robot, share; config per
  platform. mobile/README.md written.
- 2026-06-11 04:58 IST - Headless verification green: tsc clean, metro release bundles
  build for android and ios (~900 KB each). Device builds documented as
  manual (Xcode / Android SDK). playerKey persistence across app restarts
  tracked as Pending. Completed.
