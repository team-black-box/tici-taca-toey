// Client-side view of the protocol. The wire format itself lives in
// shared/model.ts (one copy for every module); this file adds only the
// bare message payloads clients send - the server enriches them with the
// connection's playerId on arrival.
import { ErrorCodes, MessageTypes } from "../../../shared/model";

export * from "../../../shared/model";

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

export interface MakeMoveMessage {
  type: MessageTypes.MAKE_MOVE;
  coordinateX: number;
  coordinateY: number;
  gameId: string;
}

export type Message =
  | RegisterPlayerMessage
  | StartGameMessage
  | RequestRobotMessage
  | JoinGameMessage
  | SpectateGameMessage
  | ListGamesMessage
  | ClaimHandleMessage
  | MakeMoveMessage;

export interface GameError {
  error: ErrorCodes;
  message: Message;
}
