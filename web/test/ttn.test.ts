import { describe, expect, test } from "bun:test";
import { boardAtFrame, decodeTtn } from "../src/common/ttn";

describe("ttn decoder (web port)", () => {
  test("decodes the canonical vector", () => {
    const game = decodeTtn("1.3.3.2.u.0003010402.w0");
    expect(game.boardSize).toBe(3);
    expect(game.result).toEqual({ kind: "win", winnerSeat: 0 });
    expect(game.moves.length).toBe(5);
    expect(boardAtFrame(game, 5)).toEqual([
      ["0", "0", "0"],
      ["1", "1", "-"],
      ["-", "-", "-"],
    ]);
    expect(boardAtFrame(game, 1)).toEqual([
      ["0", "-", "-"],
      ["-", "-", "-"],
      ["-", "-", "-"],
    ]);
  });

  test("skips consume seats", () => {
    const game = decodeTtn("1.4.3.3.u.00--050a.a");
    expect(game.moves.map((move) => move.seat)).toEqual([0, 1, 2, 0]);
    expect(game.moves[1].skip).toBe(true);
  });

  test("v2 decodes the clock track", () => {
    const t = (60000).toString(36);
    const i = (1000).toString(36);
    const game = decodeTtn(`2.3.3.2.t${t}+${i}.0004.a.00d005`);
    expect(game.version).toBe(2);
    expect(game.timed).toBe(true);
    expect(game.timePerPlayer).toBe(60000);
    expect(game.moves.map((move) => move.clockMs)).toEqual([1300, 500]);
  });

  test("v2 skip tokens carry zero clock", () => {
    const t = (60000).toString(36);
    const game = decodeTtn(`2.4.3.3.t${t}+0.00--05.a.00d000005`);
    expect(game.moves[1].skip).toBe(true);
    expect(game.moves[1].clockMs).toBe(0);
    expect(game.moves[2].clockMs).toBe(500);
  });

  test("rejects malformed lines", () => {
    for (const line of [
      "",
      "3.3.3.2.u..d",
      "1.3.3.2.u.0.d",
      "1.3.3.2.u.0000.d",
      "1.3.3.2.u..w5",
      "2.3.3.2.u.0004.a.00d005", // v2 must be timed
      `2.3.3.2.t${(60000).toString(36)}+0.0004.a.00d`, // short clock track
    ]) {
      expect(() => decodeTtn(line)).toThrow();
    }
  });
});
