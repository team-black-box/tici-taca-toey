// Strategy helpers for the reference robots. This deliberately lives with
// the robots, not in the SDK: the SDK provides plumbing, never play
// strength. Bring your own brains.
import { GameView, Move, emptyCells } from "../sdk/src/index";

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// Would placing playerId at (x, y) complete a winning sequence?
export const isWinningPlacement = (
  game: GameView,
  playerId: string,
  move: Move
): boolean => {
  const size = game.boardSize;
  const at = (x: number, y: number): string =>
    x === move.x && y === move.y ? playerId : game.positions[x][y];
  for (const [dx, dy] of DIRECTIONS) {
    let run = 1;
    for (const sign of [1, -1] as const) {
      let x = move.x + dx * sign;
      let y = move.y + dy * sign;
      while (
        x >= 0 &&
        x < size &&
        y >= 0 &&
        y < size &&
        at(x, y) === playerId
      ) {
        run++;
        x += dx * sign;
        y += dy * sign;
      }
    }
    if (run >= game.winningSequenceLength) {
      return true;
    }
  }
  return false;
};

// First empty cell that wins the game for playerId right now, if any.
export const findWinningMove = (
  game: GameView,
  playerId: string
): Move | null => {
  for (const move of emptyCells(game)) {
    if (isWinningPlacement(game, playerId, move)) {
      return move;
    }
  }
  return null;
};
