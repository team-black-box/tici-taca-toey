import {
  MessageTypes,
  RegisterPlayerMessage,
  StartGameMessage,
  JoinGameMessage,
  SpectateGameMessage,
  MakeMoveMessage,
  RequestRobotMessage,
  Game,
  PlayerKind,
  StaticPlayerStore,
} from "../common/model";
import {
  dispatch,
  markRobotPending,
  markRobotsPending,
  say,
} from "./store";
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

// Play that again. A finished game used to be a dead end - you had to
// go back to the lobby and rebuild the same configuration by hand,
// which is the moment most people simply stopped.
//
// "The same game" means the same board, the same rules, the same
// clocks, and the same machines: any robot or agent that was seated is
// asked for again by name, so a rematch against minnie-max is against
// minnie-max. Humans cannot be summoned - there is no way to page
// someone, by design - so for them this opens the same game and hands
// you the invite to share.
export const rematch = (
  game: Game,
  players: StaticPlayerStore,
  currentPlayerId: string
) => {
  const machines = game.players
    .filter((playerId) => playerId !== currentPlayerId)
    .map((playerId) => players[playerId])
    .filter(
      (player): player is NonNullable<typeof player> =>
        player !== undefined && player.kind !== PlayerKind.HUMAN
    );
  markRobotsPending(machines.map((player) => player.name));
  startGame(
    game.name,
    game.boardSize,
    game.playerCount,
    game.winningSequenceLength,
    game.timed ? game.timePerPlayer : undefined,
    game.timed ? game.incrementPerPlayer : undefined,
    game.winningSequenceCount > 1 ? game.winningSequenceCount : undefined,
    game.teamCount > 0 ? game.teamCount : undefined,
    game.openSeats,
    game.showCursors
  );
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
