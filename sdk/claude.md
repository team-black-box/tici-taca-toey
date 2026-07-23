# SDK Instructions

This file governs work inside `sdk/`. The root
[`claude.md`](../claude.md) applies, especially the stability and
personality rules. `README.md` here is the user-facing guide.

- One file (`src/index.ts`), zero dependencies, runs anywhere with a
  global WebSocket. Keep it that way.
- **Strategy-neutral by policy**: the SDK ships plumbing and board reading
  (`emptyCells`) only - never move-evaluation helpers. Brains live with
  the robots (`robots/strategy.ts`).
- `GameView` mirrors the server's game shape; protocol changes that touch
  game state must update it in the same change (see the root protocol
  rule).
- Verify: `bun run typecheck` here (covers `robots/`, `playground/`,
  `mcp/` too) and a live run of a reference robot when behavior changed.
