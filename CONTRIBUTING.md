# Contributing to Tici Taca Toey

Thanks for wanting to help. This is a small, deliberately dependency-light
project that is meant to keep running for decades, so contributions are
held to that bar: minimal, well-tested, and in keeping with the existing
style.

Read [`claude.md`](./claude.md) first - it is the operating contract for
the whole repository (the documentation map, the task system, and the
stability and personality rules). Each subtree has its own `claude.md`
(`server/`, `web/`, `mobile/`, `sdk/`, `mcp/`, `shared/`) that overrides the
root for that folder.

## Ground rules

- **Bun everywhere.** Never npm, yarn, or pnpm. Run Bun commands from inside
  the relevant folder (`server/`, `web/`, ...), not the repo root.
- **No new runtime dependencies** without discussion first. The server has
  **zero**; the web app has only `react` and `react-dom`; mobile has a short
  approved list (see [`mobile/claude.md`](./mobile/claude.md)). We hand-roll
  small things rather than pull a library - see `web/src/common/qr.tsx` for
  the spirit.
- **Smallest change that solves the problem.** Match the surrounding code's
  naming, comment density, and idioms.
- **The wire protocol lives in `shared/`.** A change there is a protocol
  change and must touch server, web, and mobile together, with tests.
- **Public repo hygiene.** Nothing that identifies a person or grants
  access may be committed. Configuration is env vars only.

## Before you open a pull request

Run the verification that applies to what you touched:

```bash
# server changes
cd server && bun run typecheck && bun test
cd server && bun run bench          # when you touch winner calculation

# web changes
cd web && bun run typecheck && bun test && bun run build

# sdk / robots / mcp / playground changes
cd sdk && bun run typecheck
bun test mcp                        # from the repo root, for mcp changes

# mobile changes
cd mobile && bun run typecheck && bun run bundle:android && bun run bundle:ios
```

A protocol change (anything in `shared/`) runs the **full** matrix above.

Every new validation rule or engine transition needs a test. The winner
calculation has a fuzz oracle in `server/test/winner.test.ts` - keep it
passing; it is the strongest correctness guarantee here.

## Commits and pull requests

- Branch off `main`; do not push to `main` directly (it is protected).
- Keep commits focused; write why, not just what.
- Fill in the pull request template. Describe the change, the verification
  you ran, and any protocol impact.
- CI must be green. The release workflow also guards against relative asset
  paths in the web build (a real bug we shipped once).

## Branch protection (for maintainers)

The `main` branch should be protected with, at minimum:

- **Require a pull request before merging** (no direct pushes), with at
  least **1 approving review**.
- **Require status checks to pass before merging**, and require branches to
  be up to date. Select the CI checks (the `main` workflow's test jobs).
- **Require conversation resolution before merging.**
- **Do not allow force pushes** or **deletions** of `main`.
- Optionally **require signed commits** and **linear history**.

Set these under *Settings -> Branches -> Branch protection rules* (or
*Rulesets*) on GitHub. Releases are cut from tags, and the release workflow
builds and attaches the artifact the production box installs - so a
protected `main` plus tag-triggered releases keeps the deploy path honest.

## Reporting bugs and requesting features

Use the issue templates (bug report / feature request). For anything
security-sensitive, please **do not** open a public issue - see
[`SECURITY.md`](./SECURITY.md).

## Good first contributions

- A new reference robot in `robots/` on top of the SDK.
- A new learning approach in `playground/`.
- Accessibility and copy improvements in `web/` and `mobile/`.
- Documentation fixes - stale docs are worse than missing docs.
