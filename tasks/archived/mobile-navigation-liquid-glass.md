# Mobile: navigation, MMKV persistence, iOS liquid glass chrome

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Medium-large - new native dependencies
**Created:** 2026-06-13 06:31 IST
**Completed:** 2026-06-13 07:00 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Give the mobile app real navigation and durable identity. Approved
dependencies (explicit user approval): React Navigation (with
`react-native-screens`), `react-native-mmkv`, and
`@callstack/liquid-glass`. On iOS the app-level chrome (bottom tab bar and
app-level controls) uses liquid glass; the game surface itself keeps the
hacker/terminal look.

## Design Decisions

- **Interpretation:** "react-native-navigation & react-native-screens" =
  the React Navigation stack (`@react-navigation/native` +
  `@react-navigation/bottom-tabs` + `react-native-screens` +
  `react-native-safe-area-context`), which is what react-native-screens
  pairs with. Recorded here in case Wix RNN was meant instead.
- **Tabs:** `play` (lobby: start/join + your games), `watch` (live games
  lobby for spectating), `game` opens from either list (native stack inside
  the play tab... resolved: single stack navigator wrapping a tab navigator;
  the Game screen is pushed on the root stack so it overlays tabs).
- **Liquid glass:** custom tab bar component using
  `@callstack/liquid-glass` (`LiquidGlassView` + container) on iOS 26+,
  falling back automatically to the flat dark terminal bar on Android and
  older iOS (the library exports an `isLiquidGlassSupported` flag). Same
  for app-level floating controls (back/share on the game screen). The
  board, cells, clocks, and player cards stay pure terminal - no glass on
  the game itself.
- **MMKV:** playerKey + handle persisted via `react-native-mmkv`, closing
  the "resume across app restarts" gap. Storage is synchronous so identity
  is ready before the first socket connect.
- **Verification:** headless only - tsc + metro release bundles for both
  platforms. Pod install / native builds remain manual (documented in
  mobile/README.md); the liquid glass visuals need a real iOS 26 device or
  simulator to eyeball.

## Scope

- [x] Add deps: @react-navigation/native, @react-navigation/bottom-tabs,
      react-native-screens, react-native-safe-area-context,
      react-native-mmkv, @callstack/liquid-glass.
- [x] MMKV-backed identity (playerKey + handle) in src/state.ts.
- [x] Restructure App into navigator: tabs (play, watch) + pushed game
      screen; screens split into src/screens/.
- [x] Liquid glass tab bar + game-screen floating controls on iOS with
      terminal fallback elsewhere.
- [x] Watch tab: LIST_GAMES polling + spectate, mirroring the web rail.
- [x] Win/loss perspective + avatars to stay in sync with web.
- [x] Headless verification: tsc + bundle:android + bundle:ios; update
      mobile/README.md (pod install note for the new native deps).

## Open Questions

- Wix react-native-navigation instead of React Navigation? Resolved as
  above unless the user corrects.

## Files Likely To Change

`mobile/package.json`, `mobile/App.tsx`, `mobile/src/**` (new screens/),
`mobile/README.md`, `mobile/ios` & `mobile/android` (autolinking only).

## Recovery Hints

If half-done: `cd mobile && bunx tsc --noEmit && bun run bundle:android`
shows the gaps. Native side needs `bundle exec pod install` in ios/ after
dependency changes - that step is manual.

## Checkpoints

- 2026-06-13 06:31 IST - Task created.
- 2026-06-13 06:55 IST - Deps added (React Navigation native/bottom-tabs/
  native-stack, react-native-screens, safe-area-context, react-native-mmkv
  v4 via createMMKV, @callstack/liquid-glass 0.8). App restructured:
  tab navigator (play/watch) under a root stack with the game screen pushed
  on top; custom GlassTabBar + GlassPill controls (liquid glass on iOS 26+,
  terminal fallback via isLiquidGlassSupported); MMKV-persisted playerKey +
  handle (resume across app restarts); watch tab with LIST_GAMES lobby;
  avatars + viewer-perspective status ported to src/theme.ts.
- 2026-06-13 07:00 IST - Headless verification green: tsc clean, metro release bundles
  build for android and ios (~1.25 MB with navigation). Native builds and
  liquid glass visuals need Xcode 26 / device - documented as manual in
  mobile/README.md (pod install required after the new native deps).
  Completed.
