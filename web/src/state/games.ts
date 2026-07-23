import { Response, MessageTypes, GameStore, Game } from "../common/model";
import { AppState } from "./store";
import { getActiveGameId } from "./currentPlayer";

// reducer
const initialState: GameStore = {};

const reducer = (
  state: GameStore = initialState,
  action: Response
): GameStore => {
  switch (action.type) {
    case MessageTypes.START_GAME:
    case MessageTypes.JOIN_GAME:
    case MessageTypes.SPECTATE_GAME:
    case MessageTypes.MAKE_MOVE:
    case MessageTypes.PLAYER_DISCONNECT:
    case MessageTypes.GAME_RESUMED:
    case MessageTypes.NOTIFY_TIME:
    case MessageTypes.PLAYER_TIMEOUT:
    case MessageTypes.GAME_COMPLETE: {
      return {
        ...state,
        [action.game.gameId]: action.game,
      };
    }
    default:
      return state;
  }
};

export default reducer;

// selectors

export const getGame = (state: AppState, gameId: string) =>
  state.games[gameId];

export const getActiveGame = (state: AppState): Game | undefined =>
  state.games[getActiveGameId(state)];

export const getActiveGamePlayers = (state: AppState) =>
  getActiveGame(state)?.players;

export const getActiveGameStatus = (state: AppState) =>
  getActiveGame(state)?.status;

export const getActiveGameSpectator = (state: AppState) =>
  getActiveGame(state)?.spectators;

export const getActiveGameTurn = (state: AppState) =>
  getActiveGame(state)?.turn;
