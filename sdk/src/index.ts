// tici-taca-toey robot SDK. Zero dependencies; runs anywhere with a global
// WebSocket (Bun, Node >= 22, browsers).
//
//   import { TiciTacaToeyRobot, emptyCells } from "tici-taca-toey-sdk";
//
//   new TiciTacaToeyRobot({
//     name: "rando",
//     capabilities: {
//       boardSizes: { min: 2, max: 12 },
//       playerCounts: { min: 2, max: 10 },
//       maxConcurrentGames: 25,
//       timed: true,
//     },
//     onTurn: ({ game }) => {
//       const cells = emptyCells(game);
//       return cells[Math.floor(Math.random() * cells.length)];
//     },
//   }).start();
//
// The robot registers its capabilities; the server's scheduler seats it into
// games on demand. The SDK handles reconnection (resuming its games via a
// durable playerKey), concurrent games, turn deduplication, and move
// submission. Your onTurn just looks at a game and returns a move.

export interface RobotCapabilities {
  boardSizes: { min: number; max: number };
  playerCounts: { min: number; max: number };
  maxConcurrentGames: number;
  timed: boolean;
  minTimePerPlayer?: number;
}

import type { Game } from "../../shared/model";

// The game as a robot sees it: the shared wire shape, with status widened
// to a plain string so robot authors compare against literals without
// importing the enum.
export type GameView = Omit<Game, "status"> & { status: string };

export interface Move {
  x: number;
  y: number;
}

export interface TurnContext {
  game: GameView;
  you: string;
}

export interface RobotOptions {
  name: string;
  capabilities: RobotCapabilities;
  onTurn: (context: TurnContext) => Move | Promise<Move>;
  onGameComplete?: (game: GameView) => void;
  url?: string;
  playerKey?: string;
  quiet?: boolean;
}

const EMPTY = "-";
const COMPLETED = new Set([
  "GAME_WON",
  "GAME_ENDS_IN_A_DRAW",
  "GAME_ABANDONED",
  "GAME_WON_BY_TIMEOUT",
]);
const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;

export class TiciTacaToeyRobot {
  playerId = "";
  #options: RobotOptions;
  #url: string;
  #playerKey: string;
  #socket: WebSocket | null = null;
  #backoffMs = INITIAL_BACKOFF_MS;
  #stopped = false;
  // Last acted-on move log per game: one onTurn dispatch per position, no
  // matter how many broadcasts (clock updates etc.) carry the same state.
  #acted = new Map<string, string>();

  constructor(options: RobotOptions) {
    this.#options = options;
    this.#url = options.url ?? "ws://localhost:8080";
    this.#playerKey = options.playerKey ?? crypto.randomUUID();
  }

  start(): this {
    this.#stopped = false;
    this.#connect();
    return this;
  }

  stop() {
    this.#stopped = true;
    this.#socket?.close();
  }

  #log(...parts: unknown[]) {
    if (!this.#options.quiet) {
      console.log(`[${this.#options.name}]`, ...parts);
    }
  }

  #send(message: Record<string, unknown>) {
    if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(message));
    }
  }

  #connect() {
    const socket = new WebSocket(this.#url);
    this.#socket = socket;

    socket.addEventListener("open", () => {
      this.#backoffMs = INITIAL_BACKOFF_MS;
      this.#send({
        type: "REGISTER_ROBOT",
        name: this.#options.name,
        capabilities: this.#options.capabilities,
        playerKey: this.#playerKey,
      });
    });

    socket.addEventListener("message", (event) => {
      try {
        this.#handle(JSON.parse(String(event.data)));
      } catch (error) {
        console.error("Robot failed to handle a message", error);
      }
    });

    socket.addEventListener("close", () => {
      this.#socket = null;
      if (this.#stopped) {
        return;
      }
      this.#log(`disconnected, retrying in ${this.#backoffMs}ms`);
      setTimeout(() => this.#connect(), this.#backoffMs);
      this.#backoffMs = Math.min(this.#backoffMs * 2, MAX_BACKOFF_MS);
    });

    socket.addEventListener("error", () => {
      // close always follows and drives the reconnect
    });
  }

  #handle(message: {
    type?: string;
    error?: string;
    playerId?: string;
    game?: GameView;
  }) {
    if (message.error) {
      this.#log("server error:", message.error);
      return;
    }
    if (message.type === "REGISTER_ROBOT" && message.playerId) {
      this.playerId = message.playerId;
      this.#log(`registered as ${this.playerId}`);
      return;
    }
    const game = message.game;
    if (!game || !game.gameId) {
      return;
    }
    if (COMPLETED.has(game.status)) {
      if (this.#acted.delete(game.gameId) || game.players.includes(this.playerId)) {
        this.#log(`game ${game.name} finished: ${game.status}`);
        this.#options.onGameComplete?.(game);
      }
      return;
    }
    if (
      game.status !== "GAME_IN_PROGRESS" ||
      game.turn !== this.playerId ||
      !game.players.includes(this.playerId)
    ) {
      return;
    }
    if (this.#acted.get(game.gameId) === game.moveLog) {
      return; // already acting on this position
    }
    this.#acted.set(game.gameId, game.moveLog);

    Promise.resolve(this.#options.onTurn({ game, you: this.playerId }))
      .then((move) => {
        this.#send({
          type: "MAKE_MOVE",
          gameId: game.gameId,
          coordinateX: move.x,
          coordinateY: move.y,
        });
      })
      .catch((error) => {
        console.error(`Robot onTurn failed for game ${game.gameId}`, error);
      });
  }
}

// --- Helpers for writing robots ---
//
// The SDK is deliberately strategy-neutral: it gives robots plumbing
// (connection, registration, turn dispatch) and board *reading*, never
// board *winning*. Helpers that evaluate moves or find wins belong in your
// robot, not here - see robots/strategy.ts for the reference robots' own
// strategy code.

export const emptyCells = (game: GameView): Move[] => {
  const cells: Move[] = [];
  game.positions.forEach((row, x) =>
    row.forEach((cell, y) => {
      if (cell === EMPTY) {
        cells.push({ x, y });
      }
    })
  );
  return cells;
};
