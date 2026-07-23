import { CSSProperties } from "react";
import { useAppSelector } from "../../../state/store";
import { getActiveGame } from "../../../state/games";
import { getCurrentPlayerId } from "../../../state/currentPlayer";
import { makeMove } from "../../../state/actions";
import { Game, GameStatus } from "../../../common/model";
import { getSideSymbol, EMPTY_CELL } from "../../../common/symbol";

interface CellProps {
  playerId: string;
  currentPlayer: string;
  coordinateX: number;
  coordinateY: number;
  game: Game;
}

const Cell = ({
  coordinateX,
  coordinateY,
  playerId,
  currentPlayer,
  game,
}: CellProps) => {
  const playerSymbol = getSideSymbol(playerId, game.players, game.teamCount);

  const cellOpen =
    game.status === GameStatus.GAME_IN_PROGRESS &&
    playerId === EMPTY_CELL &&
    game.turn === currentPlayer;

  const winningCell =
    game.winningSequence &&
    game.winningSequence.some(
      (each) => each.x === coordinateX && each.y === coordinateY
    );

  return (
    <button
      className={`cell ${playerSymbol.color} ${cellOpen ? "is-open" : ""} ${
        winningCell ? "is-win" : ""
      }`}
      disabled={!cellOpen}
      aria-label={`row ${coordinateX + 1} column ${coordinateY + 1}${
        playerSymbol.symbol ? `, ${playerSymbol.symbol}` : cellOpen ? ", empty" : ""
      }`}
      onClick={() => {
        if (cellOpen) {
          makeMove(game.gameId, coordinateX, coordinateY);
        }
      }}
    >
      {playerSymbol.symbol}
    </button>
  );
};

const Board = () => {
  const currentPlayer: string = useAppSelector(getCurrentPlayerId);
  const game: Game | undefined = useAppSelector(getActiveGame);
  if (!game) {
    return null;
  }
  return (
    <div
      className="board"
      style={{ "--n": game.boardSize } as CSSProperties}
    >
      {game.positions
        .flatMap((each) => each)
        .map((each, index) => (
          <Cell
            coordinateX={Math.floor(index / game.boardSize)}
            coordinateY={index % game.boardSize}
            playerId={each}
            currentPlayer={currentPlayer}
            game={game}
            key={index}
          />
        ))}
    </div>
  );
};

export default Board;
