# TTN: ultra-compact game notation

**Status:** Completed
**Owner:** Claude (with Subramanian)
**Estimated effort:** Small-medium
**Created:** 2026-06-10 13:36 IST
**Completed:** 2026-06-11 04:58 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

A tiny, fast, lossless single-line ASCII notation for finished games -
tici-taca-toey's PGN - so game data can be retained cheaply and later used to
train models.

## The Notation (TTN v1)

```
<version>.<size>.<winLen>.<players>.<time>.<moves>.<result>
```

- `version` - `1`.
- `size`, `winLen`, `players` - base-10 integers.
- `time` - `u` for untimed, or `t<seconds>+<incrementSeconds>` for timed
  (e.g. `t60+1`).
- `moves` - chronological, fixed-width 2-char base36 cell tokens where
  `cell = x * size + y` (covers 144 cells on a 12x12 board: `00`-`3z`).
  The mover is implied by turn rotation. `--` is a skip token, emitted when
  a timed-out player's turn is skipped in 3+ player games, keeping rotation
  arithmetic exact.
- `result` - `w<i>` win by player index i (seat order), `t<i>` win by
  timeout, `d` draw, `a` abandoned/unfinished.

Example - 3x3, X wins the top row in 5 moves, 35 bytes:

```
1.3.3.2.u.0003010402.w0
```

Properties: trivially parseable (split on `.`), replayable (the decoder
rebuilds every board state), self-validating (decode replays moves through
the winner check), ~2 bytes per move. Winning sequences, board states, and
legality are all derivable, so they are never stored.

## Design Decisions

- `server/src/notation.ts` exports `encodeGame(game)` and
  `decodeGame(line)`; decode returns config, moves, result, and final
  positions, throwing on any illegal line.
- The engine records move history on each game (`moves: number[]` of cell
  indices, `skips` interleaved) - a few bytes per move in memory.
- Every `GAME_COMPLETE` response includes `notation`, so any client, robot,
  or spectator can collect training data live.
- The server appends one TTN line per finished game (won/draw/timeout - not
  abandoned) to a data file, default `server/data/games.ttn`, configurable
  via `TTN_LOG` env var, disabled with `TTN_LOG=off`. Append is fire-and-
  forget with error logging - data collection must never affect gameplay.

## Scope

- [x] `notation.ts` with encode/decode + replay validation.
- [x] Engine: move/skip recording, notation on completion, file append.
- [x] Tests: round-trip fuzz (random games of every size/result encode ->
      decode -> identical), skip handling, known-vector tests, malformed
      line rejection.
- [x] Docs: notation spec in `server/claude.md`.

## Open Questions

- Record timestamps per move for ML? Resolved: not in v1 - keep it tiny;
  a `2` version can add a clock track later.

## Files Likely To Change

`server/src/notation.ts` (new), `server/src/model.ts`,
`server/src/TiciTacaToeyGameEngine.ts`, `server/test/notation.test.ts`
(new), `server/claude.md`, `.gitignore` (data file).

## Recovery Hints

`bun test notation` exercises everything. If the engine half-records moves,
grep for `recordMove` / `game.moves`.

## Checkpoints

- 2026-06-10 13:36 IST - Task created; format frozen as TTN v1.
- 2026-06-10 17:10 IST - notation.ts (encode/decode with replay validation),
  engine records move + skip tokens, notation attached on completion and
  included in GAME_COMPLETE, optional append-to-file via TTN_LOG (server
  defaults to data/games.ttn, engine defaults off so tests never write).
- 2026-06-11 04:58 IST - Tests green: known vectors, malformed-line rejection, skip seats,
  200-game round-trip fuzz against real engine games. Live e2e produced
  lines like 1.3.3.2.u.030402010607.w1 in the data file. Completed.
