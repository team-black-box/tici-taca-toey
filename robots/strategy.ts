// Strategy helpers for the reference robots. This deliberately lives with
// the robots, not in the SDK: the SDK provides plumbing, never play
// strength. Bring your own brains.
import { GameView, Move, emptyCells } from "../sdk/src/index";
import { countSequences, ownerOfSeat, teamOfSeat } from "../shared/rules";

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// Games using the 2026-07 variants (several required sequences, or teams)
// need the full board scan; the classic game does not.
const isVariant = (game: GameView): boolean =>
  game.winningSequenceCount > 1 || game.teamCount > 0;

// Everyone whose marks count toward playerId's sequences: their team in a
// team game, otherwise just them.
export const alliesOf = (
  game: GameView,
  playerId: string
): ((value: string) => boolean) =>
  ownerOfSeat(game.players, game.players.indexOf(playerId), game.teamCount);

// Is playerId on the same side as other? (Teammates are never blocked.)
export const isSameSide = (
  game: GameView,
  playerId: string,
  other: string
): boolean =>
  game.teamCount > 0
    ? teamOfSeat(game.players.indexOf(playerId), game.teamCount) ===
      teamOfSeat(game.players.indexOf(other), game.teamCount)
    : playerId === other;

// Would placing playerId at (x, y) win the game right now? In a team game
// teammates' marks count toward the sequence, and a game may require
// several sequences - see shared/rules.ts.
export const isWinningPlacement = (
  game: GameView,
  playerId: string,
  move: Move
): boolean => {
  if (!isVariant(game)) {
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
  }
  const previous = game.positions[move.x][move.y];
  game.positions[move.x][move.y] = playerId;
  const { count } = countSequences(
    game.positions,
    game.winningSequenceLength,
    alliesOf(game, playerId)
  );
  game.positions[move.x][move.y] = previous;
  return count >= game.winningSequenceCount;
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
