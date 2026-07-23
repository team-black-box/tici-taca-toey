import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppSelector } from "../../../state/store";
import { getActiveGame } from "../../../state/games";
import { getCurrentPlayerId } from "../../../state/currentPlayer";
import { makeMove } from "../../../state/actions";
import { Game, GameStatus } from "../../../common/model";
import { getSideSymbol, EMPTY_CELL } from "../../../common/symbol";
import { ParticleField } from "../../../common/particles";

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
      data-cell={`${coordinateX}:${coordinateY}`}
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

// Nobody wants sparks flying if they have asked the system for calm.
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const Board = () => {
  const currentPlayer: string = useAppSelector(getCurrentPlayerId);
  const game: Game | undefined = useAppSelector(getActiveGame);
  const struck = useLastPlacement(game?.positions);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<ParticleField | null>(null);

  // The board renders nothing until a game is active, so the canvas is
  // absent on a fresh load. This has to re-run when the board appears -
  // with an empty dependency list it bailed once, silently, and no game
  // that started after mount ever got a particle field.
  const hasBoard = game !== undefined;

  // One field per mounted board, kept sized to the board itself so the
  // canvas coordinates are simply the board's own pixels.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) {
      return;
    }
    const field = new ParticleField(canvas);
    fieldRef.current = field;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      field.resize(rect.width, rect.height);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => {
      observer.disconnect();
      field.destroy();
      fieldRef.current = null;
    };
  }, [hasBoard]);

  // Fire the burst from the centre of the cell that just changed, in that
  // player's own neon, and kick the board so the hit has weight.
  useEffect(() => {
    if (!struck || !game || prefersReducedMotion()) {
      return;
    }
    const wrap = wrapRef.current;
    const field = fieldRef.current;
    if (!wrap || !field) {
      return;
    }
    const cell = wrap.querySelector<HTMLElement>(
      `[data-cell="${struck}"]`
    );
    if (!cell) {
      return;
    }
    const cellRect = cell.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    field.burst({
      x: cellRect.left - wrapRect.left + cellRect.width / 2,
      y: cellRect.top - wrapRect.top + cellRect.height / 2,
      // The mark's own colour, read off the rendered cell so it always
      // matches what the player sees - including team colours.
      color: window.getComputedStyle(cell).color,
      scale: cellRect.width,
    });
    wrap.classList.remove("is-hit");
    // Force a reflow so the recoil restarts even on consecutive moves.
    void wrap.offsetWidth;
    wrap.classList.add("is-hit");
    const timer = setTimeout(() => wrap.classList.remove("is-hit"), 400);
    return () => clearTimeout(timer);
  }, [struck, game]);

  if (!game) {
    return null;
  }
  return (
    <div className="board-wrap" ref={wrapRef}>
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
      {/* Sparks sit above the board and never intercept a click. */}
      <canvas className="board-fx" ref={canvasRef} aria-hidden="true" />
    </div>
  );
};

export default Board;
