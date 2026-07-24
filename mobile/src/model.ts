// Client-side view of the protocol. The wire format itself lives in
// shared/model.ts (one copy for every module); this file adds only the
// bare message payloads clients send - the server enriches them with the
// connection's playerId on arrival.
import { ErrorCodes, MessageTypes } from "../../shared/model";

export * from "../../shared/model";

export interface RegisterPlayerMessage {
  type: MessageTypes.REGISTER_PLAYER;
  name: string;
  // Secret durable identity enabling reconnect-and-resume. Never shown.
  playerKey: string;
}

export interface StartGameMessage {
  type: MessageTypes.START_GAME;
  name: string;
  boardSize: number;
  playerCount: number;
  winningSequenceLength: number;
  // Variant: sequences required to win (default 1, the classic game).
  winningSequenceCount?: number;
  // Variant: equal teams (default 0 = none); playerCount % teamCount == 0.
  teamCount?: number;
  // Start already open to strangers from the lobby.
  openSeats?: boolean;
  // Let opponents see everyone's cursor too, not just teammates and
  // spectators. Fixed at start - see Game.showCursors.
  showCursors?: boolean;
  timePerPlayer?: number;
  incrementPerPlayer?: number;
}

export interface RequestRobotMessage {
  type: MessageTypes.REQUEST_ROBOT;
  gameId: string;
  // Ask for a specific robot by name; omit to let the scheduler choose.
  robotName?: string;
}

export interface JoinGameMessage {
  type: MessageTypes.JOIN_GAME;
  gameId: string;
  // Joining from the public lobby rather than an invite link; the server
  // then requires the game to be open to strangers.
  fromLobby?: boolean;
}

// Open (or close) a game you host to strangers browsing the lobby.
export interface OpenSeatsMessage {
  type: MessageTypes.OPEN_SEATS;
  gameId: string;
  open?: boolean;
}

export interface SpectateGameMessage {
  type: MessageTypes.SPECTATE_GAME;
  gameId: string;
}

export interface ClaimHandleMessage {
  type: MessageTypes.CLAIM_HANDLE;
  handle: string;
}

export interface ListGamesMessage {
  type: MessageTypes.LIST_GAMES;
}

// Personal archive request; the server knows who is asking from the
// socket, so this carries nothing.
export interface ListMyGamesMessage {
  type: MessageTypes.LIST_MY_GAMES;
}

export interface MakeMoveMessage {
  type: MessageTypes.MAKE_MOVE;
  coordinateX: number;
  coordinateY: number;
  gameId: string;
}

export interface ForfeitMessage {
  type: MessageTypes.FORFEIT;
  gameId: string;
}

export type Message =
  | RegisterPlayerMessage
  | StartGameMessage
  | RequestRobotMessage
  | JoinGameMessage
  | SpectateGameMessage
  | OpenSeatsMessage
  | ListGamesMessage
  | ListMyGamesMessage
  | ClaimHandleMessage
  | MakeMoveMessage
  | ForfeitMessage;

export interface GameError {
  error: ErrorCodes;
  message: Message;
}
