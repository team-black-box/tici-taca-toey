import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppSelector } from "../../../state/store";
import { getActiveGame } from "../../../state/games";
import { getCurrentPlayerId } from "../../../state/currentPlayer";
import { makeMove } from "../../../state/actions";
import {
  CURSOR_OFF_BOARD,
  CursorTuple,
  Game,
  GameStatus,
} from "../../../common/model";
import { GAME_SYMBOL, getSideSymbol, EMPTY_CELL } from "../../../common/symbol";
import { ParticleField } from "../../../common/particles";
import {
  forgetSentCursor,
  sendCursor,
  subscribeToCursors,
} from "../../../state/cursors";

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

// The other people in this game, hovering. Its own component on purpose:
// cursors arrive several times a second, and keeping the state here means
// a pointer moving re-renders ten small spans rather than the whole board.
//
// Ghosts are positioned against the real cell elements rather than by grid
// arithmetic, so the 4px gap, a resize, and a `container-type` board all
// stay correct without this file knowing the stylesheet.
const CursorLayer = ({
  game,
  mySeat,
  wrapRef,
}: {
  game: Game;
  mySeat: number;
  wrapRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const [cursors, setCursors] = useState<CursorTuple[]>([]);
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => subscribeToCursors(game.gameId, setCursors),
    [game.gameId]
  );

  // The payload is one broadcast for the whole audience, so it contains
  // our own seat too - we already know where our own pointer is.
  const visible = cursors.filter(([seat]) => seat !== mySeat);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const wrap = wrapRef.current;
    if (!layer || !wrap) {
      return;
    }
    Array.from(layer.children).forEach((node) => {
      const ghost = node as HTMLElement;
      const cell = wrap.querySelector<HTMLElement>(
        `[data-cell="${ghost.dataset.at}"]`
      );
      if (!cell) {
        return;
      }
      ghost.style.transform = `translate(${
        cell.offsetLeft + cell.offsetWidth / 2
      }px, ${cell.offsetTop + cell.offsetHeight / 2}px) translate(-50%, -50%)`;
      ghost.style.fontSize = `${Math.max(11, cell.offsetWidth * 0.4)}px`;
    });
  }, [visible, wrapRef]);

  if (game.status !== GameStatus.GAME_IN_PROGRESS) {
    return null;
  }

  return (
    <div className="cursor-layer" ref={layerRef} aria-hidden="true">
      {visible.map(([seat, x, y]) => {
        const symbol =
          GAME_SYMBOL[
            (game.teamCount > 0 ? seat % game.teamCount : seat) % 10
          ];
        return (
          <span
            key={seat}
            className={`cursor-ghost ${symbol.color}`}
            data-at={`${x}:${y}`}
          >
            {symbol.symbol}
          </span>
        );
      })}
    </div>
  );
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

  const mySeat = game.players.indexOf(currentPlayer);
  const iAmPlaying =
    mySeat >= 0 && game.status === GameStatus.GAME_IN_PROGRESS;

  // Which cell the pointer is over, from the grid's own geometry. The
  // cells are <button>s and a disabled button dispatches no pointer
  // events at all, so listening on them would go quiet the moment it is
  // not your turn - exactly when you are most likely to be hovering.
  const cellFromPointer = (
    event: React.PointerEvent<HTMLDivElement>
  ): { x: number; y: number } | null => {
    const board = event.currentTarget;
    const rect = board.getBoundingClientRect();
    const gap = parseFloat(window.getComputedStyle(board).columnGap) || 0;
    const pitch = (rect.width + gap) / game.boardSize;
    if (!(pitch > 0)) {
      return null;
    }
    // x is the row (down), y the column (across) - the board's convention.
    const x = Math.floor((event.clientY - rect.top) / pitch);
    const y = Math.floor((event.clientX - rect.left) / pitch);
    if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) {
      return null;
    }
    return { x, y };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!iAmPlaying || event.pointerType === "touch") {
      return;
    }
    const cell = cellFromPointer(event);
    if (cell) {
      sendCursor(game.gameId, cell.x, cell.y);
    } else {
      sendCursor(game.gameId, CURSOR_OFF_BOARD, CURSOR_OFF_BOARD);
    }
  };

  const onPointerLeave = () => {
    if (!iAmPlaying) {
      return;
    }
    sendCursor(game.gameId, CURSOR_OFF_BOARD, CURSOR_OFF_BOARD);
    forgetSentCursor();
  };

  return (
    <div className="board-wrap" ref={wrapRef}>
      <div
        className="board"
        style={{ "--n": game.boardSize } as CSSProperties}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
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
      {/* Everyone else's pointer, and then the sparks on top. Neither
          layer ever intercepts a click. */}
      <CursorLayer game={game} mySeat={mySeat} wrapRef={wrapRef} />
      <canvas className="board-fx" ref={canvasRef} aria-hidden="true" />
    </div>
  );
};

export default Board;
