# Mobile device polish: icons, deep links, on-device verification

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium
**Created:** 2026-07-18 08:23 IST
**Completed:** 2026-07-19 22:00 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

The mobile app runs but still wears React Native's default face. Make it
feel shipped: the neon grid mark as app icon and splash, game links that
open the app, and a real on-device verification pass (including the liquid
glass chrome on iOS 26).

## Scope

- [x] **App icons**: neon logo rendered via QuickLook SVG rasterization
      into the iOS universal 1024 AppIcon and Android legacy mipmaps
      (48-192 + round). Adaptive-icon layers and tinted/monochrome
      variants remain for the on-device pass.
- [x] **Splash**: near-black launch screen with the centered mark on both
      platforms (LaunchScreen.storyboard + SplashLogo imageset, verified
      with ibtool; Android launch_screen layer-list as windowBackground +
      status/nav bar colors). The iOS root view also paints terminal-black
      in AppDelegate so the JS-load phase never flashes white.
- [x] **Deep links**: `ticitacatoey://play/<id>` + `/spectate/<id>` proven
      on the iOS 26 simulator, warm AND cold start - the store queues the
      link until the socket registers, then joins/spectates and navigation
      follows the active game. Root-caused and fixed the missing
      `RCTLinkingManager` forwarding in AppDelegate (without it iOS drops
      the URL silently); universal-link hooks (`continue userActivity`) and
      Android https `autoVerify` filters staged - they go live at cutover
      with AASA/assetlinks + the Associated Domains entitlement.
- [x] **On-device pass** (iOS 26.5 sim, iPhone 17 Pro): liquid glass
      play/watch pills verified; deep-link joins into live games verified
      (warm + cold); MMKV resume verified across relaunch; found and fixed
      missing top safe-area insets on all three screens (headers sat under
      the Dynamic Island, untappable). Android: assembleDebug compiles the
      new resources/manifest (aapt2), but no emulator run - fallback
      chrome on a real Android device remains a manual follow-up, as does
      a phone build pointed at the Vercel dev URL.
- [x] **Store prep notes**: versioning, privacy stance (no tracking, no
      PII off-device), release-signing + assetlinks reminder, screenshots
      checklist - in mobile/README.md. Actual store submission stays a
      separate later decision.

## Open Questions

- Keep `wss://play.ticitacatoey.com` as the release server URL or move to
  the Vercel server domain? Decide when Production cutover happens.

## Files Likely To Change

`mobile/ios/**` (icons, launch, entitlements), `mobile/android/**`
(icons, manifest, assetlinks), `mobile/src/config.ts`,
`web/public/.well-known/` (AASA + assetlinks served by the web deploy),
`mobile/README.md`.

## Recovery Hints

If `mobile/ios/TiciTacaToey/Images.xcassets` still contains the default
AppIcon contents, the icon work has not landed.

## Checkpoints

- 2026-07-18 08:23 IST - Task created.
- 2026-07-19 09:55 IST - App icons installed (iOS universal 1024 + Android mipmaps) from the neon SVG via qlmanage+sips - no new tooling. Splash, deep links, and on-device verification remain.
- 2026-07-19 21:24 IST - Splash on both platforms (near-black + centered
  mark: LaunchScreen.storyboard rewrite verified with ibtool, SplashLogo
  imageset, Android launch_screen layer-list as windowBackground +
  status/nav bar colors). Deep links: ticitacatoey:// scheme in Info.plist
  + Android manifest, https app-link filters staged for cutover, store
  queues links until the socket registers then joins/spectates
  (openGameLink), App.tsx wires cold + warm URLs. Store-prep notes in
  mobile/README.md. tsc + both metro bundles + xmllint green; xcodebuild
  (iPhone 17 Pro sim) and gradle assembleDebug running.
- 2026-07-19 22:00 IST - On-device pass done and task completed. Both
  native builds green (gradle needs ANDROID_HOME=~/Library/Android/sdk).
  Fixed three real defects found only by running on the simulator:
  (1) screens ignored top safe-area insets - headers sat under the
  Dynamic Island (user-reported); (2) AppDelegate lacked RCTLinkingManager
  forwarding, so iOS dropped scheme URLs; (3) RN root view flashed white
  during JS load - painted terminal-black natively. Proof screenshots:
  liquid-glass chrome, warm deep-link join ("deep link proof" LIVE, both
  seats), cold-start deep-link join ("cold start proof" LIVE). Stale-Metro
  gotcha: version-mismatch redbox cured by restarting Metro with
  --reset-cache. Final: tsc + bundle:android + bundle:ios green.
