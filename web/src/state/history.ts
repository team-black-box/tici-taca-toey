// The player's finished games, straight from the server archive over the
// websocket (MY_GAMES). Refreshed on connect and whenever a game the
// player is in completes; each row carries its TTN line, so replaying is
// pure navigation - no further fetches.
import { ArchivedGameSummary, MessageTypes, Response } from "../common/model";
import { AppState } from "./store";

export type HistoryState = ArchivedGameSummary[];

const initialState: HistoryState = [];

const reducer = (
  state: HistoryState = initialState,
  action: Response
): HistoryState => {
  switch (action.type) {
    case MessageTypes.MY_GAMES:
      return action.games;
    default:
      return state;
  }
};

export default reducer;

export const getMyGames = (state: AppState): HistoryState => state.history;
