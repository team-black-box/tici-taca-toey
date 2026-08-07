import { describe, expect, test } from "bun:test";
import { dailyPuzzle, dayKey, shareDaily } from "../../shared/daily";
import { countSequences, ownerOfSeat } from "../../shared/rules";
import { cellName } from "../../shared/analysis";

const EMPTY = "-";

const wins = (
  positions: string[][],
  winLen: number,
  seat: number,
  x: number,
  y: number
): boolean => {
  const copy = positions.map((row) => [...row]);
  copy[x][y] = String(seat);
  return (
    countSequences(copy, winLen, ownerOfSeat(["0", "1"], seat, 0)).count >= 1
  );
};

// A year of dates, so this is a property test rather than a spot check.
const YEAR = Array.from({ length: 365 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 0, 1));
  date.setUTCDate(date.getUTCDate() + index);
  return dayKey(date);
});

describe("daily puzzle", () => {
  test("the same day gives the same puzzle, every time", () => {
    const a = dailyPuzzle("2026-08-07");
    const b = dailyPuzzle("2026-08-07");
    expect(a).toEqual(b);
  });

  test("different days give different puzzles", () => {
    const boards = new Set(
      YEAR.slice(0, 60).map((day) =>
        JSON.stringify(dailyPuzzle(day).positions)
      )
    );
    // Not necessarily 60 distinct - collisions are fine - but a
    // generator stuck on one board would be a bug worth catching.
    expect(boards.size).toBeGreaterThan(30);
  });

  test("every day of a year has exactly one winning move", () => {
    YEAR.forEach((day) => {
      const puzzle = dailyPuzzle(day);
      const solutions: Array<{ x: number; y: number }> = [];
      puzzle.positions.forEach((row, x) =>
        row.forEach((value, y) => {
          if (
            value === EMPTY &&
            wins(puzzle.positions, puzzle.winningSequenceLength, 0, x, y)
          ) {
            solutions.push({ x, y });
          }
        })
      );
      expect(solutions).toHaveLength(1);
      expect(solutions[0]).toEqual(puzzle.solution);
    });
  });

  test("the position is legal: seats alternate and nobody has already won", () => {
    YEAR.slice(0, 120).forEach((day) => {
      const puzzle = dailyPuzzle(day);
      const flat = puzzle.positions.flat();
      const mine = flat.filter((value) => value === "0").length;
      const theirs = flat.filter((value) => value === "1").length;
      // Solver moves first and it is the solver's turn, so the counts
      // are equal.
      expect(mine).toBe(theirs);
      // And the game is not already over for either side.
      [0, 1].forEach((seat) => {
        const { count } = countSequences(
          puzzle.positions,
          puzzle.winningSequenceLength,
          ownerOfSeat(["0", "1"], seat, 0)
        );
        expect(count).toBe(0);
      });
    });
  });

  test("the solution cell is empty in the puzzle", () => {
    YEAR.slice(0, 120).forEach((day) => {
      const puzzle = dailyPuzzle(day);
      expect(puzzle.positions[puzzle.solution.x][puzzle.solution.y]).toBe(
        EMPTY
      );
    });
  });

  test("dayKey is UTC, so the day flips at the same instant everywhere", () => {
    expect(dayKey(new Date("2026-08-07T23:59:59Z"))).toBe("2026-08-07");
    expect(dayKey(new Date("2026-08-08T00:00:01Z"))).toBe("2026-08-08");
  });

  test("the shared result never leaks the answer", () => {
    const puzzle = dailyPuzzle("2026-08-07");
    const text = shareDaily(puzzle, true, 1);
    expect(text).toContain("2026-08-07");
    expect(text).toContain("1 try");
    // Naming the square would spoil it for whoever you sent this to,
    // and so would pasting the board.
    expect(text).not.toContain(cellName(puzzle.solution.x, puzzle.solution.y));
    // Three lines: what it is, how you did, where to play. Nothing that
    // could be a board row. (The date has hyphens of its own, so this
    // checks shape rather than hunting for board characters.)
    expect(text.split("\n")).toHaveLength(3);
    expect(
      text.split("\n").every((line) => !/^[-01\s]{4,}$/.test(line))
    ).toBe(true);
  });

  test("plural reads correctly", () => {
    const puzzle = dailyPuzzle("2026-08-07");
    expect(shareDaily(puzzle, true, 2)).toContain("2 tries");
    expect(shareDaily(puzzle, false, 3)).toContain("did not find it");
  });
});
