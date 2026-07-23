# Project Instructions

Read this first when working in tici-taca-toey. This file is the root
operating contract for agents in this repository. Local `claude.md` files
inside `server/` and `web/` override this file for their subtree, but the
task, stability, and personality rules below always apply.

## What This Project Is

Tici Taca Toey is a multiplayer websockets tic-tac-toe game with configurable
board sizes (2-12), player counts (2-10), and winning sequence lengths. It was
built in 2020 as an early personal project and revived in 2026. It is a
remnant of our early work and should keep running, unchanged in spirit, for
decades.

## Documentation Map

- [`README.md`](./README.md) is the project overview and quick start.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) is the production deployment runbook
  (one Hetzner box, Caddy, systemd, single origin) and security stance.
- [`TODO.md`](./TODO.md) is the root operational task tracker.
- [`tasks/`](./tasks/) stores task plans, checkpoint logs, and recovery notes.
- [`tasks/claude.md`](./tasks/claude.md) is the task-file and archive workflow
  guide.
- [`tasks/archived/todo.md`](./tasks/archived/todo.md) stores completed task
  line items after they age out of the root tracker.
- [`server/claude.md`](./server/claude.md) covers the game engine, protocol,
  and server stability rules.
- [`web/claude.md`](./web/claude.md) covers the web app architecture, the
  hand-rolled modules that replaced libraries, and the styling system.

## Repository Map

- `server/` is the websocket game server: a Bun project with **zero runtime
  dependencies**. The engine, timers, robot scheduler, TTN notation, and
  server live in `server/src/`.
- `web/` is the web client: a Bun-bundled React app whose only runtime
  dependencies are `react` and `react-dom`. Everything else (store, router,
  QR codes, identicons, icons, styling) is hand-rolled or vendored in-repo.
- `sdk/` is the zero-dependency robot SDK (see `sdk/README.md`).
- `robots/` holds runnable reference robots built on the SDK
  (`bun robots/<name>.ts`).
- `playground/` is the learning lab (see `playground/README.md`): trains a
  behavior-cloned policy from TTN records + engine self-play and seats it
  as the `cloney` SDK robot. Zero dependencies, teaching-first.
- `mcp/` is the stdio MCP transport (see `mcp/README.md`). The game server
  also speaks MCP over HTTP at `/mcp` (`server/src/mcp.ts`), so agents can
  connect with just a URL. Both serve the one contract in `shared/mcp.ts`.
- `mobile/` is the bare React Native app (package `com.ticitacatoey`, see
  `mobile/README.md`). Approved deps only: react, react-native, React
  Navigation (+screens/safe-area-context), and async-storage - ask before
  adding more. The floating chrome is hand-rolled (no glass libraries),
  and storage is AsyncStorage rather than MMKV so beginners never meet a
  native module. It is **not** part of the Bun workspace - Metro wants its
  own node_modules; run `bun install` inside it.
- `shared/` is the single source of truth for the wire protocol: the
  model (`shared/model.ts`), the TTN codec (`shared/ttn.ts`), and the
  error copy (`shared/copy.ts`). Server, web, mobile, sdk, and mcp all
  import it (mobile via metro `watchFolders`); the per-module `model.ts`
  files are thin envelope shims over it. A change in `shared/` is a
  protocol change: run the full verification matrix.

## Package Managers

- Use Bun everywhere. Never use npm, yarn, or pnpm in this repository.
- Run Bun commands from inside `server/` or `web/`, not from the root, except
  for the convenience scripts in the root `package.json`.
- Do not add runtime dependencies to `server/` - it has none on purpose.
- Do not add runtime dependencies to `web/` beyond `react` and `react-dom`
  unless the user explicitly approves. Prefer writing the small thing by hand
  the way `web/src/common/qr.tsx` and `web/src/common/identicon.ts` do.
- Do not add, remove, or regenerate lockfiles unless the dependency graph
  actually changed.

## Stability Principles (Never Die)

The server and app are designed to run unattended for years:

- The server survives any single bad message: every websocket payload is
  parse-guarded, every engine transition is wrapped, and process-level
  `uncaughtException` / `unhandledRejection` handlers log instead of exit.
- The engine garbage collects finished and stale games on a sweep interval so
  memory stays flat forever.
- Limits protect the server from abuse: max payload size, max active games,
  name length caps, spectator caps, validated timer configurations.
- The web client reconnects automatically with capped exponential backoff and
  re-registers the player's name after reconnecting.
- Dead sockets never break a broadcast: sends are individually guarded.

Preserve these properties in every change. New message handlers must validate
before they transition, and must never assume a game or player exists.

## Personality Principles

- Since the 2026-06 restyle the identity is hacker/terminal/matrix: dark
  phosphor-green **only** (no light theme, by explicit decision), system
  monospace only (no webfonts), raw vanilla CSS in
  `web/src/styles/app.css`, neon per-player colors, the blinking-cursor
  brand, the neon SVG grid logo (`web/src/common/logo.tsx` +
  `public/favicon.svg`), block-glyph hacker avatars
  (`web/src/common/avatar.tsx`), the QR invite card, and "Made with ♥ in
  Bengaluru, India". Do not add CSS frameworks or fonts.
- The server keeps its ASCII art banner and friendly log format.
- Keep the playful naming (Tici Taca Toey, "My Amazing Game", robot names
  like rando/greedo/minnie-max/cloney).

## Public Repository Hygiene

This repository is public. Nothing that identifies a person or grants
access may be committed.

- Configuration is env vars only (`TTT_*`, `PORT`, `HOST`) - never commit
  values, and the defaults in code are always safe-for-public.
- The box's real configuration lives in its systemd unit on the box, not
  in git. `deploy/` holds paths and domains, never credentials.
- Before committing a new data file, ask "could this identify a person?"
  TTN notation lines cannot - they are board sizes and move sequences.
  Databases and logs can, and stay gitignored (`server/data/`).
- The playerKey is a secret: never log it, never render it, and never put
  it in a URL the server can see.

## Task Management

[`TODO.md`](./TODO.md) at the repo root is the single source of truth for
active work. Open it first when the user asks you to pick up, continue, or
recover tracked work.

Pending tasks are planning records, not automatic authorization. Do not pick
up or implement a pending task unless the user explicitly asks for that
specific task to be started.

### Structure

`TODO.md` has three sections:

- **In progress**: at most one item per agent. Every entry links to a detailed
  file in [`tasks/`](./tasks/) and carries a "Last checkpoint" line.
- **Pending**: planned work that should not be implemented until the user asks
  for that specific task. Each substantial item links to a `tasks/<slug>.md`
  plan.
- **Completed**: recent append-only history. Older completed tasks are
  archived according to the rule below.

### Per-task files in `tasks/`

Anything bigger than a small edit, or anything that spans `server/` and
`web/`, gets a `tasks/<slug>.md` file. The file is the work plan, checkpoint
log, and recovery note. Use this format:

```md
# <Task title>

**Status:** Pending | In progress | Completed
**Owner:** <name | unassigned>
**Estimated effort:** <rough size>
**Created:** YYYY-MM-DD HH:MM IST
**Completed:** YYYY-MM-DD HH:MM IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

What we are building and why.

## Scope

- [ ] Checkbox list of meaningful sub-steps.

## Open Questions

Decisions that block coding. Resolve before implementation and record the
answer here.

## Files Likely To Change

Heads-up list so a recovering agent knows where to look.

## Recovery Hints

How to resume if this task is found in progress with a stale checkpoint.

## Checkpoints

- YYYY-MM-DD HH:MM IST - One-line summary of meaningful progress.
```

### Timestamp convention

All dates in the task system are `YYYY-MM-DD HH:MM IST` except completed task
section headings and completion markers, which use `YYYY-MM-DD`. Get the
current value with:

```bash
TZ='Asia/Kolkata' date +"%Y-%m-%d %H:%M IST"
```

Do not guess timestamps. Do not use UTC for task logs.

### Workflow

Starting a task:

1. Move the bullet from **Pending** to **In progress** in `TODO.md`.
2. Update the task file `Status` to `In progress`.
3. Resolve any blocking open questions before touching code and record the
   resolution in the task file.
4. Tick scope items as you complete them.

Checkpointing:

- Append a dated bullet to the task file `Checkpoints` section every
  meaningful slice of work, especially before switching between `server/` and
  `web/` and after verification.
- Update the matching `Last checkpoint` line in `TODO.md`.
- Commit when there is a meaningful working slice and the user has asked for a
  commit or the workflow calls for one.

Finishing a task:

1. Tick the remaining scope items.
2. Run the applicable verification commands from the
   [Verification](#verification) section.
3. Update relevant docs.
4. Move the bullet from **In progress** to **Completed** in `TODO.md`.
5. Set the task file `Status` to `Completed` and add `Completed:` with an IST
   timestamp.
6. Add a final checkpoint with verification results.

### Recovering from an interrupted task

When a task is in **In progress** but its checkpoint looks stale:

1. Read the task file front to back.
2. Run `git status --short` and inspect relevant diffs.
3. Check recent commits for the files named in the task.
4. Cross-reference the scope checklist against actual code/docs state.
5. Run applicable verification to find half-wired work.
6. Update the task file with what you found, including checked boxes and a
   fresh checkpoint.
7. Continue only once the recovered state is clear.

### Archiving old completed tasks

At the start of a tracked-work session, scan **Completed** in `TODO.md`. For
every entry whose completion date is more than 14 days old:

1. Move the completed bullet from root `TODO.md` into
   [`tasks/archived/todo.md`](./tasks/archived/todo.md), preserving the
   completion date and summary.
2. Move the corresponding `tasks/<slug>.md` file into `tasks/archived/` if it
   had one.
3. Update the archived bullet's task link to point at the archived task file.
4. Remove the completed bullet from root `TODO.md`.

Do not delete old task files just because they aged out of the root tracker.

### When in doubt

- Tiny changes can be tracked as a short `TODO.md` bullet without a task file.
- New ad-hoc work that appears mid-session should go to **Pending** first
  unless the user explicitly asks you to start it immediately.
- If a task is blocked, move or keep it in **Pending** with a `Blocked on:`
  note rather than letting it sit indefinitely in **In progress**.

## Change Scope

- Prefer the smallest change that solves the problem.
- If the task is server-only, stay in `server/`. If it is web-only, stay in
  `web/`.
- Protocol changes (message types, response shapes, error codes, game state
  fields) always touch both `server/src/model.ts` and
  `web/src/common/model.ts`, plus tests.
- Read nearby code before editing and follow the existing patterns.

## Code Style

- Make concise, surgical changes.
- No inline imports.
- Do not use `any` unless explicitly approved.
- Prefer `map`, `filter`, and `reduce` over `forEach` where practical.
- Use constants or enums instead of inline string literals for protocol
  values, error messages, and limits.
- Always use braces for control flow blocks.

## Verification

- For `server/` changes: `bun test` and `bun run typecheck` from inside
  `server/`. Run `bun run bench` when touching the winner calculation.
- For `web/` changes: `bun test`, `bun run typecheck`, and `bun run build`
  from inside `web/`.
- For `sdk/` or `robots/` changes: `bun run typecheck` inside `sdk/` (it
  covers `robots/` too), plus a live run of a reference robot against a dev
  server when behavior changed.
- For `playground/` changes: `bun run typecheck` inside `sdk/` (its config
  includes `playground/`) and a `bun playground/train.ts` run - the eval
  report must still clearly beat random.
- For `mcp/` changes: `bun run typecheck` inside `sdk/` (its config includes
  `mcp/`) and `bun test mcp` from the repo root (spawns a real server and
  plays a robot game through the bridge).
- For `mobile/` changes: `bun run typecheck`, `bun run bundle:android`, and
  `bun run bundle:ios` inside `mobile/` (headless); device builds are
  manual via Xcode / Android SDK.
- For a full end-to-end check: start `bun run dev` in `server/` and `web/`,
  start a robot (`bun robots/greedy.ts`), open http://localhost:3000, and
  play a game against it ("+ robot").
- If verification cannot run in the current environment, report the exact
  point reached before the failure.

## Documentation Management Policy

Keep docs current with the code in the same change. Hand-off should be
possible at any point without reconstructing intent from git history.

- New work picked up, paused, reframed, blocked, or shipped: update
  [`TODO.md`](./TODO.md) and the corresponding `tasks/<slug>.md` with IST
  timestamps.
- Protocol or engine behavior changes: update
  [`server/claude.md`](./server/claude.md).
- Web architecture, vendored module, or styling changes: update
  [`web/claude.md`](./web/claude.md).
- Deployment changes: update [`DEPLOYMENT.md`](./DEPLOYMENT.md).
- Stale docs are worse than missing docs: fix, caveat with a date, or delete.
