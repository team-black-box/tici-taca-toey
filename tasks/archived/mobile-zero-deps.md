# Mobile minimalism: drop MMKV + liquid-glass deps

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium (native storage module + glass rewrite)
**Created:** 2026-07-20 13:02 IST
**Completed:** 2026-07-20 13:18 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Remove react-native-mmkv (+ its react-native-nitro-modules companion) and
@callstack/liquid-glass. Identity storage becomes a ~40-line hand-rolled
native module (SharedPreferences / UserDefaults) in the spirit of the QR
encoder; the glass chrome becomes plain translucent styled components -
less rounded per the user's taste, and identical cross-platform.

## Scope

- [x] `TTTStorage` native module: Kotlin (SharedPreferences) + Swift
      (UserDefaults) + JS wrapper with async load; registered in
      MainApplication / bridging setup.
- [x] `src/state.ts`: async identity load before first connect (was
      synchronous MMKV).
- [x] `src/glass.tsx`: hand-rolled tab bar + pills (translucent panels,
      borderRadius ~12), no platform branching, delete the dependency.
- [x] package.json: remove react-native-mmkv, react-native-nitro-modules,
      @callstack/liquid-glass; `bun install`; `pod install`.
- [x] Verify: tsc, both metro bundles, gradle assembleDebug, xcodebuild +
      simulator relaunch (identity must survive an app restart).
- [x] Docs: mobile/README + mobile/claude.md dependency list, root
      claude.md approved-deps rule.

## Open Questions

None - explicit user request 2026-07-20 (including "less rounded").

## Files Likely To Change

`mobile/android/app/src/main/java/com/ticitacatoey/*`,
`mobile/ios/TiciTacaToey/*`, `mobile/src/{state.ts,glass.tsx}`,
`mobile/package.json`, `mobile/ios/Podfile.lock`, docs.

## Recovery Hints

`bun run typecheck` + `bun run bundle:ios` inside mobile/ localize JS
breakage; a failed pod install means the dependency removal half-landed.

## Checkpoints

- 2026-07-20 13:02 IST - Plan written.
- 2026-07-20 13:18 IST - Completed. Deps are exactly react, react-native,
  and React Navigation (+screens/safe-area-context) - MMKV, nitro-modules,
  and liquid-glass removed (pods 81 -> 77). storage.ts: core Settings on
  iOS, hand-rolled TTTStorageModule.kt (SharedPreferences) on Android;
  state.ts loads identity async at bootstrap before first connect.
  glass.tsx: hand-rolled translucent chrome, borderRadius 12/10 (less
  rounded), identical cross-platform. Verified: tsc, both bundles, gradle
  assembleDebug (compiles the Kotlin), xcodebuild, and on-simulator proof
  that a name set before a cold relaunch is restored after it (NSUserDefaults
  round trip). Android storage module compiles; a live Android run stays
  with the existing manual-hardware follow-up.
- 2026-07-23 11:05 IST - Revisited on the user's call: the hand-rolled
  Android storage module was replaced with
  `@react-native-async-storage/async-storage`. Rationale - this is a
  teaching app, and a native module is a barrier for beginners; RN core
  has no cross-platform storage (`Settings` is iOS-only, no-op fallback on
  Android), so a library is genuinely required. AsyncStorage beats MMKV
  here: one autolinking package versus MMKV v3+ needing
  react-native-nitro-modules as a direct dependency - the exact pod
  failure hit earlier in this session. TTTStorageModule.kt /
  TTTStoragePackage.kt deleted, MainApplication reverted, storage.ts now a
  6-line wrapper. Deps: react, react-native, React Navigation
  (+screens/safe-area-context), async-storage. Verified: tsc, both metro
  bundles, pod install (78 pods), gradle assembleDebug SUCCESSFUL.
  On-simulator run not repeated - the host's Xcode dropped its iOS 26.5
  runtime mid-session (only 27.0 present) and xcodebuild now enumerates no
  simulator destinations; needs `sudo xcodebuild -runFirstLaunch` or a
  platform reinstall on the user's machine.
