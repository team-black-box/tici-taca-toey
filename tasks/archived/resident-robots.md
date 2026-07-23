# Resident robots: "+ robot" must always answer

**Status:** Completed
**Owner:** unassigned
**Estimated effort:** Small-medium
**Created:** 2026-07-18 09:08 IST
**Completed:**
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Robots are not deployed anywhere today. The reference robots are outbound
websocket clients run by hand (`bun robots/greedy.ts <url>`), so on the
deployed dev environment "+ robot" answers `NO_ROBOT_AVAILABLE` unless
someone's laptop happens to be running one. A delightful app cannot have
its most delightful button be a lottery. Give every server a built-in
robot fleet.

## Why not "deploy the robots" as their own service?

Two structural reasons, learned from the Vercel dev deployment:

1. **Platform shape.** Vercel functions/containers exist only while serving
   inbound traffic. A robot is a pure *outbound* dialer - no inbound
   requests means the platform scales it to zero and there is nothing to
   keep it alive. A robot fleet as a Vercel project fights the platform.
2. **Instance affinity.** Even if kept alive, an external robot connects to
   *one* server instance; players on another instance still get
   NO_ROBOT_AVAILABLE (observed live on 2026-07-18).

## Design: robots live inside the server process

The engine already speaks to players through the minimal
`PlayerConnection` interface (`{ send(data) }`) - the test suite drives
whole games through `FakeConnection` this way. Resident robots are exactly
that, shipped:

- `server/src/residents.ts`: an in-process robot host. For each resident
  (rando, greedo, minnie-max) it registers via `engine.play(REGISTER_ROBOT)`
  with an in-memory connection whose `send()` parses broadcasts and replies
  with `MAKE_MOVE` through `engine.play()` - no sockets, no network, no
  scheduler changes (the existing `pickRobot` sees them as ordinary
  robots).
- Strategy code is imported from `robots/strategy.ts` (single source of
  truth; the SDK stays strategy-neutral and unchanged).
- Enabled by default, `RESIDENT_ROBOTS=off` to disable (tests construct
  engines directly, so they are unaffected).
- Every server instance carries its own fleet, so "+ robot" always answers
  on whatever instance the player landed on - this also sidesteps the
  instance-affinity lottery entirely for human-vs-robot games.
- External SDK robots remain first-class and identical in protocol; they
  are the learning-playground on-ramp and can outrank residents later
  (named-robot matchmaking task). Until users host their own, a laptop or
  any always-on box can still join the public fleet.
- Move pacing: residents reply on a short delay (~400-700ms) so games feel
  played, not instantaneous.

## Scope

- [x] `residents.ts` in-process host + in-memory PlayerConnection.
- [x] Wire into server.ts behind RESIDENT_ROBOTS (default on).
- [x] Tests: residents register on boot, "+ robot" seats one, full game vs
      resident, robot-vs-robot with two residents, off-switch works.
- [x] Redeploy dev; verify "+ robot" answers on the deployed app with no
      local processes running.
- [x] Docs: server/claude.md robots section, sdk/README (external robots
      still welcome), DEPLOYMENT.md limitation note updated.

## Open Questions

- Should the scheduler prefer external robots over residents when both
  match (gives community robots games)? Lean yes; decide at pickup.

## Files Likely To Change

`server/src/residents.ts` (new), `server/src/server.ts`,
`server/test/residents.test.ts` (new), docs.

## Recovery Hints

If `server/src/residents.ts` exists but the deployed dev "+ robot" still
errors with no local robot running, the server.ts wiring or redeploy is the
missing piece.

## Checkpoints

- 2026-07-18 09:08 IST - Task created with the in-process design settled.

- 2026-07-18 18:51 IST - residents shipped in-process; verified end-to-end on the deployed dev environment. Completed.
