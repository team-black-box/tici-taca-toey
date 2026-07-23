// The one protocol. Every module - server engine, web client, mobile app,
// robot SDK, MCP bridge - imports these types from here, so the wire format
// can never drift between them. Message *envelopes* stay per-side (the
// server sees connection-enriched messages, clients send bare payloads);
// everything they carry is defined once, below.

// --- primitives ------------------------------------------------------------

// The engine talks to players through this minimal interface so it stays
// independent of the websocket implementation (Bun, ws, or a test fake).
export interface PlayerConnection {
  send(data: string): unknown;
  ping?(): unknown;
}

export interface TimerBase {
  isRunning: boolean;
  timeLeft: number;
}

export interface WinningSequence {
  x: number;
  y: number;
}

export interface Player {
  name: string;
  playerId: string;
}

// --- the game --------------------------------------------------------------

export interface Game {
  gameId: string;
  name: string;
  boardSize: number;
  positions: string[][];
  playerCount: number;
  players: string[];
  spectators: string[];
  winner: string;
  winningSequence: WinningSequence[];
  winningSequenceLength: number;
  // Variant: number of sequences required to win (1 = the classic game).
  winningSequenceCount: number;
  // Variant: number of equal teams (0 = no teams). Team of a seat is
  // seat % teamCount - the rotation interleaves teams automatically.
  teamCount: number;
  // Winning team index when a team game ends in a win, else -1.
  winningTeam: number;
  status: GameStatus;
  turn: string;
  timers: Record<string, TimerBase>;
  timePerPlayer: number;
  incrementPerPlayer: number;
  timed: boolean;
  createdAt: number;
  completedAt?: number;
  // TTN move log: fixed-width base36 cell tokens plus "--" skip tokens,
  // appended as the game is played. See shared/ttn.ts.
  moveLog: string;
  // TTN v2 clock track (timed games): per-move thinking-time tokens.
  clockLog: string;
  // When the current mover's clock started, for the clock track.
  turnStartedAt?: number;
  // TTN line, set when the game completes.
  notation?: string;
}

export interface GameStore {
  [key: string]: Game;
}

export interface StaticPlayerStore {
  [key: string]: Player;
}

export interface GameState {
  game: Game;
  players: StaticPlayerStore;
  spectators: StaticPlayerStore;
}

// --- robots ----------------------------------------------------------------

export interface RobotCapabilities {
  boardSizes: { min: number; max: number };
  playerCounts: { min: number; max: number };
  maxConcurrentGames: number;
  timed: boolean;
  minTimePerPlayer?: number;
}

export interface Robot {
  playerId: string;
  name: string;
  capabilities: RobotCapabilities;
  activeGames: string[];
}

export interface RobotStore {
  [key: string]: Robot;
}

// --- lobby summaries -------------------------------------------------------

// One row of the public lobby.
export interface GameSummary {
  gameId: string;
  name: string;
  boardSize: number;
  winningSequenceLength: number;
  winningSequenceCount: number;
  teamCount: number;
  playerCount: number;
  humanCount: number;
  robotCount: number;
  spectatorCount: number;
  status: GameStatus;
  timed: boolean;
}

// One row of the robot roster shown to players.
export interface RobotSummary {
  name: string;
  boardSizes: { min: number; max: number };
  playerCounts: { min: number; max: number };
  timed: boolean;
}

// --- responses (server -> everyone) ---------------------------------------

export interface RegisterPlayerResponse extends Player {
  type: MessageTypes.REGISTER_PLAYER | MessageTypes.REGISTER_ROBOT;
}

export interface GameActionResponse extends GameState {
  type:
    | MessageTypes.START_GAME
    | MessageTypes.JOIN_GAME
    | MessageTypes.MAKE_MOVE
    | MessageTypes.SPECTATE_GAME
    | MessageTypes.PLAYER_DISCONNECT
    | MessageTypes.GAME_COMPLETE
    | MessageTypes.GAME_RESUMED
    | MessageTypes.NOTIFY_TIME
    | MessageTypes.PLAYER_TIMEOUT;
}

export interface HandleClaimedResponse {
  type: MessageTypes.HANDLE_CLAIMED;
  playerId: string;
  handle: string;
}

export interface ListGamesResponse {
  type: MessageTypes.LIST_GAMES;
  games: GameSummary[];
  robots: RobotSummary[];
}

// One finished game from the archive, shaped for the player who asked:
// handles only (never playerIds - they are not meant to circulate), plus
// the requester's own seat so clients can render the result from their
// perspective. `ttn` replays the whole game client-side.
export interface ArchivedGameSummary {
  gameId: string;
  ttn: string;
  status: GameStatus;
  winnerSeat: number | null;
  mySeat: number;
  startedAt: number;
  completedAt: number;
  players: Array<{ seat: number; handle: string }>;
}

export interface MyGamesResponse {
  type: MessageTypes.MY_GAMES;
  games: ArchivedGameSummary[];
}

// Client-local actions share the response pipeline in both app stores.
export interface UpdateNameAction {
  type: MessageTypes.UPDATE_NAME;
  name: string;
}

export interface SetActiveGameAction {
  type: MessageTypes.SET_ACTIVE_GAME;
  gameId: string;
}

export interface ConnectedToServerAction {
  type: MessageTypes.CONNECTED_TO_SERVER;
}

export interface DisconnectedFromServerAction {
  type: MessageTypes.DISCONNECTED_FROM_SERVER;
}

export type Response =
  | RegisterPlayerResponse
  | GameActionResponse
  | ListGamesResponse
  | MyGamesResponse
  | HandleClaimedResponse
  | UpdateNameAction
  | ConnectedToServerAction
  | DisconnectedFromServerAction
  | SetActiveGameAction;

// --- enums -----------------------------------------------------------------

export enum GameInteractionTypes {
  PLAY = "play",
  SPECTATE = "spectate",
}

export enum MessageTypes {
  REGISTER_PLAYER = "REGISTER_PLAYER",
  REGISTER_ROBOT = "REGISTER_ROBOT",
  REQUEST_ROBOT = "REQUEST_ROBOT",
  START_GAME = "START_GAME",
  JOIN_GAME = "JOIN_GAME",
  MAKE_MOVE = "MAKE_MOVE",
  SPECTATE_GAME = "SPECTATE_GAME",
  GAME_COMPLETE = "GAME_COMPLETE", // response only
  GAME_RESUMED = "GAME_RESUMED", // response only
  PLAYER_DISCONNECT = "PLAYER_DISCONNECT",
  PLAYER_ABANDON = "PLAYER_ABANDON", // server-internal: grace expired
  PLAYER_TIMEOUT = "PLAYER_TIMEOUT",
  NOTIFY_TIME = "NOTIFY_TIME",
  LIST_GAMES = "LIST_GAMES",
  LIST_MY_GAMES = "LIST_MY_GAMES",
  MY_GAMES = "MY_GAMES", // response only
  CLAIM_HANDLE = "CLAIM_HANDLE",
  HANDLE_CLAIMED = "HANDLE_CLAIMED", // response only
  UPDATE_NAME = "UPDATE_NAME", // client only
  CONNECTED_TO_SERVER = "CONNECTED_TO_SERVER", // client only
  DISCONNECTED_FROM_SERVER = "DISCONNECTED_FROM_SERVER", // client only
  SET_ACTIVE_GAME = "SET_ACTIVE_GAME", // client only
}

export enum ErrorCodes {
  GAME_NOT_FOUND = "GAME_NOT_FOUND",
  PLAYER_ALREADY_PART_OF_GAME = "PLAYER_ALREADY_PART_OF_GAME",
  PLAYER_NOT_PART_OF_GAME = "PLAYER_NOT_PART_OF_GAME",
  GAME_ALREADY_IN_PROGRESS = "GAME_ALREADY_IN_PROGRESS",
  MOVE_OUT_OF_TURN = "MOVE_OUT_OF_TURN",
  INVALID_MOVE = "INVALID_MOVE",
  BAD_REQUEST = "BAD_REQUEST",
  BOARD_SIZE_LESS_THAN_2 = "BOARD_SIZE_LESS_THAN_2",
  PLAYER_COUNT_LESS_THAN_2 = "PLAYER_COUNT_LESS_THAN_2",
  PLAYER_COUNT_MUST_BE_LESS_THAN_BOARD_SIZE = "PLAYER_COUNT_MUST_BE_LESS_THAN_BOARD_SIZE",
  WIN_SEQ_LENGTH_MUST_BE_LESS_THAN_OR_EQUAL_TO_BOARD_SIZE = "WINNING_SEQUENCE_LENGTH_MUST_BE_LESS_THAN_OR_EQUAL_TO_BOARD_SIZE",
  INVALID_WINNING_SEQUENCE_COUNT = "INVALID_WINNING_SEQUENCE_COUNT",
  INVALID_TEAM_CONFIGURATION = "INVALID_TEAM_CONFIGURATION",
  BOARD_SIZE_CANNOT_BE_GREATER_THAN_12 = "BOARD_SIZE_CANNOT_BE_GREATER_THAN_12",
  PLAYER_COUNT_CANNOT_BE_GREATER_THAN_10 = "PLAYER_COUNT_CANNOT_BE_GREATER_THAN_10",
  SPECTATOR_COUNT_CANNOT_BE_GREATER_THAN_10 = "SPECTATOR_COUNT_CANNOT_BE_GREATER_THAN_10",
  PLAYER_TIME_OUT = "PLAYER_TIME_OUT",
  INVALID_TIMER_CONFIGURATION = "INVALID_TIMER_CONFIGURATION",
  SERVER_AT_CAPACITY = "SERVER_AT_CAPACITY",
  INVALID_ROBOT_CAPABILITIES = "INVALID_ROBOT_CAPABILITIES",
  INVALID_HANDLE = "INVALID_HANDLE",
  HANDLE_TAKEN = "HANDLE_TAKEN",
  HANDLES_UNAVAILABLE = "HANDLES_UNAVAILABLE",
  RATE_LIMITED = "RATE_LIMITED",
  NO_ROBOT_AVAILABLE = "NO_ROBOT_AVAILABLE",
  GAME_IS_FULL = "GAME_IS_FULL",
}

export enum GameStatus {
  WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
  GAME_IN_PROGRESS = "GAME_IN_PROGRESS",
  GAME_WON = "GAME_WON",
  GAME_ENDS_IN_A_DRAW = "GAME_ENDS_IN_A_DRAW",
  GAME_ABANDONED = "GAME_ABANDONED",
  GAME_WON_BY_TIMEOUT = "GAME_WON_BY_TIMEOUT",
}

export const COMPLETED_GAME_STATUS = [
  GameStatus.GAME_ABANDONED,
  GameStatus.GAME_ENDS_IN_A_DRAW,
  GameStatus.GAME_WON,
  GameStatus.GAME_WON_BY_TIMEOUT,
];
