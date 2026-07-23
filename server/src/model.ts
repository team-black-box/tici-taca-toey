// Server-side view of the protocol. The wire format itself - game state,
// enums, responses, summaries - lives in shared/model.ts (one copy for
// every module). This file adds only what the server alone needs: message
// envelopes enriched with the connection, and the engine's own types.
import {
  Game,
  MessageTypes,
  ErrorCodes,
  Player,
  PlayerConnection,
  RobotCapabilities,
} from "../../shared/model";

export * from "../../shared/model";

// --- engine-side stores ----------------------------------------------------

export interface ConnectedPlayer extends Player {
  connection: PlayerConnection;
  connected: boolean;
  playerKey?: string;
}

export interface PlayerStore {
  [key: string]: ConnectedPlayer;
}

export interface GameEngine {
  games: { [key: string]: Game };
  players: PlayerStore;
  robots: { [key: string]: import("../../shared/model").Robot };
  play: (message: Message, notify?: boolean) => Promise<GameEngine>;
  // Maps a secret playerKey to a stable playerId; see the engine.
  resolvePlayerKey: (playerKey: unknown, fallbackPlayerId: string) => string;
  validate: (message: Message) => Promise<Message>;
  transition: (message: Message) => void;
  notify: (message: Message) => void;
  notifyError: (error: GameError) => void;
}

// --- incoming messages -----------------------------------------------------
// The server enriches every client message with the connection-scoped
// playerId, a gameId (generated when absent), and the connection itself
// before the engine sees it, so those are required here.

export interface RegisterPlayerMessage {
  type: MessageTypes.REGISTER_PLAYER;
  name: string;
  connection: PlayerConnection;
  playerId: string;
  // Secret durable identity for reconnect-and-resume. Never broadcast.
  playerKey?: string;
  // Set by the server only - `server.ts` strips it from client payloads so
  // a browser cannot badge itself as an agent. MCP sessions set it.
  kind?: import("../../shared/model").PlayerKind;
  gameId?: string;
}

export interface RegisterRobotMessage {
  type: MessageTypes.REGISTER_ROBOT;
  name: string;
  capabilities: RobotCapabilities;
  connection: PlayerConnection;
  playerId: string;
  playerKey?: string;
  gameId?: string;
}

export interface RequestRobotMessage {
  type: MessageTypes.REQUEST_ROBOT;
  gameId: string;
  // Ask for a specific robot by name; omit to let the scheduler choose.
  robotName?: string;
  connection?: PlayerConnection;
  playerId: string;
}

export interface StartGameMessage {
  type: MessageTypes.START_GAME;
  name: string;
  boardSize: number;
  playerCount: number;
  winningSequenceLength?: number;
  // Variant: sequences required to win (default 1, the classic game).
  winningSequenceCount?: number;
  // Variant: equal teams (default 0 = none); playerCount % teamCount == 0.
  teamCount?: number;
  // Start the game already open to strangers from the lobby.
  openSeats?: boolean;
  connection: PlayerConnection;
  playerId: string;
  gameId: string;
  // Chess-clock timers are opt-in: omit timePerPlayer for an untimed game.
  timePerPlayer?: number;
  incrementPerPlayer?: number;
}

export interface JoinGameMessage {
  type: MessageTypes.JOIN_GAME;
  gameId: string;
  connection: PlayerConnection;
  playerId: string;
  // Set when the join came from the public lobby rather than an invite
  // link, so the engine can require the game to be open.
  fromLobby?: boolean;
}

// Open a game you are seated in to strangers browsing the lobby.
export interface OpenSeatsMessage {
  type: MessageTypes.OPEN_SEATS;
  gameId: string;
  connection?: PlayerConnection;
  playerId: string;
  // false closes it again.
  open?: boolean;
}

export interface UpdateTimeMessage {
  type: MessageTypes.NOTIFY_TIME;
  gameId: string;
  connection?: PlayerConnection;
  playerId?: string;
}

export interface SpectateGameMessage {
  type: MessageTypes.SPECTATE_GAME;
  gameId: string;
  connection?: PlayerConnection;
  playerId: string;
}

export interface MakeMoveMessage {
  type: MessageTypes.MAKE_MOVE;
  coordinateX: number;
  coordinateY: number;
  gameId: string;
  connection?: PlayerConnection;
  playerId: string;
}

// Concede an in-progress game.
export interface ForfeitMessage {
  type: MessageTypes.FORFEIT;
  gameId: string;
  connection?: PlayerConnection;
  playerId: string;
}

export interface PlayerDisconnectMessage {
  type: MessageTypes.PLAYER_DISCONNECT;
  playerId: string;
  gameId?: string;
  connection?: PlayerConnection;
}

// Internal: fired when a disconnected player's grace window expires.
export interface PlayerAbandonMessage {
  type: MessageTypes.PLAYER_ABANDON;
  playerId: string;
  gameId?: string;
  connection?: PlayerConnection;
}

export interface ClaimHandleMessage {
  type: MessageTypes.CLAIM_HANDLE;
  handle: string;
  connection?: PlayerConnection;
  playerId: string;
  gameId?: string;
}

export interface ListGamesMessage {
  type: MessageTypes.LIST_GAMES;
  connection?: PlayerConnection;
  playerId?: string;
  gameId?: string;
}

// Personal archive over the socket: the server already knows who is
// asking, so no player id ever appears in a URL.
export interface ListMyGamesMessage {
  type: MessageTypes.LIST_MY_GAMES;
  connection?: PlayerConnection;
  playerId: string;
  gameId?: string;
}

export interface PlayerTimeoutMessage {
  type: MessageTypes.PLAYER_TIMEOUT;
  playerId: string;
  gameId: string;
  connection?: PlayerConnection;
}

export type Message =
  | RegisterPlayerMessage
  | RegisterRobotMessage
  | RequestRobotMessage
  | OpenSeatsMessage
  | StartGameMessage
  | JoinGameMessage
  | SpectateGameMessage
  | MakeMoveMessage
  | ForfeitMessage
  | PlayerDisconnectMessage
  | PlayerAbandonMessage
  | UpdateTimeMessage
  | ListGamesMessage
  | ListMyGamesMessage
  | ClaimHandleMessage
  | PlayerTimeoutMessage;

export interface GameError {
  error: ErrorCodes;
  message: Message;
}

// --- winner calculation ----------------------------------------------------

export interface CalculateWinnerInputType {
  positions: string[][];
  winningSequenceLength: number;
  lastTurnPlayerId: string;
  lastTurnPosition: import("../../shared/model").WinningSequence;
  // Variant fields; omitted = classic game (1 sequence, no teams). The
  // classic case keeps the O(4 * winLen) last-move scan; variants use the
  // shared full-board counter (shared/rules.ts).
  winningSequenceCount?: number;
  teamCount?: number;
  // Seat order, required for team games to map marks to teams.
  players?: string[];
}

export interface CalculateWinnerOutputType {
  winner: string;
  winningSequence: import("../../shared/model").WinningSequence[];
  // Winning team index in team games, else -1.
  winningTeam: number;
}
