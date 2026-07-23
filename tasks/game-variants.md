# Multi-sequence wins and teams

**Status:** Completed
**Owner:** claude
**Estimated effort:** Large (protocol change: shared + server + web + mobile + mcp)
**Created:** 2026-07-23 13:26 IST
**Completed:** 2026-07-23 16:17 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Two new game variants, playable everywhere:

1. **Multiple win sequences** - a game can require N sequences of length L
   (e.g. 12x12, four sequences of length 2). A maximal run of length R
   counts as floor(R/L) sequences; runs in different directions both count
   (crossing is legal, like a crossword). First to the required count wins.
2. **Teams** - players form equal teams (playerCount divisible by teamCount).
   Team of a seat is `seat % teamCount`, so the existing rotation
   interleaves teams with zero turn-order changes. Sequences may combine
   marks from any member of the team. Robots can hold team seats - the
   scheduler needs no changes.

No backward compatibility required (user decision, 2026-07-23): protocol
and TTN may change destructively.

## Scope

- [x] `shared/rules.ts`: teamOfSeat, sequence counting, unified win scan.
- [x] `shared/model.ts`: Game.winningSequenceCount / teamCount / winningTeam,
      GameSummary additions, new message types.
- [x] `shared/ttn.ts`: TTN v3 grammar (seqCount + teams fields), decoder
      keeps v1/v2 for the existing corpus.
- [x] Engine: validation, win/draw via shared rules, team timeout rule.
- [x] Server tests: multi-seq wins, team wins, team timeout, notation v3.
- [x] Web: start form, team colors/grouping, seq progress, replay v3.
- [x] Mobile: start form, team display, seq progress, replay screen.
- [x] MCP + sdk: start_game params, renderGame teams/seq display (also
      deleted the stdio transport's drifted local renderGame - shared/mcp
      is now truly the only board renderer).

## Open Questions

Resolved: overlap rule = floor(run/L) per direction, crossing allowed;
teams must divide playerCount evenly; teamCount <= playerCount/2.

## Files Likely To Change

shared/{model,rules,ttn,mcp}.ts, server/src/{model,TiciTacaToeyGameEngine,db,mcp}.ts,
server/test/*, web/src/{features,state,common}/*, mobile/src/*, mcp/server.ts.

## Recovery Hints

Run server tests first - the engine + notation tests define the rules. Then
web build, then mobile bundles. grep winningSequenceCount to find wiring.

## Checkpoints

- 2026-07-23 16:17 IST - Done. Mobile shipped (variant fields, team-grouped roster,
  sequence counters, new Replay screen wired into the stack); typecheck +
  both headless bundles green. Made the robots variant-aware - residents
  and reference robots now score with the shared rules and never block a
  teammate; verified live: greedo *beat* me in a 5x5 two-sequence game and
  won for its team in a 4-seat 2-team game. Full matrix green: server
  111 tests, web 9 + build, sdk typecheck, stdio MCP 3, HTTP MCP 6,
  playground still 89.5% W vs random. Docs updated across server/web/
  shared/mobile/robots/mcp/README.

- 2026-07-23 16:10 IST - Web done and verified in a real browser: played a 5x5 "2 sequences
  of 2" game to a win, watched the counter go 0/2 -> 1/2 (a run of three
  still 1/2 - the overlap rule) -> won on the fourth. History panel
  populated itself, leaderboard showed the global + 5x2x2-s2 pools. A
  4-player 2-team game over real websockets won with a sequence built from
  two teammates' marks (winningTeam 0, TTN v3
  3.5.3.1.4.2.u.000i010o02.w0). Leaderboard JSON carries no playerId and
  the /players/* and /games/:id endpoints are gone. Web typecheck + 9 tests
  + build all green.

- 2026-07-23 13:54 IST - Server + shared + MCP done: 111/111 server tests (11 new variant
  tests), winner bench steady at 3.17M ops/sec, sdk typecheck clean,
  stdio e2e 3/3 (from mcp/), HTTP e2e 6/6. Note: bun test of the stdio
  suite fails with EPIPE when invoked from the repo ROOT even on clean
  HEAD - environmental, tracked separately. Next: web client.

- 2026-07-23 13:26 IST - Task created, design settled, starting shared/ + engine.
