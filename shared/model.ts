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

// What is sitting in a seat. Robots register with REGISTER_ROBOT and use
// the SDK; agents arrive over MCP and play through an in-process
// connection. Both are machines, but they are different kinds of machine
// and the UI names them differently.
export enum PlayerKind {
  HUMAN = "human",
  ROBOT = "robot",
  AGENT = "agent",
}

export interface Player {
  name: string;
  playerId: string;
  kind: PlayerKind;
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
  // Open to strangers: anyone can take a free seat straight from the
  // lobby, no invite link needed. Off by default - a game you start is
  // yours until you open it, the same way a robot only joins when asked.
  openSeats: boolean;
  // Variant: number of sequences required to win (1 = the classic game).
  winningSequenceCount: number;
  // Variant: number of equal teams (0 = no teams). Team of a seat is
  // seat % teamCount - the rotation interleaves teams automatically.
  teamCount: number;
  // Presence: show every player's cursor to every *opponent*, not just to
  // teammates and spectators (who always see them). Off by default,
  // chosen at game start and never changed after - a game whose rules
  // shifted underneath the players is not a game. When it is on, a hover
  // is public, which makes hovering a cell you have no intention of
  // taking a legitimate bluff.
  showCursors: boolean;
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
  agentCount: number;
  spectatorCount: number;
  // Anyone may take a seat from the lobby.
  openSeats: boolean;
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

// Where everyone else's pointer is, coalesced by the server and pushed a
// few times a second. Seat-keyed, not playerId-keyed: a seat is all a
// client needs to pick the symbol and its neon, and it keeps playerIds
// out of a message that goes to every spectator.
//
// A cursor never includes the recipient's own seat - a client already
// knows where its own pointer is and draws that ghost locally, with no
// round trip. `OFF_BOARD` means the pointer left the board; the seat is
// sent once with that value and then dropped from the map.
export type CursorTuple = [seat: number, x: number, y: number];

export const CURSOR_OFF_BOARD = -1;

export interface CursorsResponse {
  type: MessageTypes.CURSORS;
  gameId: string;
  cursors: CursorTuple[];
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
  // The requester's seat, or -1 when looking at someone else's game.
  mySeat: number;
  startedAt: number;
  completedAt: number;
  players: Array<{ seat: number; handle: string; kind: PlayerKind }>;
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
  | CursorsResponse
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
  // Open a game you are in to strangers from the lobby.
  OPEN_SEATS = "OPEN_SEATS",
  START_GAME = "START_GAME",
  JOIN_GAME = "JOIN_GAME",
  MAKE_MOVE = "MAKE_MOVE",
  // Presence, not game state: where a player's pointer is hovering, in
  // cell coordinates. Never recorded, never archived, never in the TTN.
  CURSOR = "CURSOR",
  CURSORS = "CURSORS", // response only

  // Concede an in-progress game ("gg"). Two sides: the other wins. More:
  // the game ends, attributed to the forfeiter.
  FORFEIT = "FORFEIT",
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
  GAME_IS_NOT_OPEN = "GAME_IS_NOT_OPEN",
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
