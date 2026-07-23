// Win rules shared by the engine and every client. One implementation so
// the server's verdict, the web's progress display, and the mobile app's
// can never disagree.
//
// The classic game is the special case: one sequence, no teams. The 2026-07
// variants generalize it:
//
// - **Multiple sequences**: a game can require N sequences of length L
//   (winningSequenceCount). Within one direction, a maximal run of length R
//   counts as floor(R / L) sequences - so with L=2, four-in-a-row is two
//   sequences, and overlapping windows never double-count. Runs in
//   *different* directions each count on their own, so sequences may cross
//   like crossword answers sharing a letter.
// - **Teams**: the team of a seat is `seat % teamCount`, which makes the
//   existing seat rotation interleave teams with no turn-order changes at
//   all. Sequences may combine marks from any member of the team.

import { WinningSequence } from "./model";

const EMPTY = "-";

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // right diagonal
  [1, -1], // left diagonal
];

export const teamOfSeat = (seat: number, teamCount: number): number =>
  teamCount > 0 ? seat % teamCount : seat;

export interface SequenceScan {
  // Completed sequences: sum over directions of floor(run / winLen).
  count: number;
  // Every cell in every run long enough to contain a sequence - the
  // highlight set for clients.
  cells: WinningSequence[];
}

// Count the sequences owned by the cells `isOwner` accepts. O(4 * N^2) -
// at the 12x12 maximum that is ~576 cells per direction, trivial per move.
export const countSequences = (
  positions: string[][],
  winningSequenceLength: number,
  isOwner: (value: string) => boolean
): SequenceScan => {
  const size = positions.length;
  const owned = (x: number, y: number): boolean =>
    x >= 0 &&
    x < size &&
    y >= 0 &&
    y < size &&
    positions[x][y] !== EMPTY &&
    isOwner(positions[x][y]);
  let count = 0;
  const cells: WinningSequence[] = [];
  for (const [dx, dy] of DIRECTIONS) {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        // Only measure from the first cell of a maximal run.
        if (!owned(x, y) || owned(x - dx, y - dy)) {
          continue;
        }
        let run = 0;
        let cx = x;
        let cy = y;
        while (owned(cx, cy)) {
          run++;
          cx += dx;
          cy += dy;
        }
        if (run >= winningSequenceLength) {
          count += Math.floor(run / winningSequenceLength);
          for (let step = 0; step < run; step++) {
            cells.push({ x: x + dx * step, y: y + dy * step });
          }
        }
      }
    }
  }
  return { count, cells };
};

// Build the owner test for a seat: the seat's own marks, or - in a team
// game - the marks of every teammate. `players` maps cell values to seats
// (playerIds in live games, "0".."9" in decoded TTN replays).
export const ownerOfSeat = (
  players: string[],
  seat: number,
  teamCount: number
): ((value: string) => boolean) => {
  if (teamCount <= 0) {
    const me = players[seat];
    return (value) => value === me;
  }
  const team = teamOfSeat(seat, teamCount);
  return (value) => teamOfSeat(players.indexOf(value), teamCount) === team;
};

// Sequence progress for every side of a game: one count per team when
// teamed, else one per seat. Clients render this next to the players.
export const sequenceCounts = (
  positions: string[][],
  players: string[],
  winningSequenceLength: number,
  teamCount: number
): number[] => {
  const sides = teamCount > 0 ? teamCount : players.length;
  return Array.from(
    { length: sides },
    (_, side) =>
      countSequences(
        positions,
        winningSequenceLength,
        ownerOfSeat(players, side, teamCount)
      ).count
  );
};
