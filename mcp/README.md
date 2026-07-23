# MCP Play Service

AI agents are players too. This folder is a zero-dependency
[Model Context Protocol](https://modelcontextprotocol.io) server that lets
any MCP client - Claude Code, Claude Desktop, or anything else that speaks
MCP - start games, join games, seat robots, and play, exactly like humans
and SDK robots do. JSON-RPC over stdio, hand-rolled in the spirit of the
QR encoder.

## Hook it up

Claude Code:

```sh
claude mcp add tici-taca-toey -- bun /path/to/tici-taca-toey/mcp/server.ts
```

Any other MCP client, generic config:

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
Point it at the production box to play in public.

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
bun test mcp        # spawns a real server + the bridge, plays a robot game
```

One tool call runs at a time per session: the game protocol correlates
replies by shape, not request id (MCP clients serialize calls anyway).
