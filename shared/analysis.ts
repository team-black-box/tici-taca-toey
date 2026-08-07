// What actually decided a game, read back out of its notation line.
//
// A replay could already show you every move. It could not tell you
// which one mattered. Everything needed to say so is already recorded:
// the moves, the rules that scored them, and - in a timed game - how
// long each one took. This walks the line and marks the two moments
// worth knowing about.
//
//   - a **miss**: it was your turn, a move existed that would have won
//     the game outright, and you played something else.
//   - a **letoff**: your opponent had a winning move available on their
//     next turn and you did not take it away from them.
//
// Deliberately only those two. "Was this the best move" needs a search
// and an opinion; "there was a win here and you walked past it" is a
// fact, and facts age better. A player who wants more can read the
// board.
//
// Pure and dependency-free, like the rest of shared/: the clients run
// it on a decoded line with no server round trip, and it works on every
// game already in the corpus.
import { DecodedGame } from "./ttn";
import { countSequences, ownerOfSeat, teamOfSeat } from "./rules";

const EMPTY = "-";

export interface AnalysedMove {
  // Index into DecodedGame.moves.
  index: number;
  seat: number;
  x: number;
  y: number;
  // Milliseconds spent on this move (0 in untimed games).
  clockMs: number;
  // A winning cell that was available to this seat and not played.
  missedWin?: { x: number; y: number };
  // A cell an opponent was about to win on that this seat left open.
  // Only reported when the opponent actually took it next turn, so it
  // reads as "that is where it was lost" rather than as nagging.
  missedBlock?: { x: number; y: number };
}

export interface GameAnalysis {
  moves: AnalysedMove[];
  // The single move most worth looking at, if there is one: the last
  // miss or letoff by the side that went on to lose.
  turningPoint?: AnalysedMove;
  // Median thinking time, so a client can point at a move played far
  // faster than the player's own norm. Undefined in untimed games.
  medianClockMs?: number;
}

// Every empty cell on the board.
const emptyCells = (positions: string[][]): Array<{ x: number; y: number }> => {
  const cells: Array<{ x: number; y: number }> = [];
  positions.forEach((row, x) =>
    row.forEach((value, y) => {
      if (value === EMPTY) {
        cells.push({ x, y });
      }
    })
  );
  return cells;
};

// Would playing `cell` complete the game for `seat`? Scored with the
// same counter the server uses, so a "win" here is a win there - teams
// and multi-sequence games included, rather than a re-implementation
// that could drift from the real rules.
const winsWith = (
  game: DecodedGame,
  positions: string[][],
  seat: number,
  cell: { x: number; y: number }
): boolean => {
  const previous = positions[cell.x][cell.y];
  positions[cell.x][cell.y] = String(seat);
  // Seat labels in a decoded line are "0".."9", which is exactly what
  // ownerOfSeat expects as its player list.
  const players = Array.from({ length: game.playerCount }, (_, index) =>
    String(index)
  );
  const { count } = countSequences(
    positions,
    game.winningSequenceLength,
    ownerOfSeat(players, seat, game.teamCount)
  );
  positions[cell.x][cell.y] = previous;
  return count >= game.winningSequenceCount;
};

// A winning cell for `seat` on this board, if one exists.
const winningCellFor = (
  game: DecodedGame,
  positions: string[][],
  seat: number
): { x: number; y: number } | undefined =>
  emptyCells(positions).find((cell) => winsWith(game, positions, seat, cell));

const sameSide = (game: DecodedGame, a: number, b: number): boolean =>
  game.teamCount > 0
    ? teamOfSeat(a, game.teamCount) === teamOfSeat(b, game.teamCount)
    : a === b;

export const analyseGame = (game: DecodedGame): GameAnalysis => {
  const positions = Array.from({ length: game.boardSize }, () =>
    Array.from({ length: game.boardSize }, () => EMPTY)
  );
  const moves: AnalysedMove[] = [];
  const played = game.moves;

  played.forEach((move, index) => {
    if (move.skip) {
      // A timed-out seat did not choose anything; nothing to judge.
      return;
    }
    const analysed: AnalysedMove = {
      index,
      seat: move.seat,
      x: move.x,
      y: move.y,
      clockMs: move.clockMs,
    };

    // Was a win sitting there before this move?
    const win = winningCellFor(game, positions, move.seat);
    if (win && !(win.x === move.x && win.y === move.y)) {
      analysed.missedWin = win;
    }

    // Commit the move, then ask what it left standing.
    positions[move.x][move.y] = String(move.seat);

    // A letoff only counts if the opponent actually cashed it in on
    // their next move - otherwise every game is full of scolding about
    // threats nobody was going to take.
    const next = played
      .slice(index + 1)
      .find((later) => !later.skip && !sameSide(game, later.seat, move.seat));
    if (next) {
      const before = positions[next.x][next.y];
      positions[next.x][next.y] = EMPTY;
      const theirWin = winningCellFor(game, positions, next.seat);
      positions[next.x][next.y] = before;
      if (
        theirWin &&
        theirWin.x === next.x &&
        theirWin.y === next.y &&
        !analysed.missedWin
      ) {
        // Taking your own win instead is never a mistake, so a missed
        // win already explains this move and outranks it.
        analysed.missedBlock = { x: next.x, y: next.y };
      }
    }

    moves.push(analysed);
  });

  const clocks = moves
    .map((move) => move.clockMs)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const medianClockMs =
    clocks.length > 0 ? clocks[Math.floor(clocks.length / 2)] : undefined;

  // The turning point belongs to whoever lost: their last chance to
  // have done something else. A draw or an abandoned game has none.
  let turningPoint: AnalysedMove | undefined;
  if (game.result.kind === "win" || game.result.kind === "timeout") {
    const winner = game.result.winnerSeat;
    if (winner !== undefined) {
      turningPoint = [...moves]
        .reverse()
        .find(
          (move) =>
            !sameSide(game, move.seat, winner) &&
            (move.missedWin !== undefined || move.missedBlock !== undefined)
        );
    }
  }

  return { moves, turningPoint, medianClockMs };
};

// Cell names players can say out loud: column letter + row number, with
// row 1 at the top, the way the board is read on screen.
export const cellName = (x: number, y: number): string =>
  `${String.fromCharCode(65 + y)}${x + 1}`;
