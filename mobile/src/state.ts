// The mobile store: the web client's state layer (reducers + tiny
// useSyncExternalStore store + self-healing socket) condensed into one file.
// Keep the behavior in sync with web/src/state/ - the web app is the
// behavioral source of truth.
import { useSyncExternalStore } from "react";
import {
  ArchivedGameSummary,
  Game,
  GameStore,
  GameSummary,
  RobotSummary,
  GameInteractionTypes,
  GameStatus,
  Message,
  MessageTypes,
  Response,
  StaticPlayerStore,
} from "./model";
import { SERVER_URL } from "./config";
import * as storage from "./storage";
import { ERROR_COPY, FeedbackKind } from "./theme";

// --- durable identity (hand-rolled storage, see ./storage.ts) so games
// resume across app restarts. Loaded async at bootstrap, before the first
// connect; cached here so the rest of the file reads it synchronously.

const PLAYER_KEY = "playerKey";
const HANDLE_KEY = "handle";

let playerKey = "";

const getPlayerKey = (): string => playerKey;

// --- state shape

export interface CurrentPlayerState {
  connected: boolean;
  name: string;
  playerId: string;
  active: string;
  playing: string[];
  spectating: string[];
}

export interface FeedbackEvent {
  id: number;
  kind: FeedbackKind;
  text: string;
  at: number;
}

export interface AppState {
  currentPlayer: CurrentPlayerState;
  games: GameStore;
  players: StaticPlayerStore;
  lobby: GameSummary[];
  robots: RobotSummary[];
  // Finished games from the server archive (MY_GAMES), newest first.
  history: ArchivedGameSummary[];
  feedback: FeedbackEvent[];
}

let state: AppState = {
  currentPlayer: {
    connected: false,
    name: "", // restored from storage at bootstrap
    playerId: "",
    active: "",
    playing: [],
    spectating: [],
  },
  games: {},
  players: {},
  lobby: [],
  robots: [],
  history: [],
  feedback: [],
};

const listeners = new Set<() => void>();

const uniq = (values: string[]) => Array.from(new Set(values));

const GAME_BEARING = [
  MessageTypes.START_GAME,
  MessageTypes.JOIN_GAME,
  MessageTypes.SPECTATE_GAME,
  MessageTypes.MAKE_MOVE,
  MessageTypes.PLAYER_DISCONNECT,
  MessageTypes.GAME_RESUMED,
  MessageTypes.NOTIFY_TIME,
  MessageTypes.PLAYER_TIMEOUT,
  MessageTypes.GAME_COMPLETE,
];

const reduce = (action: Response) => {
  const current = state.currentPlayer;
  let currentPlayer = current;
  switch (action.type) {
    case MessageTypes.CONNECTED_TO_SERVER:
      currentPlayer = { ...current, connected: true };
      break;
    case MessageTypes.DISCONNECTED_FROM_SERVER:
      currentPlayer = { ...current, connected: false };
      break;
    case MessageTypes.UPDATE_NAME:
      currentPlayer = { ...current, name: action.name };
      break;
    case MessageTypes.REGISTER_PLAYER:
      currentPlayer = {
        ...current,
        playerId: action.playerId,
        name: current.name || action.name,
      };
      break;
    case MessageTypes.START_GAME:
    case MessageTypes.JOIN_GAME:
    case MessageTypes.GAME_RESUMED:
      currentPlayer = {
        ...current,
        active: action.game.gameId,
        playing: uniq([...current.playing, action.game.gameId]),
        spectating: current.spectating.filter(
          (each) => each !== action.game.gameId
        ),
      };
      break;
    case MessageTypes.SPECTATE_GAME: {
      if (!current.playing.includes(action.game.gameId)) {
        const fresh = !current.spectating.includes(action.game.gameId);
        const ended = [
          GameStatus.GAME_WON,
          GameStatus.GAME_ENDS_IN_A_DRAW,
          GameStatus.GAME_WON_BY_TIMEOUT,
        ].includes(action.game.status);
        currentPlayer = {
          ...current,
          active: fresh ? action.game.gameId : current.active,
          spectating: ended
            ? current.spectating.filter((each) => each !== action.game.gameId)
            : uniq([...current.spectating, action.game.gameId]),
        };
      }
      break;
    }
    case MessageTypes.PLAYER_DISCONNECT:
    case MessageTypes.GAME_COMPLETE:
      currentPlayer = {
        ...current,
        playing: current.playing.filter((each) => each !== action.game.gameId),
        spectating: current.spectating.filter(
          (each) => each !== action.game.gameId
        ),
      };
      break;
    case MessageTypes.SET_ACTIVE_GAME:
      currentPlayer = { ...current, active: action.gameId };
      break;
    default:
      break;
  }

  const gameBearing =
    "game" in action && GAME_BEARING.includes(action.type as MessageTypes);
  state = {
    feedback: state.feedback,
    history:
      action.type === MessageTypes.MY_GAMES
        ? (action as { games: ArchivedGameSummary[] }).games
        : state.history,
    robots:
      action.type === MessageTypes.LIST_GAMES && "robots" in action
        ? ((action as { robots?: RobotSummary[] }).robots ?? [])
        : state.robots,
    lobby:
      action.type === MessageTypes.LIST_GAMES && "games" in action
        ? (action as { games: GameSummary[] }).games
        : state.lobby,
    currentPlayer,
    games: gameBearing
      ? { ...state.games, [(action as { game: Game }).game.gameId]: (action as { game: Game }).game }
      : state.games,
    players: gameBearing
      ? {
          ...state.players,
          ...(action as { players?: StaticPlayerStore }).players,
          ...(action as { spectators?: StaticPlayerStore }).spectators,
        }
      : state.players,
  };
  listeners.forEach((listener) => listener());
};

let nextFeedbackId = 1;
export const say = (kind: FeedbackKind, text: string) => {
  state = {
    ...state,
    feedback: [
      ...state.feedback.slice(-3),
      { id: nextFeedbackId++, kind, text, at: Date.now() },
    ],
  };
  listeners.forEach((listener) => listener());
};

const expireFeedback = () => {
  const cutoff = Date.now() - 6000;
  const alive = state.feedback.filter((event) => event.at > cutoff);
  if (alive.length !== state.feedback.length) {
    state = { ...state, feedback: alive };
    listeners.forEach((listener) => listener());
  }
};

// One-click robot game: the next START_GAME response requests a robot.
let robotPending = false;

// Ghost purge: playing entries not refreshed shortly after a (re)connect
// belong to a dead server instance - mark them abandoned, say so.
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
      game: { ...(game ?? { gameId }), gameId, status: GameStatus.GAME_ABANDONED },
      players: {},
      spectators: {},
    } as unknown as Response);
  });
  if (ghosts.length > 0) {
    say("warn", "a game expired while you were away");
  }
};

// --- socket with reconnect

let socket: WebSocket | null = null;
let backoffMs = 500;

const connect = () => {
  socket = new WebSocket(SERVER_URL);
  socket.onopen = () => {
    backoffMs = 500;
    reduce({ type: MessageTypes.CONNECTED_TO_SERVER });
    sendToServer({
      type: MessageTypes.REGISTER_PLAYER,
      name: state.currentPlayer.name,
      playerKey: getPlayerKey(),
    });
    sendToServer({ type: MessageTypes.LIST_GAMES });
    flushPendingLink();
  };
  socket.onmessage = (event) => {
    try {
      const response = JSON.parse(String(event.data));
      if (response.error) {
        const copy =
          ERROR_COPY[response.error as keyof typeof ERROR_COPY] ??
          `server said: ${response.error}`;
        say(response.error === "HANDLE_TAKEN" ? "warn" : "err", copy);
        return;
      }
      if (response.type === MessageTypes.HANDLE_CLAIMED) {
        storage.setString(HANDLE_KEY, response.handle);
        reduce({ type: MessageTypes.UPDATE_NAME, name: response.handle });
        say("ok", `handle claimed: ${response.handle}`);
        return;
      }
      if (response.type === MessageTypes.GAME_RESUMED && response.game) {
        freshGames.add(response.game.gameId);
      }
      if (response.type === MessageTypes.JOIN_GAME && response.game) {
        freshGames.add(response.game.gameId);
      }
      if (response.type === MessageTypes.START_GAME && robotPending) {
        robotPending = false;
        sendToServer({
          type: MessageTypes.REQUEST_ROBOT,
          gameId: response.game.gameId,
        });
      }
      // History changes exactly when a game of mine ends; registration
      // fetches the initial list (empty on a server without a database).
      if (
        response.type === MessageTypes.REGISTER_PLAYER ||
        response.type === MessageTypes.GAME_COMPLETE ||
        response.type === MessageTypes.PLAYER_DISCONNECT
      ) {
        sendToServer({ type: MessageTypes.LIST_MY_GAMES });
      }
      reduce(response);
    } catch (error) {
      console.error("Could not parse server message", error);
    }
  };
  socket.onclose = () => {
    socket = null;
    reduce({ type: MessageTypes.DISCONNECTED_FROM_SERVER });
    setTimeout(connect, backoffMs + Math.random() * 250);
    backoffMs = Math.min(backoffMs * 2, 15_000);
  };
  socket.onerror = () => {
    // close always follows
  };
};

const sendToServer = (message: unknown) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn("Not connected, message dropped", message);
  }
};

// --- deep links
//
// ticitacatoey://play/<id>, ticitacatoey://spectate/<id>, and the same
// paths on https game links. Links can arrive before the socket is up
// (cold start), so they queue until the connection registers; the
// JOIN/SPECTATE response then sets the active game and the lobby screen's
// active-game effect opens the game screen.

const LINK_PATTERN =
  /^(?:ticitacatoey:\/\/|https?:\/\/[^/]+\/)(play|spectate)\/([A-Za-z0-9_-]+)/;

let pendingLink: { kind: string; gameId: string } | null = null;

const flushPendingLink = () => {
  if (!pendingLink || !state.currentPlayer.connected) {
    return;
  }
  const { kind, gameId } = pendingLink;
  pendingLink = null;
  if (state.currentPlayer.playing.includes(gameId)) {
    reduce({ type: MessageTypes.SET_ACTIVE_GAME, gameId } as Response);
    return;
  }
  say(
    "ok",
    kind === GameInteractionTypes.PLAY
      ? "joining game from link..."
      : "spectating from link..."
  );
  sendToServer({
    type:
      kind === GameInteractionTypes.PLAY
        ? MessageTypes.JOIN_GAME
        : MessageTypes.SPECTATE_GAME,
    gameId,
  });
};

// Returns true when the URL was a game link (App.tsx wires this to the
// Linking module for both cold starts and warm arrivals).
export const openGameLink = (url: string | null): boolean => {
  const match = url ? LINK_PATTERN.exec(url) : null;
  if (!match) {
    return false;
  }
  pendingLink = { kind: match[1], gameId: match[2] };
  flushPendingLink();
  return true;
};

// Load identity, then connect - the register message needs the playerKey.
const bootstrap = async () => {
  playerKey = (await storage.getString(PLAYER_KEY)) ?? "";
  if (!playerKey) {
    // RN has no crypto.randomUUID; this is a key, not cryptography.
    playerKey = `m-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
    storage.setString(PLAYER_KEY, playerKey);
  }
  const storedHandle = await storage.getString(HANDLE_KEY);
  if (storedHandle) {
    reduce({ type: MessageTypes.UPDATE_NAME, name: storedHandle } as Response);
  }
  connect();
};
bootstrap();

// Keep the public lobby fresh; ~5s staleness is fine for a lobby.
setInterval(() => {
  if (state.currentPlayer.connected) {
    sendToServer({ type: MessageTypes.LIST_GAMES });
  }
  expireFeedback();
}, 5_000);

// --- public store API

const LOCAL_ACTIONS: string[] = [
  MessageTypes.UPDATE_NAME,
  MessageTypes.CONNECTED_TO_SERVER,
  MessageTypes.DISCONNECTED_FROM_SERVER,
  MessageTypes.SET_ACTIVE_GAME,
];

export const dispatch = (action: Response | Message) => {
  if (LOCAL_ACTIONS.includes(action.type)) {
    reduce(action as Response);
  } else {
    sendToServer(action);
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useAppSelector<T>(selector: (appState: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// --- actions (mirrors web/src/state/actions.ts)

export const updateCurrentPlayerName = (name: string) => {
  storage.setString(HANDLE_KEY, name);
  dispatch({ type: MessageTypes.UPDATE_NAME, name });
  dispatch({
    type: MessageTypes.REGISTER_PLAYER,
    name,
    playerKey: getPlayerKey(),
  });
};

export const startGame = (
  name: string,
  boardSize: number,
  playerCount: number,
  winningSequenceLength: number,
  timePerPlayer?: number,
  incrementPerPlayer?: number,
  winningSequenceCount?: number,
  teamCount?: number,
  openToStrangers?: boolean
) => {
  dispatch({
    type: MessageTypes.START_GAME,
    name,
    boardSize,
    playerCount,
    winningSequenceLength,
    winningSequenceCount,
    teamCount,
    openSeats: openToStrangers,
    timePerPlayer,
    incrementPerPlayer,
  });
};

export const joinGame = (gameId: string, fromLobby = false) => {
  dispatch({
    type: MessageTypes.JOIN_GAME,
    gameId,
    ...(fromLobby ? { fromLobby: true } : {}),
  });
};

// Let strangers take a free seat straight from the lobby.
export const openSeats = (gameId: string, open = true) => {
  dispatch({ type: MessageTypes.OPEN_SEATS, gameId, open });
};

// The public read API. Handles only - the server never exposes player ids.
export const httpBase = (): string =>
  SERVER_URL.replace(/^ws/, "http").replace(/\/+$/, "");

export const fetchLeaderboard = async (pool = "global") => {
  const response = await fetch(
    `${httpBase()}/api/leaderboard?pool=${encodeURIComponent(pool)}&limit=200`
  );
  return (await response.json()) as {
    pool: string;
    pools: string[];
    rows: Array<{
      handle: string;
      kind: string;
      rating: number;
      games: number;
      wins: number;
      draws: number;
      losses: number;
      winRate: number;
    }>;
  };
};

export const fetchPlayerGames = async (handle: string) => {
  const response = await fetch(
    `${httpBase()}/api/handles/${encodeURIComponent(handle)}/games?limit=50`
  );
  return (await response.json()) as { games: ArchivedGameSummary[] };
};

export const spectateGame = (gameId: string) => {
  dispatch({ type: MessageTypes.SPECTATE_GAME, gameId });
};

export const makeMove = (gameId: string, x: number, y: number) => {
  dispatch({
    type: MessageTypes.MAKE_MOVE,
    gameId,
    coordinateX: x,
    coordinateY: y,
  });
};

export const requestRobot = (gameId: string, robotName?: string) => {
  dispatch({ type: MessageTypes.REQUEST_ROBOT, gameId, robotName });
};

export const claimHandle = (handle: string) => {
  dispatch({ type: MessageTypes.CLAIM_HANDLE, handle });
};

export const startRobotGame = () => {
  robotPending = true;
  say("info", "summoning a robot…");
  startGame("You vs The Machine", 3, 2, 3);
};

export const exportSyncUrl = (): string =>
  `https://ticitacatoey.com/sync#${getPlayerKey()}`;

// Import an identity from another device: store the key and reconnect as
// that player. The key is the account - never display it casually.
export const importIdentity = (raw: string) => {
  const key = raw.trim().split("#").pop() ?? "";
  if (key.length < 8) {
    say("warn", "that does not look like a sync code");
    return;
  }
  playerKey = key;
  storage.setString(PLAYER_KEY, key);
  say("ok", "identity imported - reconnecting");
  socket?.close();
};

export const setActiveGame = (gameId: string) => {
  dispatch({ type: MessageTypes.SET_ACTIVE_GAME, gameId });
};

export const getShareUrl = (
  gameId: string,
  mode: GameInteractionTypes
): string => `https://ticitacatoey.com/${mode}/${gameId}`;
