import {
  Response,
  MessageTypes,
  GameSummary,
  RobotSummary,
} from "../common/model";
import { AppState } from "./store";

// reducer: the public lobby (running games + robot roster), refreshed by
// LIST_GAMES polls
export interface LobbyState {
  games: GameSummary[];
  robots: RobotSummary[];
}

const initialState: LobbyState = { games: [], robots: [] };

const reducer = (
  state: LobbyState = initialState,
  action: Response
): LobbyState => {
  switch (action.type) {
    case MessageTypes.LIST_GAMES:
      return { games: action.games, robots: action.robots ?? [] };
    default:
      return state;
  }
};

export default reducer;

// selectors

export const getLobbyGames = (state: AppState) => state.lobby.games;
export const getLobbyRobots = (state: AppState) => state.lobby.robots;
