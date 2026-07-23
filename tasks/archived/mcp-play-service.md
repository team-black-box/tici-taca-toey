# MCP play service: AI agents as players

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium (new `mcp/` folder, no server changes)
**Created:** 2026-07-20 07:38 IST
**Completed:** 2026-07-20 11:10 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Let any MCP-capable AI agent (Claude Code, Claude Desktop, other MCP
clients) play tici-taca-toey like humans and robots do: start and join
games, seat robots, move, spectate, appear on leaderboards. Zero
dependencies - the MCP protocol is newline-delimited JSON-RPC over stdio,
hand-rolled in the spirit of the QR encoder.

## Scope

- [x] `mcp/server.ts` - stdio MCP server (initialize/tools list+call/ping,
      JSON-RPC 2.0) bridging to the game server websocket with the same
      reconnect + durable playerKey machinery as other clients.
- [x] Tools: `list_games`, `start_game`, `join_game`, `spectate_game`,
      `request_robot`, `make_move`, `wait_for_turn` (long-poll until your
      move/game end - what makes turn-based agent play work),
      `get_game`, `claim_handle`. Text board rendering agents can read.
- [x] Identity: `TTT_PLAYER_KEY` env override, else a key persisted at
      `~/.tici-taca-toey/mcp-player.key` (0600) so agents resume games and
      keep their leaderboard identity.
- [x] E2E test: spawn the real game server + the MCP server, drive the
      JSON-RPC handshake and a full agent-vs-resident-robot game through
      stdio.
- [x] Docs: `mcp/README.md` (client setup incl. `claude mcp add`), root
      claude.md repository map + verification, README layout entry.

## Open Questions

- None blocking. Single in-flight tool call per session is documented (the
  websocket protocol has no request ids; MCP clients serialize calls).

## Files Likely To Change

`mcp/server.ts`, `mcp/mcp.test.ts`, `mcp/README.md` (new);
`sdk/tsconfig.json` (typecheck coverage), `claude.md`, `README.md`,
`TODO.md`.

## Recovery Hints

`bun mcp/server.ts` speaks MCP on stdio (logs on stderr). Fast smoke:
`bun test mcp` from the repo root spawns everything and plays a robot game.

## Checkpoints

- 2026-07-20 07:38 IST - Plan written; implementation starting.
- 2026-07-20 11:10 IST - Completed. server.ts (~550 lines, zero deps)
  with 9 tools; e2e drives initialize -> tools/list -> full agent-vs-rando
  game -> error handling (3 pass / 44 expects; verified via an out-of-tree
  copy because this session's harness severs child stdio for tests located
  inside the repo - the file itself is correct and CI runs it via the new
  mcp job in main.yml). Reads stdin via Bun.stdin.stream() explicitly.
