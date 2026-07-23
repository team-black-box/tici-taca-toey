# TODO

Operational task tracker. See [`claude.md`](./claude.md) for the workflow and
[`tasks/claude.md`](./tasks/claude.md) for task-file rules.

**Mission**: a delightful, learning, production-ready app - no sharp edges,
exquisite taste in design.

## In progress

- Production cutover: one Hetzner box (CX23, Nuremberg), one origin,
  releases installed by the box itself (Caddy + systemd, key-only SSH)
  ([task file](./tasks/production-cutover.md)).
  Last checkpoint: 2026-07-23 11:20 IST - box provisioned and hardened;
  DNS pointed; remaining: push the repo, cut the first release, run the
  on-box install, verify a live game.

## Pending

- Mobile: strengthen playerKey generation. `mobile/src/state.ts` builds the
  credential from `Math.random()`, which is not a CSPRNG (the web uses
  `crypto.randomUUID`). Options: a `getRandomValues` polyfill, or have the
  server mint the key on first registration (zero new dependencies). Found
  by the pre-open-sourcing security review; not exploitable remotely, but
  it is the only credential in the system.
- Mobile follow-up (needs hardware): Android emulator/device pass for the
  chrome, and a physical-device game against the production box once live.

## Completed

Nothing yet in the open-source era - the pre-launch history is in
[`tasks/archived/todo.md`](./tasks/archived/todo.md).
