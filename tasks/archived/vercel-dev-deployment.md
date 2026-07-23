# Vercel deployment: two projects, dev + Production environments

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Medium - infra, no product code
**Created:** 2026-07-18 08:23 IST
**Completed:** 2026-07-18 09:01 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Host tici-taca-toey on Vercel: the web app as a static Vercel project and
the websocket server as a **container-image function** (Vercel now supports
Dockerfile-built functions). Two new Vercel projects only - no existing
Vercel project may be touched. A custom environment named `dev` (tracking
the `main` branch) is separate from Production (targeting a `release`
branch). First milestone: the full game running on the `dev` environment.

## Design Decisions

- **Two projects**: one for `web/` (static output, SPA rewrite so
  `/play/<id>` deep links resolve), one for `server/` (container built from
  `server/Dockerfile`). Names chosen to not collide with any existing
  project in the account.
- **Environments**: custom environment `dev` on both projects, branch
  tracking `main`; the Production environment targets a `release` branch.
  Promotion = merging main into release. CLI deploys use
  `vercel deploy --target=dev` and upload the local tree, so dev deploys
  do not depend on pushed git state.
- **Server URL wiring**: the server's dev deployment gets a stable alias;
  the web project's dev environment sets `TTT_SERVER_URL=wss://<alias>` so
  the build inlines it (`bun build --env 'TTT_*'`).
- **Known limitation (documented, accepted for dev)**: game state is
  in-memory in one process. If the platform runs multiple container
  instances, players could land on different game universes; scale/
  concurrency settings are pinned as far as the platform allows, and the
  durable fix (or a different always-on host for Production) is a
  Production-cutover decision.
- `.vercel/` link directories are gitignored; project settings that the CLI
  cannot express are documented in `DEPLOYMENT.md` as exact dashboard steps.

## Scope

- [x] Read the container-images + custom-environments docs; confirm
      websocket support and config schema before writing any config.
- [x] Inventory existing Vercel projects (read-only) to pick non-colliding
      names; create the two new projects.
- [x] Create the `dev` custom environment on both projects (branch tracking
      `main`); set Production branch to `release` (CLI or documented
      dashboard step).
- [x] Server: vercel.json + Dockerfile adjustments as the docs require;
      deploy to dev; verify `/health` and a real websocket game against the
      deployed URL; stable alias.
- [x] Web: vercel.json (SPA rewrites); `TTT_SERVER_URL` env in dev; deploy
      to dev; verify the deployed page connects and plays.
- [x] Rewrite `DEPLOYMENT.md` around Vercel (environments, promotion flow,
      limitations, rollback), keeping the zero/low-cost alternatives as an
      appendix.
- [x] Update `TODO.md` / this file with results and the production-cutover
      follow-ups (release branch creation, domains, robot fleet hosting).

## Open Questions

- Do Vercel container functions support WebSockets, and what scaling
  controls exist? Resolve from the docs before deploying - if websockets
  are unsupported, stop and report rather than shipping a broken server.
- Custom environment creation via CLI vs REST vs dashboard - use the most
  CLI-native path available in the installed CLI version.

## Files Likely To Change

`server/vercel.json` (new), `web/vercel.json` (new), `server/Dockerfile`,
`.gitignore`, `DEPLOYMENT.md`, `TODO.md`.

## Recovery Hints

`vercel project ls` shows what got created; `.vercel/project.json` inside
`server/` and `web/` shows the links. `vercel ls <project>` lists
deployments. Nothing outside the two new projects may be modified.

## Checkpoints

- 2026-07-18 08:23 IST - Task created; execution starting now.
- 2026-07-18 08:50 IST - Docs read (container-images, websockets, services,
  environments): websockets supported on Fluid; containers via
  Dockerfile.vercel; no instance-count controls exist. Projects
  `tici-taca-toey-server` + `tici-taca-toey-web` created (no collisions
  with the team's 8 existing projects, which were not touched). `dev`
  custom environments created on both via the documented REST endpoint with
  branchMatcher=main; deployment protection disabled (public game);
  production-branch=release recorded as a dashboard step post-git-connect
  (API rejects it standalone). Server: Dockerfile.vercel + services
  vercel.json (plain CLI deploy silently skipped the container - the
  explicit `services`/`runtime: container` config was required), PORT=8080
  env all targets, TTN_LOG=off dev; buildah built + pushed to VCR; /health
  200 on the stable dev alias; full websocket game SMOKE_PASS against
  wss://...env-dev... incl. notation + LIST_GAMES. Web: vercel.json (bun
  build, SPA rewrite), TTT_SERVER_URL dev env var; found + fixed a real
  client bug (the June `typeof process` guard survived into bundles and
  discarded the inlined server URL -> production builds always fell back to
  same-origin /ws; now a bare process.env read in try/catch, inlining
  verified in the deployed bundle); deep links 200, app connects. Live
  finding: with 2+ warm instances, new connections round-robin away from
  the game-holding instance (even from the same page), making joins a
  lottery and confirming the shared-state cutover work; DEPLOYMENT.md
  rewritten around Vercel with limitations + fallback appendix.
- 2026-07-18 09:01 IST - Final proof: after letting the test-storm instances scale
  in, a complete game was played through the deployed web UI against the
  deployed server on dev (subbu clicking the real board, trinity joining
  over wss, GAME_ENDS_IN_A_DRAW, notation 1.3.3.2.u.060805020001070304.d)
  - screenshot taken. DEPLOYMENT.md rewritten; ghost-game UX edge filed
  into the terminal-feedback task; server suite 60/60 (one timing flake
  observed once and noted), web tests/build green. Completed.
