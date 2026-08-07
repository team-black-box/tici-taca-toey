// One position a day, the same for everybody, solvable alone.
//
// Every other way to play needs someone else - an opponent, an open
// seat, a robot that happens to be free. That is a hard way to open an
// app for the first time, and a harder way to open it on a quiet
// Tuesday. This needs nobody: here is a board, there is exactly one
// move that wins it, find it.
//
// Generated rather than curated, and generated *deterministically from
// the date*, so two people can compare without a server having to hand
// out puzzles and without anyone storing a puzzle list. The same date
// gives the same board everywhere, forever.
//
// The guarantee this makes, and checks before returning: the position
// is legal, it is your turn, and there is **exactly one** winning move.
// A puzzle with two answers is not a puzzle, and one with none is a
// bug people would rightly report.
import { countSequences, ownerOfSeat } from "./rules";

const EMPTY = "-";
// Seat 0 is always the solver, so "you are X" needs no explaining.
const SOLVER = 0;
const OPPONENT = 1;

export interface DailyPuzzle {
  // YYYY-MM-DD in UTC - the day everyone shares.
  day: string;
  boardSize: number;
  winningSequenceLength: number;
  positions: string[][];
  solution: { x: number; y: number };
  // How many marks are already down, which is a fair difficulty proxy.
  moveCount: number;
}

// A small deterministic PRNG. Not cryptography - the point is that
// every device derives the identical board from the identical date, and
// Math.random cannot promise that.
const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
};

const seedFor = (day: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < day.length; index++) {
    hash ^= day.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const dayKey = (when: Date = new Date()): string =>
  when.toISOString().slice(0, 10);

const winsWith = (
  positions: string[][],
  winLen: number,
  seat: number,
  x: number,
  y: number
): boolean => {
  const previous = positions[x][y];
  positions[x][y] = String(seat);
  const players = ["0", "1"];
  const { count } = countSequences(
    positions,
    winLen,
    ownerOfSeat(players, seat, 0)
  );
  positions[x][y] = previous;
  return count >= 1;
};

const winningMoves = (
  positions: string[][],
  winLen: number,
  seat: number
): Array<{ x: number; y: number }> => {
  const found: Array<{ x: number; y: number }> = [];
  positions.forEach((row, x) =>
    row.forEach((value, y) => {
      if (value === EMPTY && winsWith(positions, winLen, seat, x, y)) {
        found.push({ x, y });
      }
    })
  );
  return found;
};

// Build a candidate by playing random legal moves, then keep it only if
// it lands in exactly the shape we promised. Rejection sampling is the
// honest way here: it is far easier to check "exactly one winning move"
// than to construct one directly, and the boards are tiny.
const buildCandidate = (
  random: () => number,
  boardSize: number,
  winLen: number,
  plies: number
): DailyPuzzle["positions"] | null => {
  const positions = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => EMPTY)
  );
  for (let ply = 0; ply < plies; ply++) {
    const seat = ply % 2 === 0 ? SOLVER : OPPONENT;
    const open: Array<{ x: number; y: number }> = [];
    positions.forEach((row, x) =>
      row.forEach((value, y) => {
        if (value === EMPTY) {
          open.push({ x, y });
        }
      })
    );
    if (open.length === 0) {
      return null;
    }
    // Never let the game actually finish while dealing it out - the
    // puzzle is the position *before* the win.
    const quiet = open.filter(
      (cell) => !winsWith(positions, winLen, seat, cell.x, cell.y)
    );
    if (quiet.length === 0) {
      return null;
    }
    const pick = quiet[Math.floor(random() * quiet.length)];
    positions[pick.x][pick.y] = String(seat);
  }
  return positions;
};

// The puzzle for a given day. Deterministic: same day in, same puzzle
// out, on every device and every platform.
export const dailyPuzzle = (day: string = dayKey()): DailyPuzzle => {
  const random = seededRandom(seedFor(day));
  const boardSize = 4;
  const winLen = 3;

  // Try increasingly full boards until one has a unique answer. The
  // loop is bounded and, because the generator is seeded, always ends
  // at the same place for the same day.
  for (let attempt = 0; attempt < 500; attempt++) {
    // An even number of plies leaves it as the solver's turn.
    const plies = 4 + 2 * (attempt % 4);
    const positions = buildCandidate(random, boardSize, winLen, plies);
    if (!positions) {
      continue;
    }
    const mine = winningMoves(positions, winLen, SOLVER);
    if (mine.length !== 1) {
      continue;
    }
    return {
      day,
      boardSize,
      winningSequenceLength: winLen,
      positions,
      solution: mine[0],
      moveCount: plies,
    };
  }

  // Unreachable in practice on a 4x4 - but a puzzle that throws on some
  // future date would be a genuinely terrible way to find that out, so
  // fall back to a hand-built position that satisfies the contract.
  const positions = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => EMPTY)
  );
  positions[0][0] = "0";
  positions[0][1] = "0";
  positions[1][0] = "1";
  positions[1][1] = "1";
  return {
    day,
    boardSize,
    winningSequenceLength: winLen,
    positions,
    solution: { x: 0, y: 2 },
    moveCount: 4,
  };
};

// The shareable result, in the house voice. No board layout, no
// solution - a spoiler-free brag, which is the only kind worth sending.
export const shareDaily = (
  puzzle: DailyPuzzle,
  solved: boolean,
  guesses: number
): string =>
  [
    `tici-taca-toey daily ${puzzle.day}`,
    solved
      ? `found it in ${guesses} ${guesses === 1 ? "try" : "tries"}`
      : "did not find it",
    "https://ticitacatoey.com/daily",
  ].join("\n");
