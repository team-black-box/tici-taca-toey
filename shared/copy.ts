// One voice for every error the server can speak, shared by the web and
// mobile status feeds. Lowercase terminal tone, always actionable.
import { ErrorCodes } from "./model";

export const ERROR_COPY: Record<ErrorCodes, string> = {
  [ErrorCodes.GAME_NOT_FOUND]: "game not found - it may have ended or expired",
  [ErrorCodes.PLAYER_ALREADY_PART_OF_GAME]: "you are already in this game",
  [ErrorCodes.PLAYER_NOT_PART_OF_GAME]: "only seated players can do that",
  [ErrorCodes.GAME_ALREADY_IN_PROGRESS]:
    "that game already started - you can spectate it",
  [ErrorCodes.MOVE_OUT_OF_TURN]: "not your turn yet",
  [ErrorCodes.INVALID_MOVE]: "that cell is taken",
  [ErrorCodes.BAD_REQUEST]: "the server did not understand that",
  [ErrorCodes.BOARD_SIZE_LESS_THAN_2]: "board size must be at least 2",
  [ErrorCodes.PLAYER_COUNT_LESS_THAN_2]: "you need at least 2 players",
  [ErrorCodes.WIN_SEQ_LENGTH_MUST_BE_LESS_THAN_OR_EQUAL_TO_BOARD_SIZE]:
    "win sequence cannot exceed the board size",
  [ErrorCodes.INVALID_WINNING_SEQUENCE_COUNT]:
    "that many sequences will not fit - fewer sequences, or a bigger board",
  [ErrorCodes.INVALID_TEAM_CONFIGURATION]:
    "teams must split players evenly, at least 2 per team",
  [ErrorCodes.NO_ROBOT_AVAILABLE]:
    "no robot fits this game right now - try a smaller board",
  [ErrorCodes.INVALID_HANDLE]:
    "handles are 2-20 chars: letters, numbers, - and _",
  [ErrorCodes.HANDLE_TAKEN]: "that handle is taken - try another",
  [ErrorCodes.HANDLES_UNAVAILABLE]: "handles are unavailable on this server",
  [ErrorCodes.RATE_LIMITED]: "easy there - slow down a little",
  [ErrorCodes.PLAYER_COUNT_MUST_BE_LESS_THAN_BOARD_SIZE]:
    "players must be fewer than the board size",
  [ErrorCodes.BOARD_SIZE_CANNOT_BE_GREATER_THAN_12]: "board size caps at 12",
  [ErrorCodes.PLAYER_COUNT_CANNOT_BE_GREATER_THAN_10]:
    "player count caps at 10",
  [ErrorCodes.SPECTATOR_COUNT_CANNOT_BE_GREATER_THAN_10]:
    "this game has a full gallery already",
  [ErrorCodes.PLAYER_TIME_OUT]: "your clock ran out",
  [ErrorCodes.INVALID_TIMER_CONFIGURATION]:
    "clock settings are out of range",
  [ErrorCodes.SERVER_AT_CAPACITY]:
    "the server is at capacity - try again shortly",
  [ErrorCodes.INVALID_ROBOT_CAPABILITIES]:
    "that robot registration was malformed",
  [ErrorCodes.GAME_IS_FULL]: "that game is full - spectate instead",
};
