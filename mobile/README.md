# Tici Taca Toey Mobile

A bare React Native app (no Expo). Package id: `com.ticitacatoey`.

Runtime dependencies (each explicitly approved): `react`, `react-native`,
React Navigation (`@react-navigation/native` + `bottom-tabs` +
`native-stack`, with `react-native-screens` and
`react-native-safe-area-context`), and
`@react-native-async-storage/async-storage` for the durable playerKey.

That last one is the only dependency taken for something the web gets
free: React Native has no cross-platform storage in core (`Settings` is
iOS-only). **AsyncStorage rather than MMKV deliberately** - it is a single
autolinking package, where MMKV v3+ additionally requires
`react-native-nitro-modules` as a direct dependency and the native setup
that comes with it. For a learning app, one `bun add` beats a native
module. The floating chrome stays hand-rolled in `src/glass.tsx`.

Structure: a bottom tab navigator (`play` = lobby + your games, `watch` =
live games to spectate) with the game screen pushed on top. The floating
chrome (tab bar, back/invite pills) is hand-rolled translucent panels with
neon borders - the same on every platform. The game surface is always the
hacker/terminal look.

## Develop

```bash
bun install
cd ios && pod install && cd ..   # after any native dep change
bun run start          # metro

# in another terminal, with the game server running on :8080
bun run ios            # iOS simulator
bun run android        # Android emulator (needs Android SDK)
```

CocoaPods needs a UTF-8 locale; if `pod install` dies with an
`Encoding::CompatibilityError`, run it with
`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`. (`bundle exec pod` also
works if the `Gemfile` bundle has CocoaPods installed; plain `pod` is fine
with a global install.)

The dev build talks to `ws://localhost:8080` (iOS) / `ws://10.0.2.2:8080`
(Android emulator); release builds talk to `wss://ticitacatoey.com` - see
`src/config.ts`. To test on a physical device in dev, point the `__DEV__`
branch of `SERVER_URL` at your laptop's LAN IP (the dev server binds
0.0.0.0).

## Icons, splash, deep links

- App icon: the neon grid mark, rasterized from the logo SVG
  (`web/public/favicon.svg` is the source of truth) into
  `ios/.../AppIcon.appiconset` (universal 1024) and the Android
  `mipmap-*` densities. Regenerate with `qlmanage -t -s <px>` + `sips`
  if the mark changes.
- Splash: near-black (#050905, = `C.bg`) with the centered mark on both
  platforms - iOS `LaunchScreen.storyboard` + `SplashLogo.imageset`,
  Android `drawable/launch_screen.xml` set as `android:windowBackground`
  in `values/styles.xml`. No white flash anywhere.
- Deep links: `ticitacatoey://play/<id>` and `ticitacatoey://spectate/<id>`
  work today (scheme registered in `Info.plist` and the Android manifest);
  `App.tsx` routes both cold-start and warm URLs through
  `openGameLink` in `src/state.ts`, which queues until the socket
  registers, then joins/spectates - navigation follows the active game.
  The `https://ticitacatoey.com/...` variants are wired in the Android
  manifest (`autoVerify`) but only go live at production cutover, which
  must serve `/.well-known/assetlinks.json` (release-cert SHA-256) and
  `/.well-known/apple-app-site-association` + add the
  `applinks:ticitacatoey.com` Associated Domains entitlement in Xcode.

## Store prep (when we decide to submit)

- Versioning: bump `MARKETING_VERSION` (iOS) and
  `versionName`/`versionCode` (`android/app/build.gradle`) together;
  keep them matching the git tag.
- Privacy: no tracking, no analytics, no PII off-device - the playerKey
  is a random secret in AsyncStorage that never leaves the device except
  as the hashed identity the server stores. `PrivacyInfo.xcprivacy` already
  declares no collection; Play Console's data-safety form should say the
  same.
- Signing: create a release keystore for Android (the checked-in
  `debug.keystore` is debug-only) and note its SHA-256 in
  `assetlinks.json` at cutover.
- Screenshots checklist: lobby with live games, a mid-game board with
  clocks, the replay stepper, the QR invite - dark terminal shots only.

## Headless verification (no Xcode / Android SDK)

```bash
bun run typecheck
bun run bundle:android   # metro release bundle
bun run bundle:ios
```

## Release

- Android: `cd android && ./gradlew assembleRelease` (set up signing first).
- iOS: open `ios/TiciTacaToey.xcworkspace` in Xcode after
  `bundle exec pod install`, then archive.

## Code map

- `App.tsx` - navigation shell (tabs + game stack, terminal nav theme).
- `src/screens/` - LobbyScreen, WatchScreen, GameScreen.
- `src/glass.tsx` - hand-rolled floating tab bar + pills (translucent
  panels, neon borders), identical on every platform.
- `src/storage.ts` - AsyncStorage wrapper holding the durable playerKey.
- `src/theme.ts` - palette, avatars, viewer-perspective status (mirror of
  the web's app.css / avatar.tsx / status.ts).
- `src/ui.tsx` - shared terminal widgets (fields, buttons, clocks, tiles).
- `src/state.ts` - the web client's store/socket/actions condensed into one
  file (identity loaded async at bootstrap). Keep behavior in sync with
  `web/src/state/`.
- `src/model.ts`, `src/ttn.ts` - thin shims over `shared/`, the single
  source of truth for the wire protocol.
- `src/config.ts` - server URLs per platform/build.
