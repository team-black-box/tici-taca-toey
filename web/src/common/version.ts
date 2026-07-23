// Which release this bundle is, so "what is live?" is answerable from the
// page itself. Bun's --env 'TTT_*' inlines this at build time, so it must
// be a bare `process.env.TTT_VERSION` reference (no destructuring, no
// dynamic key) for the substitution to happen. Unset in dev - a local
// build is not a release.
export const APP_VERSION: string = process.env.TTT_VERSION || "dev";

export const RELEASE_URL = APP_VERSION.startsWith("v")
  ? `https://github.com/team-black-box/tici-taca-toey/releases/tag/${APP_VERSION}`
  : "https://github.com/team-black-box/tici-taca-toey";
