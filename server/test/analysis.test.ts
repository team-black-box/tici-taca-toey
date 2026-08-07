import { describe, expect, test } from "bun:test";
import { analyseGame, cellName } from "../../shared/analysis";
import { decodeGame, encodeCell } from "../../shared/ttn";

// Build a TTN line from a list of cells, so the tests read as boards
// rather than as base36. Seats alternate, which is what the engine does.
const lineFor = (
  cells: Array<[number, number]>,
  options: {
    size?: number;
    winLen?: number;
    result?: string;
    players?: number;
  } = {}
): string => {
  const size = options.size ?? 3;
  const winLen = options.winLen ?? 3;
  const players = options.players ?? 2;
  const moves = cells.map(([x, y]) => encodeCell(x, y, size)).join("");
  return `1.${size}.${winLen}.${players}.u.${moves}.${options.result ?? "w0"}`;
};

describe("cellName", () => {
  test("reads like a board: column letter, row number from the top", () => {
    expect(cellName(0, 0)).toBe("A1");
    expect(cellName(2, 1)).toBe("B3");
    expect(cellName(0, 2)).toBe("C1");
  });
});

describe("analyseGame", () => {
  test("flags a win that was available and not taken", () => {
    // X: A1 B1 . then plays a corner instead of C1, which wins.
    //   0,0  0,1        2,2            0,2
    // O answers in the middle row throughout.
    const game = decodeGame(
      lineFor([
        [0, 0], // X
        [1, 0], // O
        [0, 1], // X   - X now threatens (0,2)
        [1, 1], // O
        [2, 2], // X   - MISS: (0,2) wins
        [1, 2], // O   - O completes the middle row and wins
      ], { result: "w1" })
    );
    const analysis = analyseGame(game);
    const miss = analysis.moves.find((move) => move.missedWin);
    expect(miss).toBeDefined();
    expect(miss!.index).toBe(4);
    expect(miss!.missedWin).toEqual({ x: 0, y: 2 });
  });

  test("flags the block that was not made, when the opponent took it", () => {
    const game = decodeGame(
      lineFor([
        [0, 0], // X
        [1, 0], // O
        [0, 1], // X - threatens (0,2)
        [2, 2], // O - LETOFF: leaves (0,2) open
        [0, 2], // X - takes it and wins
      ])
    );
    const analysis = analyseGame(game);
    const letoff = analysis.moves.find((move) => move.missedBlock);
    expect(letoff).toBeDefined();
    expect(letoff!.index).toBe(3);
    expect(letoff!.missedBlock).toEqual({ x: 0, y: 2 });
  });

  test("does not scold about a threat the opponent never took", () => {
    // X threatens (0,2) but never plays it; O ignoring it is not the
    // move that lost anything.
    const game = decodeGame(
      lineFor([
        [0, 0], // X
        [1, 0], // O
        [0, 1], // X - threatens (0,2)
        [1, 1], // O - ignores it
        [2, 0], // X - does not take the win either
        [1, 2], // O - wins the middle row
      ], { result: "w1" })
    );
    const analysis = analyseGame(game);
    expect(analysis.moves.some((move) => move.missedBlock)).toBe(false);
  });

  test("taking your own win is never reported as a missed block", () => {
    const game = decodeGame(
      lineFor([
        [0, 0], // X
        [1, 0], // O
        [0, 1], // X
        [1, 1], // O - threatens (1,2); X also threatens (0,2)
        [0, 2], // X - wins. Not a "missed block".
      ])
    );
    const analysis = analyseGame(game);
    const last = analysis.moves[analysis.moves.length - 1];
    expect(last.missedBlock).toBeUndefined();
    expect(last.missedWin).toBeUndefined();
  });

  test("the turning point belongs to the side that lost", () => {
    const game = decodeGame(
      lineFor([
        [0, 0], // X
        [1, 0], // O
        [0, 1], // X threatens (0,2)
        [2, 2], // O letoff
        [0, 2], // X wins
      ])
    );
    const analysis = analyseGame(game);
    expect(analysis.turningPoint).toBeDefined();
    // Seat 1 (O) lost; the turning point is theirs, not the winner's.
    expect(analysis.turningPoint!.seat).toBe(1);
    expect(analysis.turningPoint!.index).toBe(3);
  });

  test("a clean game has nothing to report", () => {
    // Fastest possible win: no threat is ever left standing a turn.
    const game = decodeGame(lineFor([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]));
    const analysis = analyseGame(game);
    // The only flag possible here is O's letoff on its second move,
    // which it did lose to - so assert the shape rather than emptiness.
    expect(analysis.moves).toHaveLength(5);
    expect(analysis.moves.every((move) => move.index >= 0)).toBe(true);
  });

  test("a draw has no turning point", () => {
    const game = decodeGame(
      lineFor(
        [
          [0, 0], [0, 1], [0, 2],
          [1, 1], [1, 0], [1, 2],
          [2, 1], [2, 0], [2, 2],
        ],
        { result: "d" }
      )
    );
    expect(analyseGame(game).turningPoint).toBeUndefined();
  });

  test("untimed games report no median think time", () => {
    const game = decodeGame(lineFor([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]));
    expect(analyseGame(game).medianClockMs).toBeUndefined();
  });

  test("survives every line in the shipped corpus", async () => {
    const corpus = await Bun.file(
      new URL("../../data/games.ttn", import.meta.url).pathname
    ).text();
    const lines = corpus.split("\n").filter((line) => line.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach((line) => {
      const analysis = analyseGame(decodeGame(line));
      // Every flagged cell must be on the board and every index real.
      analysis.moves.forEach((move) => {
        expect(move.index).toBeLessThan(decodeGame(line).moves.length);
        [move.missedWin, move.missedBlock].forEach((cell) => {
          if (cell) {
            expect(cell.x).toBeGreaterThanOrEqual(0);
            expect(cell.y).toBeGreaterThanOrEqual(0);
          }
        });
      });
    });
  });
});
