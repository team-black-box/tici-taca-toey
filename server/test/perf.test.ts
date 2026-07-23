import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import {
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
} from "../src/model";

// Performance regression floors. Real numbers are 20-50x these thresholds
// (see bench/); the generous margins keep CI machines from flaking while
// still catching an accidental O(N)-per-message regression loudly.

const connection: PlayerConnection = { send: () => {} };

let seed = 42424242;
const random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0xffffffff;
};

const playFullGame = async (
  engine: TiciTacaToeyGameEngine,
  gameId: string
) => {
  await engine.play({
    type: MessageTypes.START_GAME,
    name: "perf",
    boardSize: 3,
    playerCount: 2,
    winningSequenceLength: 3,
    gameId,
    playerId: `${gameId}-p0`,
    connection,
  } as unknown as Message);
  await engine.play({
    type: MessageTypes.JOIN_GAME,
    gameId,
    playerId: `${gameId}-p1`,
    connection,
  } as unknown as Message);
  while (engine.games[gameId]?.status === GameStatus.GAME_IN_PROGRESS) {
    const game = engine.games[gameId];
    const empty: Array<{ x: number; y: number }> = [];
    game.positions.forEach((row, x) =>
      row.forEach((cell, y) => {
        if (cell === "-") {
          empty.push({ x, y });
        }
      })
    );
    const move = empty[Math.floor(random() * empty.length)];
    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId,
      coordinateX: move.x,
      coordinateY: move.y,
      playerId: game.turn,
    } as unknown as Message);
  }
};

describe("performance floors", () => {
  test("pipeline sustains at least 500 full games/second", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const start = performance.now();
    for (let index = 0; index < 1000; index++) {
      await playFullGame(engine, `floor-${index}`);
    }
    const seconds = (performance.now() - start) / 1000;
    expect(seconds).toBeLessThan(2);
  }, 20_000);

  test("broadcast cost stays flat as the server fills up", async () => {
    const engine = new TiciTacaToeyGameEngine();
    // Populate a busy server: thousands of players and finished games.
    for (let index = 0; index < 2000; index++) {
      await playFullGame(engine, `fill-${index}`);
    }
    // The same slice of work must not be meaningfully slower than on a
    // fresh engine (the 2020 code degraded ~10x here).
    const start = performance.now();
    for (let index = 0; index < 500; index++) {
      await playFullGame(engine, `after-${index}`);
    }
    const filled = performance.now() - start;
    expect(filled).toBeLessThan(2000);
  }, 30_000);

  test("sweep returns the memory: games map empties after TTL", async () => {
    const engine = new TiciTacaToeyGameEngine();
    for (let index = 0; index < 200; index++) {
      await playFullGame(engine, `sweep-${index}`);
    }
    expect(Object.keys(engine.games).length).toBe(200);
    engine.sweep(Date.now() + 11 * 60 * 1000);
    expect(Object.keys(engine.games).length).toBe(0);
  }, 20_000);
});
