import { describe, expect, test } from "bun:test";
import { calculateWinner } from "../src/TiciTacaToeyGameEngine";
import { WinningSequence } from "../src/model";

const EMPTY = "-";

describe("calculateWinner: explicit cases", () => {
  test("horizontal win", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["x", "x", "x"],
        ["o", "-", "-"],
        ["o", "-", "-"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 0, y: 2 },
    });
    expect(result?.winner).toBe("x");
    expect(result?.winningSequence).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
  });

  test("vertical win", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["x", "o", "-"],
        ["x", "o", "-"],
        ["x", "-", "-"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 2, y: 0 },
    });
    expect(result?.winner).toBe("x");
    expect(result?.winningSequence).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  test("right diagonal win, last move at the end", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["x", "o", "x"],
        ["o", "x", "o"],
        ["o", "x", "x"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 2, y: 2 },
    });
    expect(result?.winner).toBe("x");
  });

  test("right diagonal win, last move at the start (regression: the original engine scanned this direction incorrectly)", () => {
    // The original calculateWinnerV2 decremented xPosRight twice while
    // scanning down-right, so a win completed from its top-left cell was
    // missed and the scan could even walk off the board.
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["x", "o", "o"],
        ["o", "x", "-"],
        ["o", "-", "x"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 0, y: 0 },
    });
    expect(result?.winner).toBe("x");
    expect(result?.winningSequence).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  test("right diagonal win, last move in the middle", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["x", "o", "o", "-"],
        ["o", "x", "-", "-"],
        ["o", "-", "x", "-"],
        ["-", "-", "-", "x"],
      ],
      winningSequenceLength: 4,
      lastTurnPosition: { x: 1, y: 1 },
    });
    expect(result?.winner).toBe("x");
    expect(result?.winningSequence?.length).toBe(4);
  });

  test("left diagonal win", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["o", "-", "x"],
        ["o", "x", "-"],
        ["x", "-", "-"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 0, y: 2 },
    });
    expect(result?.winner).toBe("x");
    expect(result?.winningSequence).toEqual([
      { x: 0, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  test("no winner", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["-", "o", "x"],
        ["o", "x", "-"],
        ["-", "x", "-"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 2, y: 1 },
    });
    expect(result).toBeNull();
  });

  test("winning sequence shorter than the run still wins (run longer than required)", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["x", "x", "x", "x"],
        ["o", "o", "o", "-"],
        ["-", "-", "-", "-"],
        ["-", "-", "-", "-"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 0, y: 1 },
    });
    expect(result?.winner).toBe("x");
    expect(result!.winningSequence.length).toBeGreaterThanOrEqual(3);
  });

  test("a broken line does not win", () => {
    const result = calculateWinner({
      lastTurnPlayerId: "x",
      positions: [
        ["x", "x", "-", "x"],
        ["-", "-", "-", "-"],
        ["-", "-", "-", "-"],
        ["-", "-", "-", "-"],
      ],
      winningSequenceLength: 3,
      lastTurnPosition: { x: 0, y: 3 },
    });
    expect(result).toBeNull();
  });

  test("corner cells never read outside the board", () => {
    for (const corner of [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]) {
      const positions = [
        ["-", "-", "-"],
        ["-", "-", "-"],
        ["-", "-", "-"],
      ];
      positions[corner.x][corner.y] = "x";
      const result = calculateWinner({
        lastTurnPlayerId: "x",
        positions,
        winningSequenceLength: 3,
        lastTurnPosition: corner,
      });
      expect(result).toBeNull();
    }
  });
});

// Reference implementation used as a fuzzing oracle: scan the whole board in
// every direction for any run of the required length belonging to the player.
const naiveHasWin = (
  positions: string[][],
  winningSequenceLength: number,
  playerId: string
): boolean => {
  const size = positions.length;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (const [dx, dy] of directions) {
        let count = 0;
        for (let step = 0; step < winningSequenceLength; step++) {
          const nx = x + dx * step;
          const ny = y + dy * step;
          if (
            nx < 0 ||
            nx >= size ||
            ny < 0 ||
            ny >= size ||
            positions[nx][ny] !== playerId
          ) {
            break;
          }
          count++;
        }
        if (count === winningSequenceLength) {
          return true;
        }
      }
    }
  }
  return false;
};

const isValidWinningSequence = (
  sequence: WinningSequence[],
  positions: string[][],
  playerId: string,
  winningSequenceLength: number,
  lastMove: WinningSequence
): boolean => {
  if (sequence.length < winningSequenceLength) {
    return false;
  }
  if (!sequence.some((cell) => cell.x === lastMove.x && cell.y === lastMove.y)) {
    return false;
  }
  if (!sequence.every((cell) => positions[cell.x][cell.y] === playerId)) {
    return false;
  }
  const dx = sequence[1].x - sequence[0].x;
  const dy = sequence[1].y - sequence[0].y;
  return sequence.every(
    (cell, index) =>
      index === 0 ||
      (cell.x - sequence[index - 1].x === dx &&
        cell.y - sequence[index - 1].y === dy)
  );
};

describe("calculateWinner: fuzz against a naive full-board oracle", () => {
  test("500 random games agree with the oracle on every move", () => {
    let seed = 20260610;
    const random = () => {
      // xorshift32: deterministic runs make failures reproducible
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0xffffffff;
    };
    const randomInt = (min: number, max: number) =>
      min + Math.floor(random() * (max - min + 1));

    for (let gameIndex = 0; gameIndex < 500; gameIndex++) {
      const size = randomInt(3, 12);
      const winningSequenceLength = randomInt(3, size);
      const playerCount = randomInt(2, Math.min(4, size - 1));
      const players = Array.from({ length: playerCount }, (_, i) => `p${i}`);
      const positions: string[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => EMPTY)
      );
      const emptyCells: WinningSequence[] = [];
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          emptyCells.push({ x, y });
        }
      }

      let turn = 0;
      while (emptyCells.length > 0) {
        const cellIndex = randomInt(0, emptyCells.length - 1);
        const move = emptyCells.splice(cellIndex, 1)[0];
        const player = players[turn % players.length];
        positions[move.x][move.y] = player;
        turn++;

        const fast = calculateWinner({
          positions,
          winningSequenceLength,
          lastTurnPlayerId: player,
          lastTurnPosition: move,
        });
        const oracle = naiveHasWin(positions, winningSequenceLength, player);

        if (Boolean(fast) !== oracle) {
          throw new Error(
            `Disagreement in game ${gameIndex}: size=${size} seq=${winningSequenceLength} move=(${move.x},${move.y}) player=${player} fast=${Boolean(
              fast
            )} oracle=${oracle}\n${positions.map((row) => row.join(" ")).join("\n")}`
          );
        }
        if (fast) {
          expect(
            isValidWinningSequence(
              fast.winningSequence,
              positions,
              player,
              winningSequenceLength,
              move
            )
          ).toBe(true);
          break; // game over
        }
      }
    }
  });
});
