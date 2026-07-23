# MCP Service Instructions

This file governs work inside `mcp/`. The root
[`claude.md`](../claude.md) applies. `README.md` here covers client setup.

- **Two transports, one contract.** `server.ts` here is stdio (JSON-RPC
  over stdin/stdout, bridged to the game server by websocket).
  `server/src/mcp.ts` is streamable HTTP served by the game server itself,
  where a session is an in-process player - no bridge at all. Tool
  schemas, board rendering, and instructions live in `shared/mcp.ts`; both
  transports serve them, so agents always see the same thing. The local
  `TOOLS` record here supplies handlers only - its description and
  inputSchema fields are vestigial, `MCP_TOOLS` is what gets advertised.
- Zero dependencies: hand-rolled JSON-RPC. Logs go to stderr; stdout
  carries only protocol frames.
- The bridge correlates game-server replies by shape (the protocol has no
  request ids), so tool calls run one at a time per session.
- Tools must never let a server error crash the process - errors return as
  `isError` content.
- Verify: `bun run typecheck` inside `sdk/`, `bun test mcp` from the repo
  root (stdio), and `bun test mcp-http` inside `server/` (HTTP). Both play
  a full game against a resident robot.
