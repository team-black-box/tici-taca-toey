# Production cutover: one Hetzner box, one origin

**Status:** In progress
**Owner:** claude (code + docs) / Subramanian (box, DNS, Vercel deletion)
**Estimated effort:** Small code change + a provisioning session
**Created:** 2026-07-20 07:38 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Ship production on a single always-on Hetzner box: Caddy on 80/443, the
zero-dep Bun server on localhost serving the web app, websocket, and API
from one origin, sqlite + TTN on the box disk. This resolves the two parked
problems at once - durable storage AND the multi-instance state split that
made joins a lottery on auto-scaled platforms. Vercel is retired (decided
2026-07-19; user deletes the dashboard projects).

## Scope

Code and docs (done in-repo):

- [x] Same-origin static serving in the server: `src/static.ts`
      (`TTT_WEB_DIR`, SPA fallback, immutable caching for hashed assets,
      traversal-safe, never-die guarded) wired into `server.ts` behind the
      websocket upgrade; `HOST` env for localhost binding. 7 new tests
      (83/83), typecheck green.
- [x] Verified live: server on :8080 with `TTT_WEB_DIR=../web/dist` serves
      the app, same-origin websocket connects, leaderboard renders - no
      build-time URL anywhere.
- [x] Deploy artifacts in `deploy/`: Caddyfile (ticitacatoey.com + www
      redirect), hardened systemd unit (unprivileged user, 127.0.0.1 bind,
      ProtectSystem=strict, data/ only writable path), nightly backup
      script (sqlite .backup + games.ttn, 14-day retention).
- [x] Mobile release URL -> `wss://ticitacatoey.com`; og:image URLs ->
      `https://ticitacatoey.com/og.png`; server/web claude.md updated.
- [x] Provider decided: **Hetzner Cloud CX23** (2 vCPU, 4 GB, 40 GB SSD,
      20 TB traffic, Nuremberg, ~$8.50/mo all in). Alternatives compared
      on price, specs, and India latency; rationale in the DEPLOYMENT.md
      appendix.
- [x] Caps recalibrated for 4 GB: TTT_MAX_CONNECTIONS 2000 -> 6000,
      TTT_MAX_GAMES 1000 -> 3000, set in the systemd unit.
- [x] Release-based deploys: `.github/workflows/release.yml` builds and
      attaches `tici-taca-toey.tar.gz` (+ .sha256) on published releases,
      gated behind server + web tests; `deploy/deploy.sh` + systemd timer
      poll, checksum-verify, extract to `releases/<tag>/`, swap `current`,
      restart, health-check and **auto-roll-back** on failure.
- [x] Caddy restructured to `import /etc/caddy/sites/*.caddy` so the next
      project is a drop-in file, not an edit.
- [x] systemd unit moved to the releases layout: `current/server` working
      dir, absolute `TTN_LOG`/`TTT_DB` outside release dirs so deploys and
      rollbacks never touch game data; narrow sudoers for the restart.
- [x] `DEPLOYMENT.md` written as the box runbook: provisioning, firewall,
      swap step, deploy/rollback flow, security stance, costs, and an
      explicit "why not serverless" note (same failure mode as Vercel).
- [x] Verified the artifact end to end locally: packaged exactly as CI
      does (1.1 MB), extracted into a simulated box layout, ran the server
      from `current/`, confirmed app + SPA fallback + og.png + health +
      same-origin websocket, played a full robot game, and confirmed the
      TTN corpus landed in `data/` and is served by `/dataset`.
- [x] Fixed a bug that verification surfaced: `/dataset` 500'd on a fresh
      box because the TTN file does not exist until the first game ends -
      now returns an empty 200 (the daily mirror treats empty as no-op).

Provisioning (manual, from the DEPLOYMENT.md runbook):

- [x] Create the CX23 in Nuremberg (Ubuntu 26.04, IPv4 + IPv6, Backups on,
      SSH key attached, named `tbb-prod-1`).
- [x] Attach a Cloud Firewall: TCP 80/443 + 22 inbound, default-deny
      otherwise.
- [x] Harden SSH: key-only (`99-hardening.conf`), fail2ban, root password
      set as the console break-glass. Tailscale dropped - its free tier is
      personal-use only and this is a company box; WireGuard noted as the
      optional upgrade.
- [x] OS prep done on the box: swap + swappiness, Caddy repo + install,
      Bun (needs `unzip`), `tici` user and directories.
- [ ] Install units, sudoers, first deploy, timer, backups cron (needs the
      first release to exist).
- [ ] Publish the first GitHub Release so there is an artifact to install.
- [x] DNS: A + AAAA records for ticitacatoey.com + www -> the box.
- [ ] Verify end to end:
      `curl https://ticitacatoey.com/health` and a full game in the
      browser (robots answer, leaderboard fills, replay links work).
- [ ] Delete the two Vercel projects (user; nothing else references them).
- [ ] Point an uptime pinger at /health.

Later, separate decisions:

- [ ] `.well-known/assetlinks.json` + `apple-app-site-association` once
      release signing cert + Apple team id exist (mobile https app links).
- [ ] Release mobile builds (need the domain live first).

## Open Questions

- None blocking. The `release` branch idea from the Vercel plan is dropped:
  the box deploys `main` via the update runbook.

## Files Likely To Change

`server/src/static.ts`, `server/src/server.ts`, `server/test/static.test.ts`,
`deploy/*` (Caddyfile + sites/, deploy.sh, both unit pairs, sudoers,
backup.sh), `.github/workflows/release.yml`, `DEPLOYMENT.md`,
`mobile/src/config.ts`, `web/index.html`, `server/claude.md`,
`web/claude.md`.

## Recovery Hints

If found mid-provisioning: the code side is complete when `bun test` in
`server/` shows the static suite passing and `TTT_WEB_DIR=../web/dist bun
src/server.ts` serves the app on :8080. The box state is discoverable via
`systemctl status tici-taca-toey` and `caddy validate`. DEPLOYMENT.md is
the runbook of record.

## Checkpoints

- 2026-07-20 07:38 IST - Decision recorded (Hetzner + Caddy + systemd,
  single origin, Vercel retired). Code + artifacts + docs
  landed and verified locally: static.ts with 7 tests (server 83/83),
  live single-origin check on :8080 (app + same-origin ws + leaderboard),
  deploy/ trio, DEPLOYMENT.md rewrite, mobile/og URLs on the final domain.
  Remaining: the manual provisioning checklist above.
- 2026-07-21 18:23 IST - Deploy pipeline built: release-triggered CI artifact + pull-based installer with checksum
  verification, symlink releases, health-check auto-rollback, and a Caddy
  import layout ready for the next project. Verified by packaging the
  artifact exactly as CI does and running the server from it in a simulated
  box layout - which caught the `/dataset` fresh-box 500. Server 87/87,
  typecheck green, workflow structure checked. Remaining: the manual
  provisioning checklist above.
- 2026-07-23 10:29 IST - Recalibrated to Hetzner CX23 (availability
  appeared on the Cost-Optimized line): 4 GB / 40 GB / 20 TB for ~$8.50 vs
  the alternatives considered. Caps raised for the bigger box (6000
  connections, 3000 games) in the unit; DEPLOYMENT.md reprovisioned for
  Hetzner (console + Cloud Firewall, Ubuntu 26.04 Caddy
  repo, dual-stack DNS, Hetzner Backups as the off-box copy since
  backup.sh writes to the same disk). Also landed this session: idle-game
  deadline + sweep that ends games properly instead of deleting them,
  connection cap, and the merge-not-replace dataset workflow. Server 94/94.
- 2026-07-23 12:08 IST - Box live and hardened: CX23/Nuremberg, swap +
  swappiness, Caddy, Bun, `tici` user, key-only SSH proven from a client
  (`Permission denied (publickey)`), fail2ban armed, root password set as
  the console break-glass, firewall 80/443/22, DNS A+AAAA pointed.
  Tailscale dropped (free tier is personal-use only; this is a company
  box) - replaced by hardened SSH, with WireGuard documented as the
  optional upgrade. Also this session: mobile storage moved from a
  hand-rolled native module to AsyncStorage (beginner-friendliness), and
  the pre-open-sourcing security review completed - one Medium finding
  (mobile playerKey uses Math.random) now tracked in TODO Pending.
  Remaining: push, first release, on-box install, live game.
