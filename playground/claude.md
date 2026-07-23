# Playground Instructions

This file governs work inside `playground/`. The root
[`claude.md`](../claude.md) applies. `README.md` here is the learning-path
narrative - keep it teaching-first.

- Zero dependencies; the trainer imports the real engine and notation from
  `server/src/` so there is exactly one copy of the rules.
- `policy.ts` is shared by trainer and player - both sides of the encoding
  must always come from this one module.
- `policy.json` is generated output; it stays gitignored.
- Verify: `bun run typecheck` inside `sdk/` and a full
  `bun playground/train.ts` run - the eval report must clearly beat
  random, and `cloney` must still seat via "+ robot".
