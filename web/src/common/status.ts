import { Game, GameStatus, StaticPlayerStore } from "./model";

export interface GameStatusDescriptor {
  text: string;
  // badge class from styles/app.css
  className: string;
}

// Statuses that read the same for every viewer.
export const GAME_STATUS_COLOR_MAP: Record<GameStatus, GameStatusDescriptor> =
  {
    [GameStatus.WAITING_FOR_PLAYERS]: {
      text: "WAITING FOR PLAYERS",
      className: "badge badge--wait",
    },
    [GameStatus.GAME_ABANDONED]: {
      text: "GAME ABANDONED",
      className: "badge badge--dead",
    },
    [GameStatus.GAME_IN_PROGRESS]: {
      text: "GAME IN PROGRESS",
      className: "badge badge--live",
    },
    [GameStatus.GAME_WON]: {
      text: "GAME WON",
      className: "badge badge--done",
    },
    [GameStatus.GAME_ENDS_IN_A_DRAW]: {
      text: "GAME ENDS IN A DRAW",
      className: "badge badge--done",
    },
    [GameStatus.GAME_WON_BY_TIMEOUT]: {
      text: "GAME WON BY TIMEOUT",
      className: "badge badge--done",
    },
  };

// A finished game reads differently depending on who is looking: the winner
// sees GAME WON, a losing player sees GAME LOST, a spectator sees who won.
export const getStatusForViewer = (
  game: Game,
  viewerId: string,
  players: StaticPlayerStore
): GameStatusDescriptor => {
  const won =
    game.status === GameStatus.GAME_WON ||
    game.status === GameStatus.GAME_WON_BY_TIMEOUT;
  if (!won) {
    return GAME_STATUS_COLOR_MAP[game.status];
  }
  const onTime = game.status === GameStatus.GAME_WON_BY_TIMEOUT;
  if (game.winner === viewerId) {
    return {
      text: onTime ? "GAME WON ON TIME" : "GAME WON",
      className: "badge badge--done",
    };
  }
  if (game.players.includes(viewerId)) {
    return {
      text: onTime ? "GAME LOST ON TIME" : "GAME LOST",
      className: "badge badge--dead",
    };
  }
  const winnerName = players[game.winner]?.name;
  return {
    text: `WON BY ${(winnerName || "ANONYMOUS").toUpperCase()}`,
    className: "badge badge--done",
  };
};
