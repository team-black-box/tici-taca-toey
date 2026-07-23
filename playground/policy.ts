// Shared policy representation for the learning playground.
//
// A policy is a lookup table from board states to cells. Two ideas make the
// table small and general:
//
// 1. Mover-relative encoding: the player to move is always "A", the next
//    seat in rotation "B", and so on. The same shape learned as X applies
//    when you are O.
// 2. Symmetry canonicalization: a square board has 8 symmetries (4 rotations
//    x 2 reflections). Every state is mapped to the lexicographically
//    smallest of its 8 transforms before lookup, so one entry covers all 8
//    orientations of a position.
//
// Both train.ts (writer) and learner.ts (player) go through this module, so
// the two sides can never disagree about the encoding.

export interface PolicyFile {
  generatedAt: string;
  boardSize: number;
  winningSequenceLength: number;
  playerCount: number;
  games: number;
  states: number;
  // canonical state key -> cell index (x * boardSize + y) in canonical frame
  entries: Record<string, number>;
}

export interface Move {
  x: number;
  y: number;
}

// -1 = empty, otherwise the absolute seat index occupying the cell.
export type SeatGrid = ReadonlyArray<ReadonlyArray<number>>;

type Transform = (x: number, y: number, n: number) => readonly [number, number];

const TRANSFORMS: ReadonlyArray<Transform> = [
  (x, y) => [x, y],
  (x, y, n) => [y, n - 1 - x], // rotate 90
  (x, y, n) => [n - 1 - x, n - 1 - y], // rotate 180
  (x, y, n) => [n - 1 - y, x], // rotate 270
  (x, y, n) => [n - 1 - x, y], // flip rows
  (x, y, n) => [x, n - 1 - y], // flip columns
  (x, y) => [y, x], // transpose
  (x, y, n) => [n - 1 - y, n - 1 - x], // anti-transpose
];

// TRANSFORMS[INVERSE[t]] undoes TRANSFORMS[t] (rot90 <-> rot270, the rest
// are their own inverse).
const INVERSE = [0, 3, 2, 1, 4, 5, 6, 7];

const EMPTY_CHAR = ".";
const seatChar = (seat: number, moverSeat: number, playerCount: number): string =>
  String.fromCharCode(
    65 + ((seat - moverSeat + playerCount) % playerCount)
  );

const keyUnderTransform = (
  seats: SeatGrid,
  moverSeat: number,
  playerCount: number,
  transform: number
): string => {
  const n = seats.length;
  const out: string[][] = Array.from({ length: n }, () =>
    Array(n).fill(EMPTY_CHAR)
  );
  seats.forEach((row, x) =>
    row.forEach((seat, y) => {
      if (seat >= 0) {
        const [tx, ty] = TRANSFORMS[transform](x, y, n);
        out[tx][ty] = seatChar(seat, moverSeat, playerCount);
      }
    })
  );
  return out.map((row) => row.join("")).join("");
};

export interface CanonicalState {
  key: string;
  transform: number;
}

// The lexicographically smallest of the 8 symmetric keys, plus which
// transform produced it (needed to map moves in and out of that frame).
export const canonicalize = (
  seats: SeatGrid,
  moverSeat: number,
  playerCount: number
): CanonicalState =>
  TRANSFORMS.reduce<CanonicalState>(
    (best, _, transform) => {
      const key = keyUnderTransform(seats, moverSeat, playerCount, transform);
      return best.key === "" || key < best.key ? { key, transform } : best;
    },
    { key: "", transform: 0 }
  );

// A real-frame move expressed as a cell index in the canonical frame.
export const cellInFrame = (
  transform: number,
  move: Move,
  boardSize: number
): number => {
  const [tx, ty] = TRANSFORMS[transform](move.x, move.y, boardSize);
  return tx * boardSize + ty;
};

// A canonical-frame cell index mapped back to a real-frame move.
export const moveFromFrame = (
  transform: number,
  cell: number,
  boardSize: number
): Move => {
  const [x, y] = TRANSFORMS[INVERSE[transform]](
    Math.floor(cell / boardSize),
    cell % boardSize,
    boardSize
  );
  return { x, y };
};

// Look the current state up in the policy. Returns null on a miss or if the
// stored cell is somehow occupied (a corrupt or mismatched policy must never
// produce an illegal move - the caller falls back to random).
export const pickMove = (
  policy: PolicyFile,
  seats: SeatGrid,
  moverSeat: number
): Move | null => {
  const { key, transform } = canonicalize(seats, moverSeat, policy.playerCount);
  const cell = policy.entries[key];
  if (cell === undefined) {
    return null;
  }
  const move = moveFromFrame(transform, cell, policy.boardSize);
  if (seats[move.x]?.[move.y] !== -1) {
    return null;
  }
  return move;
};
