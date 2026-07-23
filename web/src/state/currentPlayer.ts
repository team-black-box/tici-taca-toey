import {
  Response,
  MessageTypes,
  GameInteractionTypes,
  GameStatus,
} from "../common/model";
import { AppState } from "./store";

// reducer

export interface CurrentPlayerState {
  connected: boolean;
  name: string;
  playerId: string;
  active: string;
  playing: string[];
  spectating: string[];
}

const initialState: CurrentPlayerState = {
  connected: false,
  name: "",
  playerId: "",
  active: "",
  playing: [],
  spectating: [],
};

const uniq = (values: string[]) => Array.from(new Set(values));

const reducer = (
  state: CurrentPlayerState = initialState,
  action: Response
): CurrentPlayerState => {
  switch (action.type) {
    case MessageTypes.CONNECTED_TO_SERVER:
      return { ...state, connected: true };
    case MessageTypes.DISCONNECTED_FROM_SERVER:
      return { ...state, connected: false };
    case MessageTypes.UPDATE_NAME:
      return { ...state, name: action.name };
    case MessageTypes.REGISTER_PLAYER:
      // The server echoes our stored name: restores the handle after resume.
      return {
        ...state,
        playerId: action.playerId,
        name: state.name || action.name,
      };
    case MessageTypes.START_GAME:
    case MessageTypes.JOIN_GAME:
    case MessageTypes.GAME_RESUMED:
      return {
        ...state,
        active: action.game.gameId,
        playing: uniq([...state.playing, action.game.gameId]),
        spectating: [
          ...state.spectating.filter((each) => each !== action.game.gameId),
        ],
      };
    case MessageTypes.SPECTATE_GAME: {
      if (state.playing.includes(action.game.gameId)) {
        return state;
      } else {
        const newGameToSpectate = !state.spectating.includes(
          action.game.gameId
        );
        const gameEnded = [
          GameStatus.GAME_WON,
          GameStatus.GAME_ENDS_IN_A_DRAW,
          GameStatus.GAME_WON_BY_TIMEOUT,
        ].includes(action.game.status);
        return {
          ...state,
          active: newGameToSpectate ? action.game.gameId : state.active,
          spectating: gameEnded
            ? [
                ...state.spectating.filter(
                  (each) => each !== action.game.gameId
                ),
              ]
            : uniq([...state.spectating, action.game.gameId]),
        };
      }
    }
    case MessageTypes.PLAYER_DISCONNECT:
    case MessageTypes.GAME_COMPLETE:
      return {
        ...state,
        playing: [
          ...state.playing.filter((each) => each !== action.game.gameId),
        ],
        spectating: [
          ...state.spectating.filter((each) => each !== action.game.gameId),
        ],
      };
    case MessageTypes.SET_ACTIVE_GAME: {
      return {
        ...state,
        active: action.gameId,
      };
    }
    default:
      return state;
  }
};

export default reducer;

// selectors

const getCurrentPlayer = (state: AppState) => state.currentPlayer;

export const isConnectedToServer = (state: AppState) =>
  getCurrentPlayer(state).connected;

export const getCurrentPlayerName = (state: AppState) =>
  getCurrentPlayer(state).name;

export const getCurrentPlayerId = (state: AppState) =>
  getCurrentPlayer(state).playerId;

export const getCurrentlyPlayingGames = (state: AppState) =>
  getCurrentPlayer(state).playing;

export const getCurrentlySpectatingGames = (state: AppState) =>
  getCurrentPlayer(state).spectating;

export const getActiveGameId = (state: AppState) =>
  getCurrentPlayer(state).active;

export const getActiveGameMode = (
  state: AppState
): GameInteractionTypes | undefined => {
  const currentPlayer = getCurrentPlayer(state);
  return currentPlayer.playing.includes(currentPlayer.active)
    ? GameInteractionTypes.PLAY
    : currentPlayer.spectating.includes(currentPlayer.active)
    ? GameInteractionTypes.SPECTATE
    : undefined;
};
