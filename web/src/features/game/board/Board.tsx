import { CSSProperties, useEffect, useRef, useState } from "react";
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
  struck: boolean;
}

const Cell = ({
  coordinateX,
  coordinateY,
  playerId,
  currentPlayer,
  game,
  struck,
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
      } ${struck ? "is-struck" : ""}`}
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

// Which cell just changed, so exactly one lands with a strike. Comparing
// against the previous board means we catch every move - our own and the
// opponents' - without the server having to tell us which was last.
const useLastPlacement = (positions: string[][] | undefined) => {
  const previous = useRef<string[][] | undefined>(undefined);
  const [struck, setStruck] = useState<string | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = positions;
    if (!positions || !before || before.length !== positions.length) {
      return;
    }
    let landed: string | null = null;
    for (let x = 0; x < positions.length; x++) {
      for (let y = 0; y < positions[x].length; y++) {
        if (before[x]?.[y] !== positions[x][y] && positions[x][y] !== EMPTY_CELL) {
          landed = `${x}:${y}`;
        }
      }
    }
    if (!landed) {
      return;
    }
    setStruck(landed);
    // Clear it so a later re-render cannot replay the same animation.
    const timer = setTimeout(() => setStruck(null), 600);
    return () => clearTimeout(timer);
  }, [positions]);

  return struck;
};

const Board = () => {
  const currentPlayer: string = useAppSelector(getCurrentPlayerId);
  const game: Game | undefined = useAppSelector(getActiveGame);
  const struck = useLastPlacement(game?.positions);
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
        .map((each, index) => {
          const x = Math.floor(index / game.boardSize);
          const y = index % game.boardSize;
          return (
            <Cell
              coordinateX={x}
              coordinateY={y}
              playerId={each}
              currentPlayer={currentPlayer}
              game={game}
              struck={struck === `${x}:${y}`}
              key={index}
            />
          );
        })}
    </div>
  );
};

export default Board;
