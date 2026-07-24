// Which release this bundle is, so "what is live?" is answerable from the
// page itself. Bun's --env 'TTT_*' inlines this at build time, so it must
// be a bare `process.env.TTT_VERSION` reference (no destructuring, no
// dynamic key) for the substitution to happen. Unset in dev - a local
// build is not a release.
//
// The try/catch is what makes `bun run dev` work: the dev server does not
// pass --env, so nothing rewrites the reference, and a browser has no
// `process` - the bare read reaches runtime and throws ReferenceError,
// taking the whole app down with it. Guarding with `typeof process` would
// not do: after substitution there is no `process` left to test, so the
// guard would be false in production and every build would report "dev".
let version = "dev";
try {
  version = process.env.TTT_VERSION || "dev";
} catch {
  // No build-time substitution and no process: a local build, not a release.
}

export const APP_VERSION: string = version;

export const RELEASE_URL = APP_VERSION.startsWith("v")
  ? `https://github.com/team-black-box/tici-taca-toey/releases/tag/${APP_VERSION}`
  : "https://github.com/team-black-box/tici-taca-toey";
