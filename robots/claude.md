# Robots Instructions

This file governs work inside `robots/`. The root
[`claude.md`](../claude.md) applies.

- Runnable reference robots built on the SDK: `bun robots/<name>.ts [url]`.
  Keep the playful names (rando, greedo, minnie-max).
- Shared move-evaluation helpers live in `strategy.ts` - deliberately
  here, not in the SDK (the SDK stays strategy-neutral). They are
  variant-aware: `isWinningPlacement` uses `shared/rules.ts` when a game
  requires several sequences or has teams (teammates' marks count), and
  `isSameSide` tells a robot whom it should actually block.
- Server-seated copies of these live in `server/src/residents.ts`
  (self-contained on purpose); behavior changes here should be mirrored
  there when they matter.
- Verify: `bun run typecheck` inside `sdk/`, plus a live game against a
  dev server when behavior changed.
