# ML playground v1: the learning path

**Status:** Completed
**Owner:** claude
**Estimated effort:** medium (new `playground/` folder, no server/web changes)
**Created:** 2026-07-19 15:49 IST
**Completed:** 2026-07-19 15:57 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Make the "TTN is training data" promise real with the smallest genuine
learning loop: recorded + self-played games -> a behavior-cloned policy ->
an SDK robot that plays it. A teaching lab (readable in one sitting, zero
dependencies), not a framework.

## Scope

- [x] `playground/policy.ts` - shared state encoding: mover-relative seats +
      canonicalization over the 8 square symmetries; `pickMove` guarded so a
      corrupt policy can never emit an illegal move.
- [x] `playground/train.ts` - ingests `data/games.ttn` (server decoder),
      tops up with `--selfplay` games through the real engine (greedy/random
      teacher mix), counts winners' moves (draws half-weight), writes
      argmax-per-state `policy.json`, and reports win/draw/loss vs random
      and greedy rivals.
- [x] `playground/learner.ts` - SDK robot `cloney` playing the policy,
      advertising only its trained configuration, random fallback on unseen
      states.
- [x] `playground/README.md` - the learning path narrative + next steps.
- [x] `sdk/tsconfig.json` includes `../playground`; `policy.json`
      gitignored.
- [x] Verify: `bun run typecheck` in `sdk/`, a full training run with sane
      eval numbers (must clearly beat random), live `cloney` game via
      "+ robot" against a dev server.
- [x] Docs: root `claude.md` repository map + verification, `server/claude.md`
      notation section pointer, `README.md` mention.

## Open Questions

None blocking. v1 fixes the config at 3x3 / win 3 / 2 players; the encoding
generalizes, the dataset does not yet (recorded in README as a next step).

## Files Likely To Change

- `playground/policy.ts`, `playground/train.ts`, `playground/learner.ts`,
  `playground/README.md` (new)
- `sdk/tsconfig.json`, `.gitignore`
- `claude.md`, `server/claude.md`, `README.md`, `TODO.md`

## Recovery Hints

Everything lives in `playground/`; nothing in `server/` or `web/` changes.
If found half-done: `bun run typecheck` in `sdk/` covers the folder, and
`bun playground/train.ts --selfplay 500 --eval 100` is a fast smoke of the
whole loop. The learner needs a running dev server to verify.

## Checkpoints

- 2026-07-19 15:49 IST - Plan written; policy.ts, train.ts, learner.ts,
  README drafted; sdk typecheck wired; verification next.
- 2026-07-19 15:57 IST - Verified and completed. sdk typecheck green. Full
  run `bun playground/train.ts`: 6002 games (2 recorded + 6000 self-play)
  -> 604 canonical states in ~0.5s; eval vs random W 93.5% / D 6.5% /
  L 0.0%, vs greedy W 25.3% / D 74.8% / L 0.0% - the clone never loses.
  Live smoke: server + `bun playground/learner.ts` + ws client requesting
  robot "cloney" -> seated and replied legally (SMOKE_OK).
