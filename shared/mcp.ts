// The agent-facing contract for the MCP play service, in one place.
//
// Two transports serve these same tools:
//   - mcp/server.ts        stdio, bridged to the server over a websocket
//   - server/src/mcp.ts    streamable HTTP, in-process inside the game server
//
// Only the plumbing differs; what an agent sees - tool names, schemas,
// board rendering, instructions - is defined here so the two can never
// drift apart.
import { Game, GameStatus } from "./model";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = {
  name: "tici-taca-toey",
  title: "Tici Taca Toey",
  version: "1.0.0",
};

export const MCP_INSTRUCTIONS =
  "You are connected to tici-taca-toey, a multiplayer tic-tac-toe server " +
  "(boards 2-12, 2-10 players, optional chess clocks). To play: start_game " +
  "(or list_games + join_game), request_robot for an opponent, then loop " +
  "wait_for_turn -> make_move until the game ends. Coordinates are " +
  "zero-based: x is the row, y is the column. claim_handle once to get on " +
  "the leaderboard.";

const SYMBOLS = ["X", "O", "A", "B", "C", "D", "E", "F", "G", "H"];

export const MCP_COMPLETED_STATUSES = new Set<string>([
  GameStatus.GAME_WON,
  GameStatus.GAME_ENDS_IN_A_DRAW,
  GameStatus.GAME_WON_BY_TIMEOUT,
  GameStatus.GAME_ABANDONED,
]);

// A game as a monospace board an agent can read, plus what to do next.
export const renderGame = (
  game: Game,
  me: string,
  names: Record<string, string>,
  webOrigin: string
): string => {
  const nameOf = (id: string) =>
    `${names[id] ?? id.slice(0, 8)}${id === me ? " (you)" : ""}`;
  const seatOf = (id: string) => game.players.indexOf(id);
  const lines: string[] = [];
  lines.push(`game "${game.name}" [${game.gameId}]`);
  lines.push(
    `${game.boardSize}x${game.boardSize} board, win ${game.winningSequenceLength} in a row, ${game.players.length}/${game.playerCount} seats`
  );
  lines.push(
    `players: ${
      game.players
        .map((id) => `${SYMBOLS[seatOf(id) % SYMBOLS.length]}=${nameOf(id)}`)
        .join(", ") || "(none yet)"
    }`
  );
  if (game.timed) {
    lines.push(
      `clocks: ${game.players
        .map(
          (id) =>
            `${SYMBOLS[seatOf(id) % SYMBOLS.length]} ${(
              (game.timers[id]?.timeLeft ?? 0) / 1000
            ).toFixed(0)}s`
        )
        .join(", ")}`
    );
  }
  lines.push("board (rows are x, columns are y):");
  lines.push(
    `     ${Array.from({ length: game.boardSize }, (_, y) =>
      String(y).padStart(2)
    ).join(" ")}`
  );
  game.positions.forEach((row, x) => {
    lines.push(
      `x=${String(x).padStart(2)} ${row
        .map((cell) => {
          const seat = seatOf(cell);
          return (seat >= 0 ? SYMBOLS[seat % SYMBOLS.length] : ".").padStart(2);
        })
        .join(" ")}`
    );
  });
  if (MCP_COMPLETED_STATUSES.has(game.status)) {
    const result =
      game.status === GameStatus.GAME_ENDS_IN_A_DRAW
        ? "draw"
        : game.status === GameStatus.GAME_ABANDONED
        ? "abandoned"
        : `won by ${nameOf(game.winner)}${
            game.status === GameStatus.GAME_WON_BY_TIMEOUT ? " on time" : ""
          }`;
    lines.push(`status: game over - ${result}`);
    if (game.notation) {
      lines.push(`replay: ${webOrigin}/replay/${game.notation}`);
    }
  } else if (game.status === GameStatus.WAITING_FOR_PLAYERS) {
    lines.push(
      `status: waiting for players - share ${webOrigin}/play/${game.gameId} or call request_robot`
    );
  } else {
    lines.push(
      game.turn === me
        ? "status: YOUR MOVE - call make_move with empty x,y"
        : `status: waiting for ${nameOf(game.turn)} - call wait_for_turn`
    );
  }
  return lines.join("\n");
};

// --- tool definitions ------------------------------------------------------

export const MCP_DEFAULT_WAIT_SECONDS = 60;
export const MCP_MAX_WAIT_SECONDS = 300;

const gameIdArg = {
  type: "object",
  properties: {
    gameId: {
      type: "string",
      description: "Game id (a pasted share link also works)",
    },
  },
  required: ["gameId"],
};

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "list_games",
    description:
      "List live games on the server (joinable and spectatable) and the roster of available robots.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "start_game",
    description:
      "Start a new game and take the first seat. Others join via join_game/share link, or call request_robot for an opponent.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Display name for the game" },
        boardSize: { type: "number", description: "2-12, default 3" },
        playerCount: { type: "number", description: "2-10, default 2" },
        winningSequenceLength: {
          type: "number",
          description: "2-boardSize, default 3",
        },
        timePerPlayer: {
          type: "number",
          description: "Optional chess clock in ms (5000-3600000)",
        },
        incrementPerPlayer: {
          type: "number",
          description: "Optional per-move increment in ms",
        },
      },
    },
  },
  {
    name: "join_game",
    description: "Join a waiting game as a player.",
    inputSchema: gameIdArg,
  },
  {
    name: "spectate_game",
    description:
      "Watch a game without playing; broadcasts keep local state fresh.",
    inputSchema: gameIdArg,
  },
  {
    name: "request_robot",
    description:
      "Seat a server robot in a waiting game you are in. Robots: rando (random), greedo (win/block), minnie-max (minimax), cloney (learned). Omit robotName for the least-loaded match.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string" },
        robotName: { type: "string", description: "Optional specific robot" },
      },
      required: ["gameId"],
    },
  },
  {
    name: "make_move",
    description:
      "Place your mark at (x, y) - x is the row, y is the column, both zero-based. Only legal on your turn in an empty cell.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string" },
        x: { type: "number", description: "Row, 0-based" },
        y: { type: "number", description: "Column, 0-based" },
      },
      required: ["gameId", "x", "y"],
    },
  },
  {
    name: "wait_for_turn",
    description:
      "Block until it is your move in the given game (or the game ends), then return the fresh state. Call between your moves instead of polling.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string" },
        timeoutSeconds: {
          type: "number",
          description: `Max seconds to wait (default ${MCP_DEFAULT_WAIT_SECONDS}, cap ${MCP_MAX_WAIT_SECONDS})`,
        },
      },
      required: ["gameId"],
    },
  },
  {
    name: "get_game",
    description: "Current state of a game you play in or spectate.",
    inputSchema: gameIdArg,
  },
  {
    name: "claim_handle",
    description:
      "Claim a unique handle (2-20 chars, a-z 0-9 _ -) so wins are rated on the leaderboard under your name.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" } },
      required: ["handle"],
    },
  },
];

// Accepts a bare id or a pasted share/replay URL.
export const parseGameId = (raw: unknown): string => {
  const text = String(raw ?? "").trim();
  const fromUrl = /(?:play|spectate)\/([A-Za-z0-9-]+)/.exec(text);
  return fromUrl ? fromUrl[1] : text;
};
