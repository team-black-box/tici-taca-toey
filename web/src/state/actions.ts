import {
  MessageTypes,
  RegisterPlayerMessage,
  StartGameMessage,
  JoinGameMessage,
  SpectateGameMessage,
  MakeMoveMessage,
  RequestRobotMessage,
} from "../common/model";
import { dispatch, markRobotPending, say } from "./store";
import { getPlayerKey } from "./identity";

// actions

export const updateCurrentPlayerName = (name: string) => {
  dispatch({
    type: MessageTypes.UPDATE_NAME,
    name,
  });
  const registerPlayerAction: RegisterPlayerMessage = {
    type: MessageTypes.REGISTER_PLAYER,
    name,
    playerKey: getPlayerKey(),
  };
  dispatch(registerPlayerAction);
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
  openToStrangers?: boolean,
  showCursors?: boolean
) => {
  const startGameAction: StartGameMessage = {
    type: MessageTypes.START_GAME,
    name,
    boardSize,
    playerCount,
    winningSequenceLength,
    winningSequenceCount,
    teamCount,
    openSeats: openToStrangers,
    showCursors,
    timePerPlayer,
    incrementPerPlayer,
  };
  dispatch(startGameAction);
};

export const listMyGames = () => {
  dispatch({ type: MessageTypes.LIST_MY_GAMES });
};

export const claimHandle = (handle: string) => {
  dispatch({ type: MessageTypes.CLAIM_HANDLE, handle });
};

// One click from the welcome panel into a live robot match.
export const startRobotGame = () => {
  markRobotPending();
  say("info", "summoning a robot…");
  startGame("You vs The Machine", 3, 2, 3);
};

export const requestRobot = (gameId: string, robotName?: string) => {
  const requestRobotAction: RequestRobotMessage = {
    type: MessageTypes.REQUEST_ROBOT,
    gameId,
    robotName,
  };
  dispatch(requestRobotAction);
};

export const joinGame = (gameId: string, fromLobby = false) => {
  const joinGameAction: JoinGameMessage = {
    type: MessageTypes.JOIN_GAME,
    gameId,
    ...(fromLobby ? { fromLobby: true } : {}),
  };
  dispatch(joinGameAction);
};

// Let strangers take a free seat straight from the lobby.
export const openSeats = (gameId: string, open = true) => {
  dispatch({ type: MessageTypes.OPEN_SEATS, gameId, open });
};

export const spectateGame = (gameId: string) => {
  const spectateGameAction: SpectateGameMessage = {
    type: MessageTypes.SPECTATE_GAME,
    gameId,
  };
  dispatch(spectateGameAction);
};

export const makeMove = (
  gameId: string,
  coordinateX: number,
  coordinateY: number
) => {
  const makeMoveAction: MakeMoveMessage = {
    type: MessageTypes.MAKE_MOVE,
    coordinateX,
    coordinateY,
    gameId,
  };
  dispatch(makeMoveAction);
};

// Concede an in-progress game ("gg").
export const forfeit = (gameId: string) => {
  dispatch({ type: MessageTypes.FORFEIT, gameId });
};

export const setActiveGame = (gameId: string) => {
  dispatch({ type: MessageTypes.SET_ACTIVE_GAME, gameId });
};
