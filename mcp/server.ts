#!/usr/bin/env bun
// tici-taca-toey MCP server: lets AI agents play like humans and robots do.
//
//   bun mcp/server.ts                      # bridge to ws://localhost:8080
//   TTT_SERVER_URL=wss://ticitacatoey.com bun mcp/server.ts
//
// Speaks the Model Context Protocol over stdio: newline-delimited JSON-RPC
// 2.0, hand-rolled with zero dependencies in the spirit of the rest of this
// repository. One tool call at a time per session (the game protocol has no
// request ids; MCP clients serialize calls).
//
// Logs go to stderr - stdout carries only protocol frames.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SERVER_URL = process.env.TTT_SERVER_URL ?? "ws://localhost:8080";
const PROTOCOL_VERSION = "2025-06-18";
const COMMAND_TIMEOUT_MS = 8_000;
const DEFAULT_WAIT_SECONDS = 60;
const MAX_WAIT_SECONDS = 300;
const SYMBOLS = ["X", "O", "A", "B", "C", "D", "E", "F", "G", "H"];
const COMPLETED_STATUSES = new Set([
  "GAME_WON",
  "GAME_ENDS_IN_A_DRAW",
  "GAME_WON_BY_TIMEOUT",
  "GAME_ABANDONED",
]);

const log = (...parts: unknown[]) => {
  console.error("[tici-taca-toey-mcp]", ...parts);
};

// --- durable identity (same idea as the web/mobile clients) ---------------

const loadPlayerKey = (): string => {
  if (process.env.TTT_PLAYER_KEY) {
    return process.env.TTT_PLAYER_KEY;
  }
  const dir = join(homedir(), ".tici-taca-toey");
  const path = join(dir, "mcp-player.key");
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    const fresh = crypto.randomUUID();
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, fresh, { mode: 0o600 });
    } catch (error) {
      log("could not persist player key; identity is session-only", error);
    }
    return fresh;
  }
};

// --- game state, as agents should read it ---------------------------------

// The shared wire shape, status widened to string for literal comparisons.
type GameState = Omit<
  import("../shared/model").Game,
  "status"
> & { status: string };

const webOrigin = SERVER_URL.replace(/^ws/, "http").replace(/\/+$/, "");

const renderGame = (
  game: GameState,
  me: string,
  names: Record<string, string>
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
    `players: ${game.players
      .map((id) => `${SYMBOLS[seatOf(id) % SYMBOLS.length]}=${nameOf(id)}`)
      .join(", ") || "(none yet)"}`
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
  const header = `     ${Array.from({ length: game.boardSize }, (_, y) =>
    String(y).padStart(2)
  ).join(" ")}`;
  lines.push("board (rows are x, columns are y):");
  lines.push(header);
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
  if (COMPLETED_STATUSES.has(game.status)) {
    const result =
      game.status === "GAME_ENDS_IN_A_DRAW"
        ? "draw"
        : game.status === "GAME_ABANDONED"
        ? "abandoned"
        : `won by ${nameOf(game.winner)}${
            game.status === "GAME_WON_BY_TIMEOUT" ? " on time" : ""
          }`;
    lines.push(`status: game over - ${result}`);
    if (game.notation) {
      lines.push(`replay: ${webOrigin}/replay/${game.notation}`);
    }
  } else if (game.status === "WAITING_FOR_PLAYERS") {
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

// --- the websocket bridge -------------------------------------------------

type Waiter = {
  predicate: (response: Record<string, unknown>) => boolean;
  resolve: (response: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

class Bridge {
  playerId = "";
  games = new Map<string, GameState>();
  names: Record<string, string> = {};
  lobby: unknown[] = [];
  robots: unknown[] = [];
  #socket: WebSocket | null = null;
  #playerKey = loadPlayerKey();
  #backoffMs = 500;
  #registered: Promise<void>;
  #markRegistered: (() => void) | null = null;
  #waiters: Waiter[] = [];

  constructor() {
    this.#registered = new Promise((resolve) => {
      this.#markRegistered = resolve;
    });
    this.#connect();
  }

  #connect() {
    this.#socket = new WebSocket(SERVER_URL);
    this.#socket.onopen = () => {
      this.#backoffMs = 500;
      this.#send({
        type: "REGISTER_PLAYER",
        name: "agent",
        playerKey: this.#playerKey,
      });
    };
    this.#socket.onmessage = (event) => {
      try {
        this.#handle(JSON.parse(String(event.data)));
      } catch (error) {
        log("unparseable server message", error);
      }
    };
    this.#socket.onclose = () => {
      this.#socket = null;
      setTimeout(() => this.#connect(), this.#backoffMs);
      this.#backoffMs = Math.min(this.#backoffMs * 2, 15_000);
    };
    this.#socket.onerror = () => {
      // close always follows
    };
  }

  #handle(response: Record<string, unknown>) {
    if (response.type === "REGISTER_PLAYER" && response.playerId) {
      this.playerId = String(response.playerId);
      this.#markRegistered?.();
    }
    if (response.type === "LIST_GAMES") {
      this.lobby = (response.games as unknown[]) ?? [];
      this.robots = (response.robots as unknown[]) ?? [];
    }
    const game = response.game as GameState | undefined;
    if (game?.gameId) {
      this.games.set(game.gameId, game);
    }
    const players = response.players as
      | Record<string, { name?: string }>
      | undefined;
    if (players) {
      Object.entries(players).forEach(([id, player]) => {
        if (player?.name) {
          this.names[id] = player.name;
        }
      });
    }
    const spectators = response.spectators as
      | Record<string, { name?: string }>
      | undefined;
    if (spectators) {
      Object.entries(spectators).forEach(([id, player]) => {
        if (player?.name) {
          this.names[id] = player.name;
        }
      });
    }
    this.#waiters = this.#waiters.filter((waiter) => {
      if (response.type === "ERROR") {
        waiter.reject(
          new Error(String(response.message ?? response.error ?? "error"))
        );
        return false;
      }
      if (waiter.predicate(response)) {
        waiter.resolve(response);
        return false;
      }
      return true;
    });
  }

  #send(message: Record<string, unknown>) {
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(message));
    } else {
      throw new Error(`not connected to ${SERVER_URL} yet - try again`);
    }
  }

  async ready() {
    await this.#registered;
  }

  // Send a message and resolve on the first response matching `predicate`
  // (or reject on the first ERROR - the protocol has no request ids, which
  // is why tool calls run one at a time).
  command(
    message: Record<string, unknown>,
    predicate: (response: Record<string, unknown>) => boolean,
    timeoutMs = COMMAND_TIMEOUT_MS
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { predicate, resolve, reject };
      const timer = setTimeout(() => {
        this.#waiters = this.#waiters.filter((each) => each !== waiter);
        reject(new Error("no reply from the game server in time"));
      }, timeoutMs);
      const settle =
        <T>(fn: (value: T) => void) =>
        (value: T) => {
          clearTimeout(timer);
          fn(value);
        };
      waiter.resolve = settle(resolve);
      waiter.reject = settle(reject);
      this.#waiters.push(waiter);
      try {
        this.#send(message);
      } catch (error) {
        clearTimeout(timer);
        this.#waiters = this.#waiters.filter((each) => each !== waiter);
        reject(error as Error);
      }
    });
  }

  // Resolve when it is our turn in gameId (or the game completed), without
  // sending anything - the long-poll behind wait_for_turn.
  waitForTurn(gameId: string, timeoutMs: number): Promise<void> {
    const isReadyNow = (game: GameState | undefined) =>
      game !== undefined &&
      (game.turn === this.playerId || COMPLETED_STATUSES.has(game.status));
    if (isReadyNow(this.games.get(gameId))) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const waiter: Waiter = {
        predicate: (response) => {
          const game = response.game as GameState | undefined;
          return game?.gameId === gameId && isReadyNow(game);
        },
        resolve: () => resolve(),
        reject: () => resolve(),
      };
      setTimeout(() => {
        this.#waiters = this.#waiters.filter((each) => each !== waiter);
        resolve();
      }, timeoutMs);
      this.#waiters.push(waiter);
    });
  }
}

// --- tools ----------------------------------------------------------------

const bridge = new Bridge();

// Accepts a bare id or a pasted share/replay URL.
const parseGameId = (raw: unknown): string => {
  const text = String(raw ?? "").trim();
  const fromUrl = /(?:play|spectate)\/([A-Za-z0-9-]+)/.exec(text);
  return fromUrl ? fromUrl[1] : text;
};

const stateOf = (gameId: string): string => {
  const game = bridge.games.get(gameId);
  if (!game) {
    return `no local state for game ${gameId} - join_game or spectate_game first`;
  }
  return renderGame(game, bridge.playerId, bridge.names);
};

interface Tool {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

const gameIdArg = {
  type: "object",
  properties: {
    gameId: {
      type: "string",
      description: "Game id (a pasted share link also works)",
    },
  },
  required: ["gameId"],
} as const;

const TOOLS: Record<string, Tool> = {
  list_games: {
    description:
      "List live games on the server (joinable and spectatable) and the roster of available robots.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const response = await bridge.command(
        { type: "LIST_GAMES" },
        (each) => each.type === "LIST_GAMES"
      );
      return JSON.stringify(
        { games: response.games ?? [], robots: response.robots ?? [] },
        null,
        2
      );
    },
  },
  start_game: {
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
    handler: async (args) => {
      const response = await bridge.command(
        {
          type: "START_GAME",
          name: String(args.name ?? "Agent Arena"),
          boardSize: Number(args.boardSize ?? 3),
          playerCount: Number(args.playerCount ?? 2),
          winningSequenceLength: Number(args.winningSequenceLength ?? 3),
          ...(args.timePerPlayer
            ? {
                timePerPlayer: Number(args.timePerPlayer),
                incrementPerPlayer: Number(args.incrementPerPlayer ?? 1000),
              }
            : {}),
        },
        (each) => each.type === "START_GAME" && each.game !== undefined
      );
      return stateOf((response.game as GameState).gameId);
    },
  },
  join_game: {
    description: "Join a waiting game as a player.",
    inputSchema: gameIdArg,
    handler: async (args) => {
      const gameId = parseGameId(args.gameId);
      await bridge.command(
        { type: "JOIN_GAME", gameId },
        (each) =>
          each.type === "JOIN_GAME" &&
          (each.game as GameState | undefined)?.gameId === gameId
      );
      return stateOf(gameId);
    },
  },
  spectate_game: {
    description: "Watch a game without playing; broadcasts keep local state fresh.",
    inputSchema: gameIdArg,
    handler: async (args) => {
      const gameId = parseGameId(args.gameId);
      await bridge.command(
        { type: "SPECTATE_GAME", gameId },
        (each) =>
          each.type === "SPECTATE_GAME" &&
          (each.game as GameState | undefined)?.gameId === gameId
      );
      return stateOf(gameId);
    },
  },
  request_robot: {
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
    handler: async (args) => {
      const gameId = parseGameId(args.gameId);
      await bridge.command(
        {
          type: "REQUEST_ROBOT",
          gameId,
          ...(args.robotName ? { robotName: String(args.robotName) } : {}),
        },
        (each) =>
          each.type === "JOIN_GAME" &&
          (each.game as GameState | undefined)?.gameId === gameId
      );
      return stateOf(gameId);
    },
  },
  make_move: {
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
    handler: async (args) => {
      const gameId = parseGameId(args.gameId);
      await bridge.command(
        {
          type: "MAKE_MOVE",
          gameId,
          coordinateX: Number(args.x),
          coordinateY: Number(args.y),
        },
        (each) => {
          const game = each.game as GameState | undefined;
          return game?.gameId === gameId && each.type !== "SPECTATE_GAME";
        }
      );
      return stateOf(gameId);
    },
  },
  wait_for_turn: {
    description:
      "Block until it is your move in the given game (or the game ends), then return the fresh state. Call between your moves instead of polling.",
    inputSchema: {
      type: "object",
      properties: {
        gameId: { type: "string" },
        timeoutSeconds: {
          type: "number",
          description: `Max seconds to wait (default ${DEFAULT_WAIT_SECONDS}, cap ${MAX_WAIT_SECONDS})`,
        },
      },
      required: ["gameId"],
    },
    handler: async (args) => {
      const gameId = parseGameId(args.gameId);
      const timeout =
        Math.min(
          Math.max(Number(args.timeoutSeconds ?? DEFAULT_WAIT_SECONDS), 1),
          MAX_WAIT_SECONDS
        ) * 1000;
      await bridge.waitForTurn(gameId, timeout);
      return stateOf(gameId);
    },
  },
  get_game: {
    description: "Current state of a game you play in or spectate.",
    inputSchema: gameIdArg,
    handler: async (args) => stateOf(parseGameId(args.gameId)),
  },
  claim_handle: {
    description:
      "Claim a unique handle (2-20 chars, a-z 0-9 _ -) so wins are rated on the leaderboard under your name.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" } },
      required: ["handle"],
    },
    handler: async (args) => {
      const response = await bridge.command(
        { type: "CLAIM_HANDLE", handle: String(args.handle ?? "") },
        (each) => each.type === "HANDLE_CLAIMED"
      );
      return `handle claimed: ${response.handle}`;
    },
  },
};

// --- MCP over stdio (newline-delimited JSON-RPC 2.0) -----------------------

const INSTRUCTIONS = `You are connected to tici-taca-toey, a multiplayer tic-tac-toe server (boards 2-12, 2-10 players, optional chess clocks). To play: start_game (or list_games + join_game), request_robot for an opponent, then loop wait_for_turn -> make_move until the game ends. Coordinates are zero-based: x is the row, y is the column. claim_handle once to get on the leaderboard.`;

const reply = (id: unknown, result: unknown) => {
  console.log(JSON.stringify({ jsonrpc: "2.0", id, result }));
};

const replyError = (id: unknown, code: number, message: string) => {
  console.log(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }));
};

// Serialize tool calls: the bridge correlates responses by shape, not id.
let chain: Promise<unknown> = Promise.resolve();

const handleRequest = async (request: Record<string, unknown>) => {
  const { id, method } = request;
  const params = (request.params ?? {}) as Record<string, unknown>;
  if (method === "initialize") {
    const requested = String(params.protocolVersion ?? PROTOCOL_VERSION);
    reply(id, {
      protocolVersion: /^\d{4}-\d{2}-\d{2}$/.test(requested)
        ? requested
        : PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: {
        name: "tici-taca-toey",
        title: "Tici Taca Toey",
        version: "1.0.0",
      },
      instructions: INSTRUCTIONS,
    });
    return;
  }
  if (method === "ping") {
    reply(id, {});
    return;
  }
  if (method === "tools/list") {
    reply(id, {
      tools: Object.entries(TOOLS).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
    return;
  }
  if (method === "tools/call") {
    const tool = TOOLS[String(params.name)];
    if (!tool) {
      replyError(id, -32602, `unknown tool ${params.name}`);
      return;
    }
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    chain = chain.then(async () => {
      try {
        await bridge.ready();
        const text = await tool.handler(args);
        reply(id, { content: [{ type: "text", text }] });
      } catch (error) {
        reply(id, {
          content: [{ type: "text", text: String((error as Error).message) }],
          isError: true,
        });
      }
    });
    await chain;
    return;
  }
  if (id !== undefined) {
    replyError(id, -32601, `method not found: ${method}`);
  }
  // requests without ids are notifications (notifications/initialized...) -
  // nothing to do.
};

log(`bridging stdio MCP <-> ${SERVER_URL}`);
const decoder = new TextDecoder();
let buffered = "";
for await (const chunk of Bun.stdin.stream()) {
  buffered += decoder.decode(chunk, { stream: true });
  let newline = buffered.indexOf("\n");
  while (newline >= 0) {
    const line = buffered.slice(0, newline);
    buffered = buffered.slice(newline + 1);
    newline = buffered.indexOf("\n");
    if (line.trim() === "") {
      continue;
    }
    try {
      await handleRequest(JSON.parse(line));
    } catch {
      replyError(null, -32700, "parse error");
    }
  }
}
