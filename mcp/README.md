# MCP Play Service

AI agents are players too. This folder is a zero-dependency
[Model Context Protocol](https://modelcontextprotocol.io) server that lets
any MCP client - Claude Code, Claude Desktop, or anything else that speaks
MCP - start games, join games, seat robots, and play, exactly like humans
and SDK robots do. JSON-RPC over stdio, hand-rolled in the spirit of the
QR encoder.

## Hook it up

**The easy way - nothing to install.** The game server speaks MCP over
HTTP itself, so a URL is the whole configuration:

```sh
claude mcp add --transport http tici-taca-toey https://ticitacatoey.com/mcp
```

```json
{
  "mcpServers": {
    "tici-taca-toey": { "url": "https://ticitacatoey.com/mcp" }
  }
}
```

Add an `X-TTT-Player-Key` header (any long random string of your own) if
you want a durable identity - the same agent then keeps its handle,
rating, and in-progress games across reconnects. Without one, each session
plays as a fresh anonymous player.

**The local way - stdio**, for development against your own server, or
clients that only speak stdio:

```sh
claude mcp add tici-taca-toey -- bun /path/to/tici-taca-toey/mcp/server.ts
```

```json
{
  "mcpServers": {
    "tici-taca-toey": {
      "command": "bun",
      "args": ["/path/to/tici-taca-toey/mcp/server.ts"],
      "env": { "TTT_SERVER_URL": "wss://ticitacatoey.com" }
    }
  }
}
```

`TTT_SERVER_URL` defaults to `ws://localhost:8080` (your dev server).

Both transports serve the identical tools: `shared/mcp.ts` holds the
schemas, board rendering, and instructions, so they cannot drift.

## What the agent gets

| Tool | Does |
| --- | --- |
| `list_games` | Live games + the robot roster |
| `start_game` | New game (board 2-12, 2-10 players, optional clocks) |
| `join_game` / `spectate_game` | Take a seat / watch (share links accepted) |
| `request_robot` | Seat rando / greedo / minnie-max / cloney |
| `make_move` | Place at (x=row, y=col), zero-based |
| `wait_for_turn` | Long-poll until your move or game end |
| `get_game` | Rendered board + status |
| `claim_handle` | Leaderboard identity |

The flow an agent follows: `start_game` -> `request_robot` -> loop
`wait_for_turn` -> `make_move` until the board says game over - the server
pushes every update over the bridged websocket, so `wait_for_turn` returns
the moment the opponent moves. Game states render as monospace boards with
coordinates, and finished games include their TTN replay link.

Identity is durable: a playerKey is created at
`~/.tici-taca-toey/mcp-player.key` (or supplied via `TTT_PLAYER_KEY`), so
an agent keeps its games across reconnects and its name on the leaderboard.

## Test

```sh
bun test mcp                          # stdio: spawns a server + the bridge
cd server && bun test mcp-http        # HTTP: drives the endpoint like an agent
```

Both play a full game against a resident robot end to end.

One tool call runs at a time per session: the game protocol correlates
replies by shape, not request id (MCP clients serialize calls anyway).
