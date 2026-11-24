# TODO

Operational task tracker. See [`claude.md`](./claude.md) for the workflow and
[`tasks/claude.md`](./tasks/claude.md) for task-file rules.

**Mission**: a delightful, learning, production-ready app - no sharp edges,
exquisite taste in design.

## In progress

- (nothing)

## Pending

- **Publish the mobile app** to the App Store and Play Store
  ([task file](./tasks/mobile-store-launch.md)). The code side is done:
  server-minted playerKey, privacy/terms/version in the app, versions
  tracking the repo tag, help at parity with the web, run and played on
  both an iOS simulator and an Android emulator, Universal Links live,
  and navigation rebuilt on React Navigation (Liquid Glass native tabs
  on iOS, JS tabs on Android, one declarative deep-link config verified
  on both). What is left is all account-side and yours: an **Android
  release keystore** (release builds are still debug-signed, and its
  SHA-256 is what `assetlinks.json` needs, so App Links stay dead until
  it exists), **iOS Distribution signing**, and the store listings and
  submission. Submitting happens from the second MacBook with the
  released Xcode 26.6, since Apple rejects a beta-built archive.
  Absorbs the two older mobile bullets (playerKey CSPRNG, device pass).

## Completed

- Dependency refresh ahead of the store submission (2026-11-24): every
  package on its latest - React 19.3, TypeScript 7, React Native 0.88.1 -
  except where React Native pins its own toolchain (React 19.3.0, Babel 7,
  CLI 20.2). The upgrade broke one thing nothing headless would have
  caught: 0.88 turns the old `RCTLinkingManager.application(...)` calls
  into silent no-ops in a scene app, so **every deep link on iOS had
  stopped navigating**. Moved to the scene APIs and re-verified warm and
  cold. Both platforms built, launched and played against production
  (Android on a recreated Pixel 9 Pro emulator, API 35).
  Details in the [task file](./tasks/mobile-store-launch.md).

Older completed work is in
[`tasks/archived/todo.md`](./tasks/archived/todo.md).
