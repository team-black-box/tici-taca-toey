# MCP Service Instructions

This file governs work inside `mcp/`. The root
[`claude.md`](../claude.md) applies. `README.md` here covers client setup.

- Zero dependencies: MCP is newline-delimited JSON-RPC 2.0 over stdio,
  hand-rolled in `server.ts`. Logs go to stderr; stdout carries only
  protocol frames.
- The bridge correlates game-server replies by shape (the protocol has no
  request ids), so tool calls run one at a time per session.
- Tools must never let a server error crash the process - errors return as
  `isError` content.
- Verify: `bun run typecheck` inside `sdk/` and `bun test mcp` from the
  repo root (spawns a real server, plays a robot game end to end).
