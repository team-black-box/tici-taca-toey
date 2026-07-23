# Deployment

**One box, one origin, one process, releases installed by the box itself.**
Caddy terminates TLS on 80/443 and proxies to the game
server on localhost; the game server serves the built web app, the websocket,
and the HTTP API from the same origin; systemd keeps it alive; sqlite and the
TTN corpus live on the box disk.

```
ticitacatoey.com ──> Caddy (:443, auto TLS) ──> bun server (127.0.0.1:8080)
                                                  ├─ current/web/dist (static, SPA fallback)
                                                  ├─ /ws websocket (game protocol)
                                                  ├─ /health /dataset /mcp /api/*
                                                  ├─ /mcp (agents, streamable HTTP)
                                                  └─ data/  (sqlite + games.ttn)
```

Single origin means the web client's same-origin `wss://<host>/ws` fallback
just works — production builds run with **`TTT_SERVER_URL` unset** and bake
in no server URL at all. Dev is unchanged: `bun run dev` in `server/` and
`web/` separately, with `TTT_WEB_DIR` unset so the server serves no files.

## The box

Any always-on VM with 2 vCPU and 4 GB RAM is enough - the reference
deployment runs a shared-vCPU box with a 40 GB disk. Ubuntu LTS, an
unprivileged `tici` user, everything under `/opt/tici-taca-toey`.

Enable your provider's **daily disk backups**. They are not redundant with
`backup.sh`: that writes to `/var/backups` on the *same disk*, so a disk
failure would take the database and its backups together. The TTN corpus is
mirrored to GitHub daily, but player identities, handles, and Elo ratings
live only on the box.

Deploy artifacts live in [`deploy/`](./deploy/) and are installed once:

| File | Destination |
| --- | --- |
| [`Caddyfile`](./deploy/Caddyfile) | `/etc/caddy/Caddyfile` — just an `import` |
| [`sites/ticitacatoey.caddy`](./deploy/sites/ticitacatoey.caddy) | `/etc/caddy/sites/` |
| [`tici-taca-toey.service`](./deploy/tici-taca-toey.service) | `/etc/systemd/system/` |
| [`tici-taca-toey-deploy.{service,timer}`](./deploy/) | `/etc/systemd/system/` |
| [`tici-taca-toey-watchdog.{service,timer}`](./deploy/) | `/etc/systemd/system/` |
| [`sudoers-tici-taca-toey`](./deploy/sudoers-tici-taca-toey) | `/etc/sudoers.d/` (0440) |
| [`deploy.sh`](./deploy/deploy.sh) | `/opt/tici-taca-toey/deploy.sh` |
| [`backup.sh`](./deploy/backup.sh) | run from cron |

**Adding another project to this box** is one new snippet in
`/etc/caddy/sites/` pointing at a new localhost port, plus its own systemd
unit — never an edit to the shared `Caddyfile`.

## How deploys work

Releases are deliberate and the box pulls them; nothing inbound is ever
needed, and no credential is stored in CI.

```
git tag + GitHub Release  ──>  .github/workflows/release.yml
                                 ├─ runs server + web tests (the gate)
                                 ├─ builds web/dist
                                 └─ attaches tici-taca-toey.tar.gz (+ .sha256)
                                          │
                          (box polls every 5 min, systemd timer)
                                          ▼
                               deploy/deploy.sh on the box
                                 ├─ checksum-verifies the artifact
                                 ├─ extracts to releases/<tag>/
                                 ├─ swaps the `current` symlink, restarts
                                 └─ health-checks, auto-rolls-back on failure
```

The artifact mirrors the repo layout (`server/src`, `shared`, `web/dist`,
`deploy`, `VERSION`) so the server's relative imports resolve unchanged.
**The box never runs a bundler** — it only ever extracts and restarts, which
matters on a 1 GB machine. The server's zero runtime dependencies mean there
is no `node_modules` to ship either; the whole artifact is ~1.1 MB.

**To ship:** push a tag and publish a GitHub Release for it. That's the
entire process — the box has it live within ~5 minutes.

**To roll back:** repoint the symlink at any retained release (the last five
are kept):

```bash
ln -sfn /opt/tici-taca-toey/releases/<older-tag> /opt/tici-taca-toey/cur.new
mv -Tf /opt/tici-taca-toey/cur.new /opt/tici-taca-toey/current
sudo systemctl restart tici-taca-toey
```

Players in flight ride through a restart on the clients'
reconnect-and-resume machinery (60s grace). **Game data is never touched by
a deploy** — sqlite and the TTN corpus live in `/opt/tici-taca-toey/data`,
deliberately outside the release directories.

## First-time provisioning runbook

Publish a GitHub Release first — the box installs a release, so one must
exist before provisioning.

Create the server with **Ubuntu LTS, IPv4 + IPv6, daily backups, and your
SSH key**. Then attach a firewall (inbound allow only):

| Proto | Port | Source | Note |
| --- | --- | --- | --- |
| TCP | 80, 443 | `0.0.0.0/0`, `::/0` | Caddy |
| TCP | 22 | `0.0.0.0/0` | SSH (key-only; see Security) |

```bash
ssh root@<box-ip>
```

```bash
# --- on the box, as root (sudo -i) ---
REPO=team-black-box/tici-taca-toey
BASE=https://raw.githubusercontent.com/$REPO/main/deploy

# Swap: 2 GB of insurance on top of 4 GB of RAM. It is headroom for
# transient spikes, not a place to run from - a swapped-out heap would make
# every move wait on disk, and a fast systemd restart beats swap thrash.
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
# Prefer dropping page cache over paging out the game server's heap.
echo 'vm.swappiness=10' >> /etc/sysctl.conf && sysctl -p

# Caddy is not in Ubuntu's default repos - add the official one first.
apt update && apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg unzip sqlite3 fail2ban unattended-upgrades
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

# Console break-glass: only usable at the console, never over SSH.
passwd root

adduser --disabled-password --gecos "" tici
mkdir -p /opt/tici-taca-toey/releases /opt/tici-taca-toey/data
curl -fsSL $BASE/deploy.sh -o /opt/tici-taca-toey/deploy.sh
chmod +x /opt/tici-taca-toey/deploy.sh
chown -R tici:tici /opt/tici-taca-toey

curl -fsSL $BASE/tici-taca-toey.service        -o /etc/systemd/system/tici-taca-toey.service
curl -fsSL $BASE/tici-taca-toey-deploy.service -o /etc/systemd/system/tici-taca-toey-deploy.service
curl -fsSL $BASE/tici-taca-toey-deploy.timer   -o /etc/systemd/system/tici-taca-toey-deploy.timer
curl -fsSL $BASE/tici-taca-toey-watchdog.service -o /etc/systemd/system/tici-taca-toey-watchdog.service
curl -fsSL $BASE/tici-taca-toey-watchdog.timer   -o /etc/systemd/system/tici-taca-toey-watchdog.timer
curl -fsSL $BASE/Caddyfile                     -o /etc/caddy/Caddyfile
mkdir -p /etc/caddy/sites
curl -fsSL $BASE/sites/ticitacatoey.caddy      -o /etc/caddy/sites/ticitacatoey.caddy
curl -fsSL $BASE/sudoers-tici-taca-toey        -o /tmp/sudoers-ttt
install -m 0440 -o root -g root /tmp/sudoers-ttt /etc/sudoers.d/tici-taca-toey && visudo -c

systemctl daemon-reload
sudo -u tici /opt/tici-taca-toey/deploy.sh      # installs the current release
systemctl enable tici-taca-toey
systemctl enable --now tici-taca-toey-deploy.timer
# After the first deploy: the watchdog script ships inside the release.
systemctl enable --now tici-taca-toey-watchdog.timer
systemctl reload caddy

( crontab -l 2>/dev/null; echo "15 2 * * * /opt/tici-taca-toey/deploy/backup.sh" ) | crontab -
```

DNS: an **A record** (IPv4) and an **AAAA record** (IPv6) for
`ticitacatoey.com` and `www` pointing at the server's addresses — the box
is dual-stack. Caddy fetches and renews certificates itself on the
first request to each domain. Verify with
`curl https://ticitacatoey.com/health`.

`deploy.sh` is installed once and is **deliberately not self-updating** — if
it or a unit file changes in the repo, re-fetch it by hand. Everything else
ships in the artifact.

## Security

The stance: **the public internet sees ports 80/443 and nothing else.**

- **Key-only SSH.** `/etc/ssh/sshd_config.d/99-hardening.conf` sets
  `PasswordAuthentication no`, `KbdInteractiveAuthentication no`,
  `PermitRootLogin prohibit-password`, and `MaxAuthTries 3`. Brute force
  against an ed25519 key is not a threat model, it is arithmetic. Verify
  the *effective* config with `sshd -T | grep -i passwordauth`, and prove
  it from a client with
  `ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@<ip>`
  — the correct answer is `Permission denied (publickey)` with no prompt.
- **fail2ban** (`/etc/fail2ban/jail.local`, systemd backend): 3 strikes,
  1 hour ban. Mostly noise reduction; the key requirement does the work.
- **Edge firewall** (filters before packets reach the box): 80/443 TCP
  inbound plus 22, nothing else, default-deny. Pinning 22 to a
  single source IP is stronger still, but impractical on a dynamic home
  connection — and unnecessary given key-only auth.
- **Break-glass:** the provider's browser console reaches the box
  without going through port 22, so you cannot permanently lock yourself
  out. It needs a *local* password, so set one with `passwd root` during
  provisioning — this does not weaken SSH, because password auth is
  refused over the network.
- **A VPN is the optional upgrade.** Self-hosted WireGuard would let you
  close 22 entirely; the server has a static IP so your laptop dials in and
  a dynamic home address stops mattering. Not required, and deliberately
  not a paid SaaS dependency.
- **The game server binds 127.0.0.1** (`HOST` in the unit) — 8080 is
  unreachable from outside even if a firewall rule slips.
- **systemd hardening** (in the unit): unprivileged user, `NoNewPrivileges`,
  `ProtectSystem=strict` with `data/` as the only writable path,
  `PrivateTmp`, `PrivateDevices`.
- **Narrow sudo**: `tici` may run exactly
  `systemctl restart tici-taca-toey` and nothing else.
- **Artifact integrity**: `deploy.sh` verifies the published SHA-256 before
  extracting, so a truncated or tampered download never becomes a deploy.
- **Unattended security patches** via `unattended-upgrades`; enable with
  `dpkg-reconfigure -plow unattended-upgrades`.
- **App-level limits** (already built in): payload caps, per-socket rate
  limiting with hard-close strikes, and the origin allowlist
  (`TTT_ALLOWED_ORIGINS=https://ticitacatoey.com` in the unit — browsers must
  come from the real origin; robots and native apps are origin-less and
  welcome).

## Capacity model (measured 2026-07, see `server/bench/`)

The whole game is one process, so capacity is arithmetic:

- Engine pipeline: ~114k messages/s sustained (~12k complete 3x3 games/s) on
  one laptop core; the CX23's 2 shared vCPUs deliver a healthy fraction of
  that, still orders of magnitude above hobby traffic. A 3x3 game is ~12
  protocol messages.
- Real websockets: 400 concurrent sockets sustained ~17k delivered msgs/s
  with the bench *client* as the bottleneck; server RSS ~206 MB under that
  load. ~1 KB per active game; sweep keeps memory flat forever.
- Per-socket rate limiting (40 burst / 15 msg/s refill, `TTT_RATE_CAPACITY` /
  `TTT_RATE_REFILL` to tune) caps any abuser far below server limits.

Hard caps, all env-tunable on the box without a release:

| Limit | Default | Env |
| --- | --- | --- |
| Concurrent websocket connections | 6000 | `TTT_MAX_CONNECTIONS` |
| Active games | 3000 | `TTT_MAX_GAMES` |
| Idle game deadline | 30 min | `TTT_IDLE_GAME_MS` |

Past the connection cap the server answers the upgrade with `503` +
`Retry-After: 30` rather than accepting a socket it cannot serve, which
keeps everyone already playing responsive. `/health` reports `connections`
and `maxConnections`, so the uptime pinger doubles as a headroom gauge.
Games that sit untouched past the idle deadline are ended properly -
broadcast, archived, robot seats freed - instead of squatting on a slot for
a day.

Translation: "millions of users" of a casual game means peak concurrency in
the tens of thousands of sockets, each sending a message every few seconds —
well within one core. The caps above come from the memory budget: 4 GB less ~1 GB for the OS,
Caddy, and headroom leaves ~3 GB, and sockets cost ~365 KB each. File
descriptors are lifted to 65536 in the unit. `/health` reports live
`connections` against `maxConnections`, so the uptime pinger tells you when
to resize - on most hosts that is a reboot into a bigger plan, no
migration.

## Staying alive

Five layers, in the order they engage:

1. **The process refuses to die.** `uncaughtException` and
   `unhandledRejection` handlers log instead of exiting; every websocket
   payload is parse-guarded, every engine transition wrapped, every send
   individually guarded so one dead socket cannot break a broadcast.
2. **systemd restarts it if it does.** `Restart=always`, `RestartSec=2`.
3. **It returns after a reboot.** `systemctl enable` covers kernel updates
   and host migrations.
4. **A wedged process is caught too.** systemd only sees the process
   *exiting*, so a deadlock or stalled event loop would otherwise hang
   forever. `deploy/watchdog.sh` runs every minute and restarts the unit
   after two consecutive `/health` misses - worst case ~2 minutes rather
   than indefinite. It stands down whenever systemd reports the unit as
   anything other than `active`, so it never fights `Restart=always`, and
   two strikes mean an ordinary deploy restart never trips it.
5. **A bad release rolls itself back.** `deploy.sh` health-checks the new
   release and reverts to the previous one if it does not answer.

Players barely notice any of it: clients reconnect with capped exponential
backoff, and the 60-second disconnect grace replays their games via
`GAME_RESUMED`, so a restart mid-game costs a blink.

**What is still uncovered:** the box itself. One machine means one point of
failure - if the host dies, nothing fails over. That is the accepted trade
for a single small game server, and it is why the uptime pinger below
matters: it is the only thing that will tell you.

## Monitoring and backups

- `GET /health` returns player/game/robot/connection/MCP-session counts.
  An uptime pinger watches it; the public status page is
  https://stats.uptimerobot.com/Uta5Sjd5ef
- `journalctl -u tici-taca-toey -f` tails the server log;
  `journalctl -u tici-taca-toey-deploy -f` shows deploy activity, and
  `journalctl -u tici-taca-toey-watchdog -f` shows liveness checks.
- Nightly [`deploy/backup.sh`](./deploy/backup.sh): consistent
  `sqlite3 .backup` snapshot (safe under WAL) + `games.ttn` copy into
  `/var/backups/tici-taca-toey`, 14-day retention.
- Provider disk backups are the off-box copy: daily whole-disk snapshots,
  restorable to a new server. `backup.sh` covers fast local restores;
  disk snapshots cover losing the disk itself.

**On pruning sqlite:** don't delete rows from `games`/`game_players` after
the daily dataset mirror. `data/games.ttn` is a deliberately anonymous
projection - notation lines only, no game ids, no player links - so it
cannot reconstruct player history; dropping those rows would publish the
games while erasing everyone's `/players/:id/games`. Space is not the
constraint anyway: ~400 bytes per game means ~180 MB/year at 1000
games/day against ~7 GB free, and a disk resize is one command.

## Environments

- **Production**: the box, running whatever release is published.
- **Dev**: localhost (`bun run dev` in `server/` + `web/`). No hosted dev
  environment; if one is ever wanted it is a second unit on another port
  behind a `dev.ticitacatoey.com` snippet in `/etc/caddy/sites/`.

## Mobile release URL

Release mobile builds point at `wss://ticitacatoey.com` (same origin as
everything else) — `mobile/src/config.ts`. This domain must be live before
shipping a release build. The `https://ticitacatoey.com/...` app links
additionally need `/.well-known/assetlinks.json` and
`/.well-known/apple-app-site-association` served (drop them in
`web/public/.well-known/` once the release signing cert and Apple team id
exist — see `tasks/mobile-device-polish.md`).

## Costs

| Line | Monthly |
| --- | --- |
| CX23 (2 vCPU, 4 GB, 40 GB SSD) | ~$6.49 |
| Primary IPv4 ($0.001/hr) | ~$0.73 |
| Backups (+20%) | ~$1.30 |
| **Total** | **~$8.50 (₹750)** |

**20 TB of traffic is included** — no per-GB egress meter to watch, unlike
the hyperscalers. IPv6 and Caddy's certificates are free. Flat monthly
pricing, no lock-in, cancel any time.

## Why not serverless

The engine keeps live games **in memory in one process**. Serverless
runtimes scale to zero (cold starts), scale out to multiple instances
(where a second socket can land on an instance that does not hold your
game, so share-link joins become a lottery), and give no persistent local
disk (no sqlite, no TTN corpus). An always-on VM is the right primitive
here. Do not move this onto a serverless runtime without first moving game
state out of process.
