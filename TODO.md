# TODO

Operational task tracker. See [`claude.md`](./claude.md) for the workflow and
[`tasks/claude.md`](./tasks/claude.md) for task-file rules.

**Mission**: a delightful, learning, production-ready app - no sharp edges,
exquisite taste in design.

## In progress

- **Publish the mobile app** to the App Store and Play Store
  ([task file](./tasks/mobile-store-launch.md)). The app and both
  projects are now submission-ready as far as code can take them: iOS
  has its Associated Domains entitlement, an icon the store accepts and
  the export-compliance key; Android release builds sign with an upload
  key read from outside the repo; the listing copy and console answers
  are in [`mobile/store/listing.md`](./mobile/store/listing.md).
  Screenshots for all three device classes and the Play artwork are
  captured. Waiting on, all account-side: the **Android upload
  keystore** and the Play app-signing fingerprint (then
  `assetlinks.json`), **iOS Distribution signing**, the two console app
  records, and the privacy answers. It ships universal. Splash and
  launcher-icon fixes are tagged **v1.14.1** (build 7), which is what
  the store builds are cut from.
  Last checkpoint: 2026-11-24 16:01 IST.

## Pending

- (nothing)

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
