// A tiny replacement for redux + react-redux + redux-thunk, built on React's
// useSyncExternalStore. Three reducers plus feedback and lobby slices, and a
// websocket "middleware" that sends game actions to the server and reduces
// server responses into local state.
import { useSyncExternalStore } from "react";
import {
  MessageTypes,
  ErrorCodes,
  Response,
  Message,
  GameStore,
  StaticPlayerStore,
  GameStatus,
} from "../common/model";
import { initSocket, sendToServer } from "./socket";
import { getPlayerKey } from "./identity";
import currentPlayerReducer, { CurrentPlayerState } from "./currentPlayer";
import gamesReducer from "./games";
import playersReducer from "./players";
import lobbyReducer, { LobbyState } from "./lobby";
import historyReducer, { HistoryState } from "./history";
import feedbackReducer, {
  ERROR_COPY,
  FeedbackEvent,
  feedbackEvent,
} from "./feedback";

export interface AppState {
  currentPlayer: CurrentPlayerState;
  games: GameStore;
  players: StaticPlayerStore;
  lobby: LobbyState;
  history: HistoryState;
  feedback: FeedbackEvent[];
}

const INIT_ACTION = { type: "@@INIT" } as unknown as Response;

let state: AppState = {
  currentPlayer: currentPlayerReducer(undefined, INIT_ACTION),
  games: gamesReducer(undefined, INIT_ACTION),
  players: playersReducer(undefined, INIT_ACTION),
  lobby: lobbyReducer(undefined, INIT_ACTION),
  history: historyReducer(undefined, INIT_ACTION),
  feedback: feedbackReducer(undefined, INIT_ACTION),
};

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getState = (): AppState => state;

const reduce = (action: Response | { type: string }) => {
  state = {
    currentPlayer: currentPlayerReducer(state.currentPlayer, action as Response),
    games: gamesReducer(state.games, action as Response),
    players: playersReducer(state.players, action as Response),
    lobby: lobbyReducer(state.lobby, action as Response),
    history: historyReducer(state.history, action as Response),
    feedback: feedbackReducer(state.feedback, action as { type: string }),
  };
  listeners.forEach((listener) => listener());
};

export const say = (
  kind: "ok" | "info" | "warn" | "err",
  text: string
) => reduce(feedbackEvent(kind, text));

// Actions handled purely on the client; everything else goes to the server.
const LOCAL_ACTIONS: string[] = [
  MessageTypes.UPDATE_NAME,
  MessageTypes.CONNECTED_TO_SERVER,
  MessageTypes.DISCONNECTED_FROM_SERVER,
  MessageTypes.SET_ACTIVE_GAME,
];

// One-click robot game: when set, the next START_GAME response immediately
// requests a robot for that game.
let robotPending = false;
export const markRobotPending = () => {
  robotPending = true;
};

export const dispatch = (action: Response | Message) => {
  if (LOCAL_ACTIONS.includes(action.type)) {
    reduce(action as Response);
  } else {
    sendToServer(action);
  }
};

export function useAppSelector<T>(selector: (appState: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// Ghost-game purge: if a resume round-trip completes and a game we think we
// are playing was not resumed, the instance that owned it is gone - mark it
// abandoned and say so, instead of rendering a board the server forgot.
const freshGames = new Set<string>();
let resumeSweep: ReturnType<typeof setTimeout> | undefined;

const purgeGhosts = () => {
  const ghosts = state.currentPlayer.playing.filter(
    (gameId) => !freshGames.has(gameId)
  );
  ghosts.forEach((gameId) => {
    const game = state.games[gameId];
    reduce({
      type: MessageTypes.PLAYER_DISCONNECT,
      game: {
        ...(game ?? { gameId }),
        gameId,
        status: GameStatus.GAME_ABANDONED,
      },
      players: {},
      spectators: {},
    } as unknown as Response);
  });
  if (ghosts.length > 0) {
    say("warn", `${ghosts.length} game${ghosts.length > 1 ? "s" : ""} expired while you were away`);
  }
};

initSocket({
  onMessage: (data) => {
    const response = data as Response & { error?: ErrorCodes };
    if (response.error) {
      const copy =
        ERROR_COPY[response.error] ?? `server said: ${response.error}`;
      say(response.error === ErrorCodes.HANDLE_TAKEN ? "warn" : "err", copy);
      return;
    }
    if (response.type === MessageTypes.HANDLE_CLAIMED) {
      reduce({ type: MessageTypes.UPDATE_NAME, name: response.handle });
      say("ok", `handle claimed: ${response.handle}`);
      return;
    }
    if (response.type === MessageTypes.GAME_RESUMED) {
      freshGames.add((response as { game: { gameId: string } }).game.gameId);
    }
    // History changes exactly when a game of mine ends (a win/draw arrives
    // as GAME_COMPLETE, an abandon as PLAYER_DISCONNECT); registration
    // fetches the initial list (the server answers empty without a db).
    if (
      response.type === MessageTypes.REGISTER_PLAYER ||
      response.type === MessageTypes.GAME_COMPLETE ||
      response.type === MessageTypes.PLAYER_DISCONNECT
    ) {
      sendToServer({ type: MessageTypes.LIST_MY_GAMES });
    }
    if (response.type === MessageTypes.START_GAME && robotPending) {
      robotPending = false;
      sendToServer({
        type: MessageTypes.REQUEST_ROBOT,
        gameId: (response as { game: { gameId: string } }).game.gameId,
      });
    }
    if (response.type === MessageTypes.JOIN_GAME) {
      const game = (response as { game: { gameId: string; players: string[] } })
        .game;
      freshGames.add(game.gameId);
      if (game.players.some((id) => id.startsWith("resident-"))) {
        // a robot just sat down somewhere in this game
      }
    }
    reduce(response);
  },
  onOpen: () => {
    const wasEverConnected = state.currentPlayer.playerId !== "";
    reduce({ type: MessageTypes.CONNECTED_TO_SERVER });
    say("ok", wasEverConnected ? "reconnected" : "connected to server");
    freshGames.clear();
    sendToServer({
      type: MessageTypes.REGISTER_PLAYER,
      name: state.currentPlayer.name,
      playerKey: getPlayerKey(),
    });
    sendToServer({ type: MessageTypes.LIST_GAMES });
    if (resumeSweep) {
      clearTimeout(resumeSweep);
    }
    resumeSweep = setTimeout(purgeGhosts, 3000);
  },
  onClose: () => {
    if (state.currentPlayer.connected) {
      say("warn", "connection lost - reconnecting");
    }
    reduce({ type: MessageTypes.DISCONNECTED_FROM_SERVER });
  },
});

// Keep the public lobby fresh and expire old feedback lines.
setInterval(() => {
  if (state.currentPlayer.connected) {
    sendToServer({ type: MessageTypes.LIST_GAMES });
  }
  reduce({ type: "FEEDBACK_EXPIRE" });
}, 5_000);
