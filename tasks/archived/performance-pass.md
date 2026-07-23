# Performance pass: capacity model for the 2GB box

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium (bench + targeted tuning, server only)
**Created:** 2026-07-20 09:46 IST
**Completed:** 2026-07-20 11:10 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Know - with numbers, not vibes - what the single 2GB Hetzner box can carry,
make the hot paths as fast as they reasonably get, and pin regression
floors in tests. Target claim to validate: hobby-to-viral traffic
("millions of users" = tens of thousands of concurrent sockets at peak)
fits one process.

## Scope

- [x] `bench/engine.bench.ts` - full pipeline (validate->transition->notify)
      throughput: games/sec + messages/sec for 3x3 and 12x12, LIST_GAMES
      cost at 500 active games, bytes per active game, sweep flatness.
- [x] `bench/sockets.bench.ts` - real websocket load against a spawned
      server: concurrent pairs playing continuously; msg/sec, move->
      broadcast p50/p99, server RSS.
- [x] Tune whatever the numbers indict (candidates: LIST_GAMES summary
      rebuild per poll; anything allocating per broadcast). Rerun, record
      before/after.
- [x] `server/test/perf.test.ts` - conservative CI-safe floors (throughput
      + memory-returns-after-sweep) so regressions fail loudly without
      flaking.
- [x] Document the capacity model in `DEPLOYMENT.md` + refresh the bench
      section of `server/claude.md`.

## Open Questions

None blocking. Existing broadcast path already serializes once per
audience (checked before starting).

## Files Likely To Change

`server/bench/engine.bench.ts`, `server/bench/sockets.bench.ts` (new),
`server/test/perf.test.ts` (new), possibly
`server/src/TiciTacaToeyGameEngine.ts`, `DEPLOYMENT.md`,
`server/claude.md`, `server/package.json` (bench scripts).

## Recovery Hints

`bun run bench` inside `server/` should print the full report. If numbers
regress an order of magnitude, `git log server/src` for the culprit.

## Checkpoints

- 2026-07-20 09:46 IST - Plan written; engine bench first.
- 2026-07-20 11:10 IST - Completed. Two real O(server-size)
  defects found and fixed: broadcast recipient scan over all players (now
  O(seats)) and redux-style whole-map spreads per transition (now targeted
  assignment). Sustained: 3,264 -> 114,267 msgs/s (35x). Sockets: 400
  concurrent, 17k msgs/s, 0 errors, 206 MB. Rate limiter env-tunable.
  Floors in test/perf.test.ts (86/86). Capacity model in DEPLOYMENT.md.
