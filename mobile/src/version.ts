// Which release this build is, so "what version are you on?" has an
// answer during support - the same question the web footer and /health
// answer for the server.
//
// The web can inline this at build time (`bun build --env 'TTT_*'`);
// metro has no equivalent and React Native core exposes no app version
// without a native module, which is a dependency this app will not take
// for one string. So it is a constant, and it has to be bumped alongside
// the two native versions:
//
//   - `android/app/build.gradle`   -> versionName
//   - `ios/.../project.pbxproj`    -> MARKETING_VERSION
//
// `bun run check:versions` fails when the three disagree, so the drift
// that would otherwise ship is caught before it does.
export const APP_VERSION = "1.12.2";

// Where the legal pages live. Both stores require a reachable privacy
// policy, and these are the same documents the web footer links to.
export const PRIVACY_URL = "https://ticitacatoey.com/privacy.html";
export const TERMS_URL = "https://ticitacatoey.com/terms.html";
