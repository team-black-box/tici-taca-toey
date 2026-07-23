import {
  GameEngine,
  MessageTypes,
  GameStatus,
  Message,
  ErrorCodes,
  ConnectedPlayer,
  Game,
  GameError,
  Response,
  GameStore,
  PlayerStore,
  Robot,
  RobotStore,
  RobotCapabilities,
  GameSummary,
  RobotSummary,
  COMPLETED_GAME_STATUS,
  CalculateWinnerInputType,
  CalculateWinnerOutputType,
  WinningSequence,
  PlayerConnection,
} from "./model";
import { Timer } from "./timer";
import { countSequences, ownerOfSeat, teamOfSeat } from "./rules";
import { encodeCell, encodeClock, encodeGame, SKIP_CLOCK_TOKEN, SKIP_TOKEN } from "./notation";
import { GameDb, HANDLE_PATTERN } from "./db";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const EMPTY_POSITION = "-";

// Server-protecting limits. Generous for human play, hostile to abuse.
// Sized against bench/sockets.bench.ts: ~365 KB of RSS per connected
// socket, so 1000 games (>= 2000 sockets) is the practical ceiling of a
// 1 GB box. The connection cap in server.ts is the companion guard - games
// are cheap (~1 KB each), connections are what actually consume memory.
const MAX_ACTIVE_GAMES = Number(process.env.TTT_MAX_GAMES ?? 1000);
const MAX_NAME_LENGTH = 50;
const MAX_PLAYER_KEY_LENGTH = 64;
const MIN_PLAYER_KEY_LENGTH = 8;
const MAX_SPECTATORS_PER_GAME = 15;
const MIN_TIME_PER_PLAYER = 5 * 1000;
const MAX_TIME_PER_PLAYER = 60 * 60 * 1000;
const MAX_INCREMENT_PER_PLAYER = 60 * 1000;
const DEFAULT_INCREMENT_PER_PLAYER = 1000;
const MAX_ROBOT_CONCURRENT_GAMES = 100;
const MAX_WINNING_SEQUENCE_COUNT = 10;
const COMPLETED_GAME_TTL = 10 * 60 * 1000;
const STALE_GAME_TTL = 24 * 60 * 60 * 1000;
// A game nobody has touched for this long is dead: the mover walked away
// with the tab open, or nobody ever joined. Disconnects are already handled
// by the grace window; this catches the idle-but-connected case, which
// otherwise holds a robot seat and a capacity slot for a full day.
const IDLE_GAME_TTL = Number(process.env.TTT_IDLE_GAME_MS ?? 30 * 60 * 1000);
const DEFAULT_DISCONNECT_GRACE_MS = 60 * 1000;

export interface EngineOptions {
  // Append one TTN line per finished game to this file. Default: disabled.
  ttnLogPath?: string | null;
  // How long a disconnected player can come back and resume.
  disconnectGraceMs?: number;
  // Persistence for identities, handles, the archive, and ratings.
  db?: GameDb;
}

const hashPlayerKey = (key: string): string =>
  new Bun.CryptoHasher("sha256").update(key).digest("hex");

const sanitizeName = (name: unknown): string =>
  typeof name === "string" ? name.slice(0, MAX_NAME_LENGTH) : "";

const getTimerBaseFromGame = (game: Game) => {
  return Object.keys(game.timers).reduce(
    (acc: Record<string, { isRunning: boolean; timeLeft: number }>, playerId) => {
      acc[playerId] = {
        isRunning: game.timers[playerId].isRunning,
        timeLeft: game.timers[playerId].timeLeft,
      };
      return acc;
    },
    {}
  );
};

// Broadcast recipients must cost O(game seats), never O(all players on the
// server) - this is the hottest path in the engine (found by
// bench/engine.bench.ts: the old players-store scan degraded every
// broadcast as the server filled up).
const getConnectedPlayers = (players: PlayerStore, game: Game) =>
  game.players.flatMap((playerId) => {
    const player = players[playerId];
    return player !== undefined && player.connected ? [player] : [];
  });

const getConnectedSpectators = (players: PlayerStore, game: Game) =>
  game.spectators.flatMap((playerId) => {
    const player = players[playerId];
    return player !== undefined && player.connected ? [player] : [];
  });

const getPlayers = (connectedPlayers: ConnectedPlayer[]) => {
  return connectedPlayers.reduce(
    (acc: Record<string, { name: string; playerId: string }>, each) => {
      acc[each.playerId] = {
        name: each.name,
        playerId: each.playerId,
      };
      return acc;
    },
    {}
  );
};

const safeSend = (connection: PlayerConnection, data: string) => {
  try {
    connection.send(data);
  } catch (error) {
    // A dead socket must never take down the broadcast loop. The close
    // handler will clean the player up.
    console.error("Failed to send to a connection", error);
  }
};

const sendResponseToPlayers = (
  response: Response,
  connectedPlayers: ConnectedPlayer[],
  connectedSpectators: ConnectedPlayer[]
) => {
  const serialized = JSON.stringify(response);
  connectedPlayers.forEach((player) => {
    safeSend(player.connection, serialized);
  });
  const spectatorSerialized = JSON.stringify({
    ...response,
    type: MessageTypes.SPECTATE_GAME,
  });
  connectedSpectators.forEach((player) => {
    safeSend(player.connection, spectatorSerialized);
  });
};

const getFirstPlayerFromGame = (game: Game) => {
  return game.players[0];
};

const stopAllTimers = (game: Game) => {
  Object.values(game.timers).forEach((timer) => {
    (timer as Timer).destroy();
  });
};

const isValidCapabilities = (
  capabilities: unknown
): capabilities is RobotCapabilities => {
  if (typeof capabilities !== "object" || capabilities === null) {
    return false;
  }
  const caps = capabilities as RobotCapabilities;
  const validRange = (
    range: { min: number; max: number } | undefined,
    low: number,
    high: number
  ) =>
    typeof range === "object" &&
    range !== null &&
    Number.isInteger(range.min) &&
    Number.isInteger(range.max) &&
    range.min >= low &&
    range.max <= high &&
    range.min <= range.max;
  return (
    validRange(caps.boardSizes, 2, 12) &&
    validRange(caps.playerCounts, 2, 10) &&
    Number.isInteger(caps.maxConcurrentGames) &&
    caps.maxConcurrentGames >= 1 &&
    caps.maxConcurrentGames <= MAX_ROBOT_CONCURRENT_GAMES &&
    typeof caps.timed === "boolean" &&
    (caps.minTimePerPlayer === undefined ||
      (Number.isInteger(caps.minTimePerPlayer) && caps.minTimePerPlayer >= 0))
  );
};

class TiciTacaToeyGameEngine implements GameEngine {
  games: GameStore;
  players: PlayerStore;
  robots: RobotStore;
  #playerKeys: Map<string, string>;
  #graceTimers: Map<string, ReturnType<typeof setTimeout>>;
  #ttnLogPath: string | null;
  #ttnDirReady: boolean;
  #disconnectGraceMs: number;
  #db?: GameDb;
  #handleOutcomes: Map<string, { ok: boolean; handle: string; reason?: string }>;

  constructor(options: EngineOptions = {}) {
    this.games = {};
    this.players = {};
    this.robots = {};
    this.#playerKeys = new Map();
    this.#graceTimers = new Map();
    this.#ttnLogPath = options.ttnLogPath ?? null;
    this.#ttnDirReady = false;
    this.#disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.#db = options.db;
    this.#handleOutcomes = new Map();
  }

  // Durable identity: a secret playerKey maps to a stable public playerId.
  // Called by the server before the engine sees REGISTER_* messages, so a
  // reconnecting socket acts as the same player.
  get db(): GameDb | undefined {
    return this.#db;
  }

  resolvePlayerKey(playerKey: unknown, fallbackPlayerId: string): string {
    if (
      typeof playerKey !== "string" ||
      playerKey.length < MIN_PLAYER_KEY_LENGTH ||
      playerKey.length > MAX_PLAYER_KEY_LENGTH
    ) {
      return fallbackPlayerId;
    }
    const existing = this.#playerKeys.get(playerKey);
    if (existing) {
      return existing;
    }
    // Survive restarts: the database remembers key_hash -> playerId, so a
    // player coming back after a deploy keeps their handle, ratings, and
    // game history.
    try {
      const stored = this.#db?.playerIdByKeyHash(hashPlayerKey(playerKey));
      if (stored) {
        this.#playerKeys.set(playerKey, stored);
        return stored;
      }
    } catch (error) {
      console.error("Key lookup failed, continuing with a fresh id", error);
    }
    this.#playerKeys.set(playerKey, fallbackPlayerId);
    return fallbackPlayerId;
  }

  play(message: Message, notify = true) {
    return new Promise<GameEngine>((resolve) => {
      this.validate(message)
        .then((validMessage) => {
          try {
            this.transition(validMessage);
            if (notify) {
              this.notify(validMessage);
            }
          } catch (error) {
            // The engine must survive any single bad message.
            console.error("Engine transition failed", error, {
              type: message.type,
            });
          }
          resolve(this);
        })
        .catch((error: GameError) => {
          if (notify) {
            try {
              this.notifyError(error);
            } catch (notifyFailure) {
              console.error("Failed to notify error", notifyFailure);
            }
          }
          resolve(this);
        });
    });
  }

  validate(message: Message) {
    return new Promise<Message>((resolve, reject) => {
      const fail = (error: ErrorCodes) => reject({ error, message });
      switch (message.type) {
        case MessageTypes.REGISTER_PLAYER:
        case MessageTypes.PLAYER_DISCONNECT:
        case MessageTypes.PLAYER_ABANDON:
        case MessageTypes.LIST_GAMES:
          break;
        case MessageTypes.LIST_MY_GAMES:
          // Valid even without a database - clients auto-refresh history in
          // the background, and a background refresh must never toast an
          // error. The reply is simply empty.
          break;
        case MessageTypes.CLAIM_HANDLE: {
          if (!this.#db) {
            return fail(ErrorCodes.HANDLES_UNAVAILABLE);
          }
          if (
            typeof message.handle !== "string" ||
            !HANDLE_PATTERN.test(message.handle)
          ) {
            return fail(ErrorCodes.INVALID_HANDLE);
          }
          break;
        }
        case MessageTypes.REGISTER_ROBOT: {
          if (!isValidCapabilities(message.capabilities)) {
            return fail(ErrorCodes.INVALID_ROBOT_CAPABILITIES);
          }
          break;
        }
        case MessageTypes.REQUEST_ROBOT: {
          const game = this.games[message.gameId];
          if (!game) {
            return fail(ErrorCodes.GAME_NOT_FOUND);
          }
          if (game.status !== GameStatus.WAITING_FOR_PLAYERS) {
            return fail(ErrorCodes.GAME_ALREADY_IN_PROGRESS);
          }
          if (!game.players.includes(message.playerId)) {
            return fail(ErrorCodes.PLAYER_NOT_PART_OF_GAME);
          }
          if (game.players.length >= game.playerCount) {
            return fail(ErrorCodes.GAME_IS_FULL);
          }
          if (!this.pickRobot(game, message.robotName)) {
            return fail(ErrorCodes.NO_ROBOT_AVAILABLE);
          }
          break;
        }
        case MessageTypes.PLAYER_TIMEOUT:
        case MessageTypes.NOTIFY_TIME: {
          // Timer-driven internal messages. The game may have completed or
          // been swept between the tick firing and arriving here.
          if (!this.games[message.gameId]) {
            return fail(ErrorCodes.GAME_NOT_FOUND);
          }
          break;
        }
        case MessageTypes.START_GAME: {
          if (
            !Number.isInteger(message.boardSize) ||
            !Number.isInteger(message.playerCount)
          ) {
            return fail(ErrorCodes.BAD_REQUEST);
          }
          if (message.boardSize < 2) {
            return fail(ErrorCodes.BOARD_SIZE_LESS_THAN_2);
          }
          if (message.playerCount < 2) {
            return fail(ErrorCodes.PLAYER_COUNT_LESS_THAN_2);
          }
          if (message.playerCount >= message.boardSize) {
            return fail(ErrorCodes.PLAYER_COUNT_MUST_BE_LESS_THAN_BOARD_SIZE);
          }
          if (message.boardSize > 12) {
            return fail(ErrorCodes.BOARD_SIZE_CANNOT_BE_GREATER_THAN_12);
          }
          if (message.playerCount > 10) {
            return fail(ErrorCodes.PLAYER_COUNT_CANNOT_BE_GREATER_THAN_10);
          }
          if (
            message.winningSequenceLength !== undefined &&
            (!Number.isInteger(message.winningSequenceLength) ||
              message.winningSequenceLength < 2 ||
              message.boardSize < message.winningSequenceLength)
          ) {
            return fail(
              ErrorCodes.WIN_SEQ_LENGTH_MUST_BE_LESS_THAN_OR_EQUAL_TO_BOARD_SIZE
            );
          }
          if (
            message.teamCount !== undefined &&
            message.teamCount !== 0 &&
            (!Number.isInteger(message.teamCount) ||
              message.teamCount < 2 ||
              message.playerCount % message.teamCount !== 0 ||
              message.teamCount > message.playerCount / 2)
          ) {
            return fail(ErrorCodes.INVALID_TEAM_CONFIGURATION);
          }
          if (message.winningSequenceCount !== undefined) {
            // Each side (team, or player when teamless) must have enough
            // cells on the board to physically place the required
            // sequences.
            const winLength =
              message.winningSequenceLength ?? message.boardSize;
            const sides =
              message.teamCount && message.teamCount > 0
                ? message.teamCount
                : message.playerCount;
            const sideCells = Math.floor(
              (message.boardSize * message.boardSize) / sides
            );
            if (
              !Number.isInteger(message.winningSequenceCount) ||
              message.winningSequenceCount < 1 ||
              message.winningSequenceCount > MAX_WINNING_SEQUENCE_COUNT ||
              message.winningSequenceCount * winLength > sideCells
            ) {
              return fail(ErrorCodes.INVALID_WINNING_SEQUENCE_COUNT);
            }
          }
          if (
            message.timePerPlayer !== undefined &&
            (!Number.isInteger(message.timePerPlayer) ||
              message.timePerPlayer < MIN_TIME_PER_PLAYER ||
              message.timePerPlayer > MAX_TIME_PER_PLAYER)
          ) {
            return fail(ErrorCodes.INVALID_TIMER_CONFIGURATION);
          }
          if (
            message.incrementPerPlayer !== undefined &&
            (!Number.isInteger(message.incrementPerPlayer) ||
              message.incrementPerPlayer < 0 ||
              message.incrementPerPlayer > MAX_INCREMENT_PER_PLAYER)
          ) {
            return fail(ErrorCodes.INVALID_TIMER_CONFIGURATION);
          }
          const activeGames = Object.values(this.games).filter(
            (each) => !COMPLETED_GAME_STATUS.includes(each.status)
          ).length;
          if (activeGames >= MAX_ACTIVE_GAMES) {
            return fail(ErrorCodes.SERVER_AT_CAPACITY);
          }
          break;
        }
        case MessageTypes.SPECTATE_GAME: {
          const game = this.games[message.gameId];
          if (
            !game ||
            ![
              GameStatus.GAME_IN_PROGRESS,
              GameStatus.WAITING_FOR_PLAYERS,
            ].includes(game.status)
          ) {
            return fail(ErrorCodes.GAME_NOT_FOUND);
          }
          if (game.players.includes(message.playerId)) {
            return fail(ErrorCodes.PLAYER_ALREADY_PART_OF_GAME);
          }
          if (game.spectators.length >= MAX_SPECTATORS_PER_GAME) {
            return fail(ErrorCodes.SPECTATOR_COUNT_CANNOT_BE_GREATER_THAN_10);
          }
          break;
        }
        case MessageTypes.JOIN_GAME: {
          const game = this.games[message.gameId];
          if (!game) {
            return fail(ErrorCodes.GAME_NOT_FOUND);
          }
          if (game.players.includes(message.playerId)) {
            return fail(ErrorCodes.PLAYER_ALREADY_PART_OF_GAME);
          }
          if (game.status !== GameStatus.WAITING_FOR_PLAYERS) {
            return fail(ErrorCodes.GAME_ALREADY_IN_PROGRESS);
          }
          break;
        }
        case MessageTypes.MAKE_MOVE: {
          const game = this.games[message.gameId];
          if (!game || game.status !== GameStatus.GAME_IN_PROGRESS) {
            return fail(ErrorCodes.GAME_NOT_FOUND);
          }
          if (game.turn !== message.playerId) {
            return fail(ErrorCodes.MOVE_OUT_OF_TURN);
          }
          if (
            !Number.isInteger(message.coordinateX) ||
            !Number.isInteger(message.coordinateY) ||
            message.coordinateX < 0 ||
            message.coordinateX >= game.boardSize ||
            message.coordinateY < 0 ||
            message.coordinateY >= game.boardSize
          ) {
            return fail(ErrorCodes.INVALID_MOVE);
          }
          if (
            game.positions[message.coordinateX][message.coordinateY] !==
            EMPTY_POSITION
          ) {
            return fail(ErrorCodes.INVALID_MOVE);
          }
          if (game.timed && game.timers[message.playerId].timeLeft <= 0) {
            return fail(ErrorCodes.PLAYER_TIME_OUT);
          }
          break;
        }
        default:
          return fail(ErrorCodes.BAD_REQUEST);
      }
      resolve(message);
    });
  }

  transition(message: Message) {
    switch (message.type) {
      case MessageTypes.REGISTER_PLAYER: {
        this.attachPlayer(
          message.playerId,
          sanitizeName(message.name),
          message.connection,
          message.playerKey
        );
        break;
      }
      case MessageTypes.REGISTER_ROBOT: {
        this.attachPlayer(
          message.playerId,
          sanitizeName(message.name),
          message.connection,
          message.playerKey,
          true
        );
        const existing = this.robots[message.playerId];
        this.robots = {
          ...this.robots,
          [message.playerId]: {
            playerId: message.playerId,
            name: sanitizeName(message.name),
            capabilities: message.capabilities,
            // A resuming robot keeps its seats.
            activeGames: existing ? existing.activeGames : [],
          },
        };
        break;
      }
      case MessageTypes.REQUEST_ROBOT: {
        const game = this.games[message.gameId];
        const robot = this.pickRobot(game, message.robotName);
        if (!game || !robot) {
          break;
        }
        this.transition({
          type: MessageTypes.JOIN_GAME,
          gameId: message.gameId,
          playerId: robot.playerId,
          connection: this.players[robot.playerId].connection,
        });
        robot.activeGames = [...robot.activeGames, message.gameId];
        break;
      }
      case MessageTypes.CLAIM_HANDLE: {
        const db = this.#db;
        if (!db) {
          break;
        }
        try {
          const result = db.claimHandle(message.playerId, message.handle);
          if (result.ok) {
            this.#handleOutcomes.set(message.playerId, {
              ok: true,
              handle: result.handle,
            });
            const player = this.players[message.playerId];
            if (player) {
              this.players[message.playerId] = { ...player, name: result.handle };
            }
          } else {
            this.#handleOutcomes.set(message.playerId, {
              ok: false,
              handle: message.handle,
              reason: result.reason,
            });
          }
        } catch (error) {
          console.error("Handle claim failed", error);
          this.#handleOutcomes.set(message.playerId, {
            ok: false,
            handle: message.handle,
            reason: "invalid",
          });
        }
        break;
      }
      case MessageTypes.NOTIFY_TIME:
      case MessageTypes.LIST_GAMES:
      case MessageTypes.LIST_MY_GAMES:
        break;
      case MessageTypes.PLAYER_DISCONNECT: {
        // Start the resume grace window instead of abandoning immediately.
        const player = this.players[message.playerId];
        if (!player) {
          break;
        }
        this.players[message.playerId] = { ...player, connected: false };
        const existingTimer = this.#graceTimers.get(message.playerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        this.#graceTimers.set(
          message.playerId,
          setTimeout(() => {
            this.play({
              type: MessageTypes.PLAYER_ABANDON,
              playerId: message.playerId,
            });
          }, this.#disconnectGraceMs)
        );
        break;
      }
      case MessageTypes.PLAYER_ABANDON: {
        const { playerId } = message;
        const player = this.players[playerId];
        if (!player || player.connected) {
          // Player resumed (or never existed); nothing to abandon.
          break;
        }
        this.#graceTimers.delete(playerId);
        if (player.playerKey) {
          this.#playerKeys.delete(player.playerKey);
        }
        delete this.players[playerId];
        delete this.robots[playerId];
        // Transition their unfinished games to GAME_ABANDONED state
        Object.values(this.games).forEach((each: Game) => {
          if (
            each.players.includes(playerId) &&
            !COMPLETED_GAME_STATUS.includes(each.status)
          ) {
            stopAllTimers(each);
            const abandoned: Game = {
              ...each,
              status: GameStatus.GAME_ABANDONED,
              turn: "",
              completedAt: Date.now(),
            };
            abandoned.notation = encodeGame(abandoned);
            this.archiveGame(abandoned, playerId);
            this.releaseRobotSeats(abandoned.gameId);
            this.games[each.gameId] = abandoned;
          }
        });
        break;
      }
      case MessageTypes.START_GAME: {
        if (!(message.playerId in this.players)) {
          this.attachPlayer(message.playerId, "", message.connection);
        }
        const timed = message.timePerPlayer !== undefined;
        const timePerPlayer = message.timePerPlayer ?? 0;
        const incrementPerPlayer = timed
          ? message.incrementPerPlayer ?? DEFAULT_INCREMENT_PER_PLAYER
          : 0;

        const timers: Record<string, Timer> = timed
          ? {
              [message.playerId]: new Timer(
                timePerPlayer,
                message.playerId,
                message.gameId
              ),
            }
          : {};
        const game: Game = {
          gameId: message.gameId,
          name: sanitizeName(message.name),
          boardSize: message.boardSize,
          positions: generateBoard(message.boardSize),
          playerCount: message.playerCount ? message.playerCount : 2,
          winningSequenceLength: message.winningSequenceLength
            ? message.winningSequenceLength
            : message.boardSize,
          winningSequenceCount: message.winningSequenceCount ?? 1,
          teamCount: message.teamCount ?? 0,
          winningTeam: -1,
          players: [message.playerId],
          spectators: [],
          winner: "",
          winningSequence: [],
          status: GameStatus.WAITING_FOR_PLAYERS,
          turn: "",
          timers,
          timePerPlayer,
          incrementPerPlayer,
          timed,
          createdAt: Date.now(),
          moveLog: "",
          clockLog: "",
        };
        this.games[message.gameId] = game;
        break;
      }
      case MessageTypes.JOIN_GAME: {
        const gameId = message.gameId;
        if (!(message.playerId in this.players)) {
          this.attachPlayer(message.playerId, "", message.connection);
        }
        const existingGame = this.games[gameId];
        const updatedPlayersList = Array.from(
          new Set([...existingGame.players, message.playerId])
        );
        const gameReadyToStart =
          updatedPlayersList.length === existingGame.playerCount;

        const game: Game = {
          ...existingGame,
          players: updatedPlayersList,
          status: gameReadyToStart
            ? GameStatus.GAME_IN_PROGRESS
            : GameStatus.WAITING_FOR_PLAYERS,
          turn: gameReadyToStart ? getFirstPlayerFromGame(existingGame) : "",
          timers: existingGame.timed
            ? {
                ...existingGame.timers,
                [message.playerId]: new Timer(
                  existingGame.timePerPlayer,
                  message.playerId,
                  message.gameId
                ),
              }
            : existingGame.timers,
        };
        this.games[message.gameId] = game;
        if (gameReadyToStart && game.timed) {
          (game.timers[getFirstPlayerFromGame(game)] as Timer).start(this);
          game.turnStartedAt = Date.now();
        }
        break;
      }
      case MessageTypes.SPECTATE_GAME: {
        const game = this.games[message.gameId];
        const updatedSpectatorsList = Array.from(
          new Set([...game.spectators, message.playerId])
        );
        this.games[message.gameId] = {
            ...game,
            spectators: updatedSpectatorsList,
          };
        break;
      }
      case MessageTypes.PLAYER_TIMEOUT: {
        const game = this.games[message.gameId];
        if (!game || game.status !== GameStatus.GAME_IN_PROGRESS) {
          break;
        }

        const playersWithTimeLeft = game.players.filter(
          (player) => game.timers[player].timeLeft > 0
        );

        // The game ends when everyone still on the clock is on one side.
        // Teamless games make each seat its own side, so this is the
        // classic "one player left" rule; in team games a whole team must
        // run out before the other team wins on time.
        const sidesWithTimeLeft = new Set(
          playersWithTimeLeft.map((player) =>
            teamOfSeat(game.players.indexOf(player), game.teamCount)
          )
        );

        if (playersWithTimeLeft.length > 0 && sidesWithTimeLeft.size === 1) {
          stopAllTimers(game);
          const completed: Game = {
            ...game,
            status: GameStatus.GAME_WON_BY_TIMEOUT,
            winner: playersWithTimeLeft[0],
            winningTeam:
              game.teamCount > 0
                ? teamOfSeat(
                    game.players.indexOf(playersWithTimeLeft[0]),
                    game.teamCount
                  )
                : -1,
            turn: "",
            completedAt: Date.now(),
          };
          completed.notation = encodeGame(completed);
          this.games[message.gameId] = completed;
          this.logNotation(completed);
          this.archiveGame(completed);
          this.releaseRobotSeats(completed.gameId);
        } else {
          // More than two players: skip the timed-out player and keep going.
          const nextPlayer =
            game.turn === message.playerId ? calculateNextTurn(game) : game.turn;
          // Record skipped seats so notation rotation stays exact.
          const skips =
            game.turn === message.playerId && nextPlayer
              ? (game.players.indexOf(nextPlayer) -
                  game.players.indexOf(game.turn) +
                  game.players.length) %
                game.players.length
              : 0;
          this.games[message.gameId] = {
              ...game,
              turn: nextPlayer,
              moveLog: game.moveLog + SKIP_TOKEN.repeat(skips),
              clockLog: game.clockLog + SKIP_CLOCK_TOKEN.repeat(skips),
              turnStartedAt: Date.now(),
            };
          if (nextPlayer && !game.timers[nextPlayer].isRunning) {
            (game.timers[nextPlayer] as Timer).start(this);
          }
        }
        break;
      }
      case MessageTypes.MAKE_MOVE: {
        const game = this.games[message.gameId];

        if (game.timed) {
          (game.timers[message.playerId] as Timer).stop(
            game.incrementPerPlayer
          );
        }

        const positions = game.positions.map((row) => [...row]);
        positions[message.coordinateX][message.coordinateY] = message.playerId;
        const moveLog =
          game.moveLog +
          encodeCell(message.coordinateX, message.coordinateY, game.boardSize);
        const clockLog = game.timed
          ? game.clockLog +
            encodeClock(Date.now() - (game.turnStartedAt ?? Date.now()))
          : game.clockLog;

        const winner = calculateWinner({
          positions,
          winningSequenceLength: game.winningSequenceLength,
          winningSequenceCount: game.winningSequenceCount,
          teamCount: game.teamCount,
          players: game.players,
          lastTurnPlayerId: message.playerId,
          lastTurnPosition: {
            x: message.coordinateX,
            y: message.coordinateY,
          },
        });
        const tie = !winner && checkForDraw(positions);

        if (winner || tie) {
          stopAllTimers(game);
          const completed: Game = winner
            ? {
                ...game,
                positions,
                moveLog,
                clockLog,
                status: GameStatus.GAME_WON,
                winner: winner.winner,
                winningTeam: winner.winningTeam,
                turn: "",
                winningSequence: winner.winningSequence,
                completedAt: Date.now(),
              }
            : {
                ...game,
                positions,
                moveLog,
                clockLog,
                turn: "",
                status: GameStatus.GAME_ENDS_IN_A_DRAW,
                completedAt: Date.now(),
              };
          completed.notation = encodeGame(completed);
          this.games[message.gameId] = completed;
          this.logNotation(completed);
          this.archiveGame(completed);
          this.releaseRobotSeats(completed.gameId);
        } else {
          const nextPlayer = calculateNextTurn(game);
          // Seats skipped between mover and next mover (timed-out players in
          // 3+ player games) are recorded so rotation stays implied.
          const skips = nextPlayer
            ? (game.players.indexOf(nextPlayer) -
                game.players.indexOf(message.playerId) -
                1 +
                game.players.length) %
              game.players.length
            : 0;
          this.games[message.gameId] = {
              ...game,
              positions,
              moveLog: moveLog + SKIP_TOKEN.repeat(skips),
              clockLog: clockLog + SKIP_CLOCK_TOKEN.repeat(skips),
              turnStartedAt: Date.now(),
              turn: nextPlayer,
            };
          if (game.timed && nextPlayer) {
            (game.timers[nextPlayer] as Timer).start(this);
          }
        }
        break;
      }
    }
  }

  // Attach (or re-attach, on resume) a player connection. Cancels any
  // pending abandon for the player.
  private attachPlayer(
    playerId: string,
    name: string,
    connection: PlayerConnection,
    playerKey?: string,
    isRobot = false
  ) {
    const existing = this.players[playerId];
    const graceTimer = this.#graceTimers.get(playerId);
    if (graceTimer) {
      clearTimeout(graceTimer);
      this.#graceTimers.delete(playerId);
    }
    const storedHandle = this.#db?.getHandle(playerId);
    this.players[playerId] = {
        playerId,
        name: storedHandle || name || existing?.name || "",
        connection,
        connected: true,
        playerKey:
          typeof playerKey === "string" &&
          playerKey.length >= MIN_PLAYER_KEY_LENGTH
            ? playerKey.slice(0, MAX_PLAYER_KEY_LENGTH)
            : existing?.playerKey,
      };
    if (this.#db) {
      try {
        const key = this.players[playerId].playerKey;
        const keyHash = key ? hashPlayerKey(key) : "";
        this.#db.upsertPlayer(playerId, keyHash, isRobot);
      } catch (error) {
        console.error("Player persistence failed", error);
      }
    }
  }

  // The robot scheduler: pick the least-loaded available robot whose
  // capabilities match the game. O(robots) and allocation-light.
  pickRobot(game: Game | undefined, robotName?: string): Robot | null {
    if (!game) {
      return null;
    }
    let best: Robot | null = null;
    for (const robot of Object.values(this.robots)) {
      const player = this.players[robot.playerId];
      const caps = robot.capabilities;
      if (
        (robotName !== undefined && robot.name !== robotName) ||
        !player?.connected ||
        robot.activeGames.length >= caps.maxConcurrentGames ||
        game.boardSize < caps.boardSizes.min ||
        game.boardSize > caps.boardSizes.max ||
        game.playerCount < caps.playerCounts.min ||
        game.playerCount > caps.playerCounts.max ||
        game.players.includes(robot.playerId) ||
        (game.timed &&
          (!caps.timed || (caps.minTimePerPlayer ?? 0) > game.timePerPlayer))
      ) {
        continue;
      }
      if (!best || robot.activeGames.length < best.activeGames.length) {
        best = robot;
      }
    }
    return best;
  }

  private releaseRobotSeats(gameId: string) {
    Object.values(this.robots).forEach((robot) => {
      if (robot.activeGames.includes(gameId)) {
        robot.activeGames = robot.activeGames.filter(
          (each) => each !== gameId
        );
      }
    });
  }

  // Fire-and-forget persistence - the archive must never affect gameplay.
  private archiveGame(game: Game, abandonerId?: string) {
    if (!this.#db) {
      return;
    }
    try {
      this.#db.recordGame(game);
      if (abandonerId && game.status === GameStatus.GAME_ABANDONED) {
        this.#db.recordAbandonment(game, abandonerId);
      }
    } catch (error) {
      console.error("Game archive failed", error);
    }
  }

  private logNotation(game: Game) {
    if (!this.#ttnLogPath || !game.notation) {
      return;
    }
    const path = this.#ttnLogPath;
    const line = `${game.notation}\n`;
    const write = async () => {
      if (!this.#ttnDirReady) {
        await mkdir(dirname(path), { recursive: true });
        this.#ttnDirReady = true;
      }
      await appendFile(path, line);
    };
    // Fire and forget: data collection must never affect gameplay.
    write().catch((error) => {
      console.error("Failed to append TTN log", error);
    });
  }

  // The robot roster players can pick from.
  listRobots(): RobotSummary[] {
    return Object.values(this.robots)
      .filter((robot) => this.players[robot.playerId]?.connected)
      .map((robot) => ({
        name: robot.name,
        boardSizes: robot.capabilities.boardSizes,
        playerCounts: robot.capabilities.playerCounts,
        timed: robot.capabilities.timed,
      }));
  }

  // The public lobby: every game that can still be watched (or joined).
  listGames(): GameSummary[] {
    return Object.values(this.games)
      .filter((game) => !COMPLETED_GAME_STATUS.includes(game.status))
      .map((game) => {
        const robotCount = game.players.filter(
          (playerId) => this.robots[playerId]
        ).length;
        return {
          gameId: game.gameId,
          name: game.name,
          boardSize: game.boardSize,
          winningSequenceLength: game.winningSequenceLength,
          winningSequenceCount: game.winningSequenceCount,
          teamCount: game.teamCount,
          playerCount: game.playerCount,
          humanCount: game.players.length - robotCount,
          robotCount,
          spectatorCount: game.spectators.length,
          status: game.status,
          timed: game.timed,
        };
      });
  }

  // End a game that nobody is going to finish: same treatment as a player
  // abandoning, so the players are told, the archive keeps it, and the
  // robot seats come back. Never silently delete a game out from under a
  // connected client - that is what leaves ghosts in the lobby.
  #abandonGame(game: Game, now: number) {
    stopAllTimers(game);
    const abandoned: Game = {
      ...game,
      status: GameStatus.GAME_ABANDONED,
      turn: "",
      completedAt: now,
    };
    abandoned.notation = encodeGame(abandoned);
    // Archived (so /games/:id and player history keep it) but deliberately
    // not written to the TTN corpus - the same convention PLAYER_ABANDON
    // follows, and playground/train.ts skips abandoned lines anyway.
    this.archiveGame(abandoned);
    this.releaseRobotSeats(abandoned.gameId);
    this.games[abandoned.gameId] = abandoned;

    const connectedPlayers = getConnectedPlayers(this.players, abandoned);
    const connectedSpectators = getConnectedSpectators(
      this.players,
      abandoned
    );
    sendResponseToPlayers(
      {
        // PLAYER_DISCONNECT is the shape clients have always handled for
        // an abandoned game.
        type: MessageTypes.PLAYER_DISCONNECT,
        game: { ...abandoned, timers: getTimerBaseFromGame(abandoned) },
        players: getPlayers(connectedPlayers),
        spectators: getPlayers(connectedSpectators),
      } as Response,
      connectedPlayers,
      connectedSpectators
    );
  }

  // Periodically end dead games and remove finished ones, so a server that
  // runs for decades never accumulates state. Called by the server every
  // minute - one pass over the games map, no per-game timers.
  sweep(now: number = Date.now()) {
    Object.values(this.games).forEach((game) => {
      if (!COMPLETED_GAME_STATUS.includes(game.status)) {
        // Timed games in progress police themselves: the clock runs out and
        // PLAYER_TIMEOUT ends them, so a long think is legitimate there.
        // Everything else - untimed games mid-play, and any game still
        // waiting for players - is judged on how long it has sat untouched.
        const selfPolicing =
          game.timed && game.status === GameStatus.GAME_IN_PROGRESS;
        const lastActivity = game.turnStartedAt ?? game.createdAt;
        const idle = !selfPolicing && lastActivity + IDLE_GAME_TTL < now;
        const stale = game.createdAt + STALE_GAME_TTL < now;
        if (idle || stale) {
          this.#abandonGame(game, now);
          // Lingers as GAME_ABANDONED until COMPLETED_GAME_TTL so clients
          // that are still connected see the final state before it goes.
          return;
        }
      }
      const completedAndExpired =
        COMPLETED_GAME_STATUS.includes(game.status) &&
        (game.completedAt ?? game.createdAt) + COMPLETED_GAME_TTL < now;
      if (completedAndExpired) {
        stopAllTimers(game);
        this.releaseRobotSeats(game.gameId);
        delete this.games[game.gameId];
      }
    });
  }

  // functions with side effects - websocket send operation

  notify(message: Message) {
    switch (message.type) {
      case MessageTypes.REGISTER_PLAYER:
      case MessageTypes.REGISTER_ROBOT: {
        const response: Response = {
          type: message.type,
          // The stored name, so a resuming client gets its handle back even
          // when it re-registers before the user has typed anything.
          name:
            this.players[message.playerId]?.name ?? sanitizeName(message.name),
          playerId: message.playerId,
        };
        safeSend(message.connection, JSON.stringify(response));
        this.notifyResumedGames(message.playerId, message.connection);
        break;
      }
      case MessageTypes.CLAIM_HANDLE: {
        const outcome = this.#handleOutcomes.get(message.playerId);
        this.#handleOutcomes.delete(message.playerId);
        if (!message.connection || !outcome) {
          break;
        }
        if (outcome.ok) {
          safeSend(
            message.connection,
            JSON.stringify({
              type: MessageTypes.HANDLE_CLAIMED,
              playerId: message.playerId,
              handle: outcome.handle,
            })
          );
        } else {
          safeSend(
            message.connection,
            JSON.stringify({
              error:
                outcome.reason === "taken"
                  ? ErrorCodes.HANDLE_TAKEN
                  : ErrorCodes.INVALID_HANDLE,
              message: { type: message.type, handle: outcome.handle },
              type: "ERROR",
            })
          );
        }
        break;
      }
      case MessageTypes.PLAYER_DISCONNECT:
        // Silent: the grace window may end in a resume. Others learn about
        // it only if the abandon actually happens.
        break;
      case MessageTypes.LIST_GAMES: {
        if (message.connection) {
          const response: Response = {
            type: MessageTypes.LIST_GAMES,
            games: this.listGames(),
            robots: this.listRobots(),
          };
          safeSend(message.connection, JSON.stringify(response));
        }
        break;
      }
      case MessageTypes.LIST_MY_GAMES: {
        // Personal archive, requester-only. Handles only - playerIds are
        // never put on the wire for other players.
        if (!message.connection || !message.playerId) {
          break;
        }
        if (!this.#db) {
          safeSend(
            message.connection,
            JSON.stringify({ type: MessageTypes.MY_GAMES, games: [] })
          );
          break;
        }
        try {
          const response: Response = {
            type: MessageTypes.MY_GAMES,
            games: this.#db.playerGames(message.playerId, 25).map((game) => ({
              gameId: game.gameId,
              ttn: game.ttn,
              status: game.status as GameStatus,
              winnerSeat: game.winnerSeat,
              mySeat:
                game.players.find(
                  (player) => player.playerId === message.playerId
                )?.seat ?? -1,
              startedAt: game.startedAt,
              completedAt: game.completedAt,
              players: game.players.map((player) => ({
                seat: player.seat,
                handle: player.handle || "anonymous",
              })),
            })),
          };
          safeSend(message.connection, JSON.stringify(response));
        } catch (error) {
          console.error("History fetch failed", error);
        }
        break;
      }
      case MessageTypes.PLAYER_ABANDON:
        Object.values(this.games)
          .filter(
            (each: Game) =>
              each.players.includes(message.playerId) &&
              each.status === GameStatus.GAME_ABANDONED
          )
          .forEach((game: Game) => {
            const connectedPlayers = getConnectedPlayers(this.players, game);
            const connectedSpectators = getConnectedSpectators(
              this.players,
              game
            );
            const response: Response = {
              // Broadcast as PLAYER_DISCONNECT - the shape clients have
              // always handled for abandoned games.
              type: MessageTypes.PLAYER_DISCONNECT,
              game: {
                ...game,
                timers: getTimerBaseFromGame(game),
              },
              players: getPlayers(connectedPlayers),
              spectators: getPlayers(connectedSpectators),
            };
            sendResponseToPlayers(
              response,
              connectedPlayers,
              connectedSpectators
            );
          });
        break;
      case MessageTypes.START_GAME:
      case MessageTypes.JOIN_GAME:
      case MessageTypes.REQUEST_ROBOT:
      case MessageTypes.SPECTATE_GAME:
      case MessageTypes.PLAYER_TIMEOUT:
      case MessageTypes.NOTIFY_TIME:
      case MessageTypes.MAKE_MOVE: {
        const game = this.games[message.gameId];
        if (!game) {
          break;
        }

        const connectedPlayers = getConnectedPlayers(this.players, game);
        const connectedSpectators = getConnectedSpectators(this.players, game);

        const baseType =
          message.type === MessageTypes.REQUEST_ROBOT
            ? MessageTypes.JOIN_GAME
            : message.type;
        const response: Response = {
          type: [
            GameStatus.GAME_WON,
            GameStatus.GAME_ENDS_IN_A_DRAW,
            GameStatus.GAME_WON_BY_TIMEOUT,
          ].includes(game.status)
            ? MessageTypes.GAME_COMPLETE
            : baseType,
          game: {
            ...game,
            timers: getTimerBaseFromGame(game),
          },
          players: getPlayers(connectedPlayers),
          spectators: getPlayers(connectedSpectators),
        };
        sendResponseToPlayers(response, connectedPlayers, connectedSpectators);
        break;
      }
      default:
        break;
    }
  }

  // After a (re)registration, replay the player's active games to the new
  // connection so a refreshed page or restarted robot picks up where it was.
  private notifyResumedGames(playerId: string, connection: PlayerConnection) {
    Object.values(this.games)
      .filter((game) => !COMPLETED_GAME_STATUS.includes(game.status))
      .forEach((game) => {
        const isPlayer = game.players.includes(playerId);
        const isSpectator = game.spectators.includes(playerId);
        if (!isPlayer && !isSpectator) {
          return;
        }
        const connectedPlayers = getConnectedPlayers(this.players, game);
        const connectedSpectators = getConnectedSpectators(this.players, game);
        const response: Response = {
          type: isPlayer
            ? MessageTypes.GAME_RESUMED
            : MessageTypes.SPECTATE_GAME,
          game: {
            ...game,
            timers: getTimerBaseFromGame(game),
          },
          players: getPlayers(connectedPlayers),
          spectators: getPlayers(connectedSpectators),
        };
        safeSend(connection, JSON.stringify(response));
      });
  }

  notifyError(error: GameError) {
    const player = this.players[error.message.playerId ?? ""];
    const connection = player?.connection ?? error.message.connection;
    if (!connection) {
      return;
    }
    const { connection: omit, ...message } = error.message;
    safeSend(
      connection,
      JSON.stringify({ error: error.error, message, type: "ERROR" })
    );
  }
}

const calculateNextTurn = (game: Game): string => {
  const currentIndex = game.players.indexOf(game.turn);
  for (let step = 1; step <= game.players.length; step++) {
    const candidate = game.players[(currentIndex + step) % game.players.length];
    const timer = game.timers[candidate];
    if (!timer || timer.timeLeft > 0) {
      return candidate;
    }
  }
  return "";
};

const generateBoard = (boardSize: number): string[][] =>
  Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => EMPTY_POSITION)
  );

const checkForDraw = (positions: string[][]): boolean =>
  positions.every((row) => row.every((cell) => cell !== EMPTY_POSITION));

// A winning line must pass through the last move, so only the four lines
// through that cell are scanned: O(4 * winningSequenceLength) per move.
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // right diagonal
  [1, -1], // left diagonal
];

export const calculateWinner = (
  input: CalculateWinnerInputType
): CalculateWinnerOutputType | null => {
  const { positions, winningSequenceLength, lastTurnPlayerId } = input;
  const { x, y } = input.lastTurnPosition;
  const size = positions.length;
  const winningSequenceCount = input.winningSequenceCount ?? 1;
  const teamCount = input.teamCount ?? 0;

  if (positions[x]?.[y] !== lastTurnPlayerId) {
    return null;
  }

  // Classic games (one sequence, no teams) keep the O(4 * winLen) fast
  // path - a winning line must pass through the last move.
  if (winningSequenceCount === 1 && teamCount <= 0) {
    for (const [dx, dy] of DIRECTIONS) {
      const winningSequence: WinningSequence[] = [{ x, y }];
      for (const sign of [1, -1] as const) {
        let nextX = x + dx * sign;
        let nextY = y + dy * sign;
        while (
          nextX >= 0 &&
          nextX < size &&
          nextY >= 0 &&
          nextY < size &&
          positions[nextX][nextY] === lastTurnPlayerId
        ) {
          if (sign === 1) {
            winningSequence.push({ x: nextX, y: nextY });
          } else {
            winningSequence.unshift({ x: nextX, y: nextY });
          }
          nextX += dx * sign;
          nextY += dy * sign;
        }
      }
      if (winningSequence.length >= winningSequenceLength) {
        return {
          winner: lastTurnPlayerId,
          winningSequence,
          winningTeam: -1,
        };
      }
    }
    return null;
  }

  // Variant games count sequences across the whole board for the mover's
  // side (their team's marks, or just their own). See shared/rules.ts for
  // the counting rules.
  const players = input.players ?? [];
  const seat = players.indexOf(lastTurnPlayerId);
  if (seat < 0) {
    return null;
  }
  const scan = countSequences(
    positions,
    winningSequenceLength,
    ownerOfSeat(players, seat, teamCount)
  );
  if (scan.count >= winningSequenceCount) {
    return {
      winner: lastTurnPlayerId,
      winningSequence: scan.cells,
      winningTeam: teamCount > 0 ? teamOfSeat(seat, teamCount) : -1,
    };
  }
  return null;
};

export default TiciTacaToeyGameEngine;
