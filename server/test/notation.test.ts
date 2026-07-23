import { describe, expect, test } from "bun:test";
import { decodeGame, encodeCell, encodeGame } from "../src/notation";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import {
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
} from "../src/model";

class FakeConnection implements PlayerConnection {
  messages: any[] = [];
  send(data: string) {
    this.messages.push(JSON.parse(data));
  }
  last() {
    return this.messages[this.messages.length - 1];
  }
}

describe("TTN known vectors", () => {
  test("3x3 top-row win encodes to the documented example", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = new FakeConnection();
    const bob = new FakeConnection();
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "g",
      boardSize: 3,
      playerCount: 2,
      winningSequenceLength: 3,
      gameId: "g1",
      playerId: "alice",
      connection: alice,
    } as Message);
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "g1",
      playerId: "bob",
      connection: bob,
    } as Message);
    const moves: Array<[string, number, number]> = [
      ["alice", 0, 0],
      ["bob", 1, 0],
      ["alice", 0, 1],
      ["bob", 1, 1],
      ["alice", 0, 2],
    ];
    for (const [playerId, x, y] of moves) {
      await engine.play({
        type: MessageTypes.MAKE_MOVE,
        gameId: "g1",
        coordinateX: x,
        coordinateY: y,
        playerId,
      } as Message);
    }
    expect(engine.games["g1"].notation).toBe("1.3.3.2.u.0003010402.w0");
    expect(alice.last().game.notation).toBe("1.3.3.2.u.0003010402.w0");
  });

  test("cell encoding is fixed-width base36", () => {
    expect(encodeCell(0, 0, 12)).toBe("00");
    expect(encodeCell(11, 11, 12)).toBe("3z");
    expect(encodeCell(1, 2, 5)).toBe("07");
  });

  test("decode rebuilds the board and result", () => {
    const decoded = decodeGame("1.3.3.2.u.0003010402.w0");
    expect(decoded.boardSize).toBe(3);
    expect(decoded.playerCount).toBe(2);
    expect(decoded.timed).toBe(false);
    expect(decoded.result).toEqual({ kind: "win", winnerSeat: 0 });
    expect(decoded.positions).toEqual([
      ["0", "0", "0"],
      ["1", "1", "-"],
      ["-", "-", "-"],
    ]);
    expect(decoded.moves.length).toBe(5);
    expect(decoded.moves[0]).toEqual({ seat: 0, x: 0, y: 0, skip: false, clockMs: 0 });
  });

  test("timed games round-trip the clock configuration", () => {
    const decoded = decodeGame(
      `1.5.4.2.t${(60000).toString(36)}+${(1000).toString(36)}..a`
    );
    expect(decoded.timed).toBe(true);
    expect(decoded.timePerPlayer).toBe(60000);
    expect(decoded.incrementPerPlayer).toBe(1000);
  });

  test("skip tokens consume a rotation seat", () => {
    // 3 players on 4x4: seat0 plays (0,0), seat1 skipped, seat2 plays (1,1),
    // seat0 plays (2,2)
    const decoded = decodeGame("1.4.3.3.u.00--050a.a");
    expect(decoded.moves.map((move) => move.seat)).toEqual([0, 1, 2, 0]);
    expect(decoded.moves[1].skip).toBe(true);
    expect(decoded.positions[0][0]).toBe("0");
    expect(decoded.positions[1][1]).toBe("2");
    expect(decoded.positions[2][2]).toBe("0");
  });

  test("v2 decodes the clock track", () => {
    const t = (60000).toString(36);
    const i = (1000).toString(36);
    const decoded = decodeGame(`2.3.3.2.t${t}+${i}.0004.a.00d005`);
    expect(decoded.version).toBe(2);
    expect(decoded.timed).toBe(true);
    expect(decoded.moves.map((m) => m.clockMs)).toEqual([1300, 500]);
  });

  test("v2 skip tokens carry zero clock", () => {
    const t = (60000).toString(36);
    const decoded = decodeGame(`2.4.3.3.t${t}+0.00--05.a.00d000005`);
    expect(decoded.moves[1].skip).toBe(true);
    expect(decoded.moves[1].clockMs).toBe(0);
    expect(decoded.moves[2].clockMs).toBe(500);
  });

  test("v2 rejects mismatched clock tracks and untimed configs", () => {
    const t = (60000).toString(36);
    expect(() => decodeGame(`2.3.3.2.t${t}+0.0004.a.00d`)).toThrow();
    expect(() => decodeGame(`2.3.3.2.u.0004.a.00d005`)).toThrow();
  });

  test("a timed engine game emits a valid v2 line", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = new FakeConnection();
    const bob = new FakeConnection();
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "timed",
      boardSize: 3,
      playerCount: 2,
      winningSequenceLength: 3,
      timePerPlayer: 60000,
      incrementPerPlayer: 0,
      gameId: "t1",
      playerId: "alice",
      connection: alice,
    } as Message);
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "t1",
      playerId: "bob",
      connection: bob,
    } as Message);
    for (const [playerId, x, y] of [
      ["alice", 0, 0],
      ["bob", 1, 0],
      ["alice", 0, 1],
      ["bob", 1, 1],
      ["alice", 0, 2],
    ] as const) {
      await engine.play({
        type: MessageTypes.MAKE_MOVE,
        gameId: "t1",
        coordinateX: x,
        coordinateY: y,
        playerId,
      } as Message);
    }
    const notation = engine.games["t1"].notation as string;
    expect(notation.startsWith("2.")).toBe(true);
    const decoded = decodeGame(notation);
    expect(decoded.version).toBe(2);
    expect(decoded.moves.length).toBe(5);
    decoded.moves.forEach((m) => expect(m.clockMs).toBeLessThan(5000));
    expect(decoded.result).toEqual({ kind: "win", winnerSeat: 0 });
  });

  test("malformed lines are rejected", () => {
    const badLines = [
      "",
      "2.3.3.2.u..d", // bad version
      "1.13.3.2.u..d", // board too large
      "1.3.4.2.u..d", // winLen > board
      "1.3.3.2.x..d", // bad time
      "1.3.3.2.u.0.d", // unaligned moves
      "1.3.3.2.u.0000.d", // cell played twice
      "1.3.3.2.u.zz.d", // cell outside board
      "1.3.3.2.u..q0", // bad result
      "1.3.3.2.u..w5", // winner seat outside player count
    ];
    for (const line of badLines) {
      expect(() => decodeGame(line)).toThrow();
    }
  });
});

describe("TTN round-trip fuzz", () => {
  test("200 random engine games encode and decode losslessly", async () => {
    let seed = 987654321;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0xffffffff;
    };
    const randomInt = (min: number, max: number) =>
      min + Math.floor(random() * (max - min + 1));

    for (let gameIndex = 0; gameIndex < 200; gameIndex++) {
      const engine = new TiciTacaToeyGameEngine();
      const boardSize = randomInt(3, 8);
      const playerCount = randomInt(2, Math.min(4, boardSize - 1));
      const winningSequenceLength = randomInt(2, boardSize);
      const gameId = `fuzz-${gameIndex}`;
      const players = Array.from(
        { length: playerCount },
        (_, seat) => `p${seat}`
      );
      const connections = players.map(() => new FakeConnection());

      await engine.play({
        type: MessageTypes.START_GAME,
        name: "fuzz",
        boardSize,
        playerCount,
        winningSequenceLength,
        gameId,
        playerId: players[0],
        connection: connections[0],
      } as Message);
      for (let seat = 1; seat < playerCount; seat++) {
        await engine.play({
          type: MessageTypes.JOIN_GAME,
          gameId,
          playerId: players[seat],
          connection: connections[seat],
        } as Message);
      }

      const playedMoves: Array<{ seat: number; x: number; y: number }> = [];
      while (engine.games[gameId].status === GameStatus.GAME_IN_PROGRESS) {
        const game = engine.games[gameId];
        const empty: Array<{ x: number; y: number }> = [];
        game.positions.forEach((row, x) =>
          row.forEach((cell, y) => {
            if (cell === "-") {
              empty.push({ x, y });
            }
          })
        );
        const move = empty[randomInt(0, empty.length - 1)];
        const seat = game.players.indexOf(game.turn);
        playedMoves.push({ seat, ...move });
        await engine.play({
          type: MessageTypes.MAKE_MOVE,
          gameId,
          coordinateX: move.x,
          coordinateY: move.y,
          playerId: game.turn,
        } as Message);
      }

      const game = engine.games[gameId];
      expect(game.notation).toBeDefined();
      const decoded = decodeGame(game.notation as string);

      expect(decoded.boardSize).toBe(boardSize);
      expect(decoded.winningSequenceLength).toBe(winningSequenceLength);
      expect(decoded.playerCount).toBe(playerCount);
      expect(decoded.moves.map(({ seat, x, y }) => ({ seat, x, y }))).toEqual(
        playedMoves
      );
      // final board matches, with seats mapped to player ids
      decoded.positions.forEach((row, x) =>
        row.forEach((cell, y) => {
          const expected =
            cell === "-" ? "-" : game.players[Number(cell)];
          expect(game.positions[x][y]).toBe(expected);
        })
      );
      if (game.status === GameStatus.GAME_WON) {
        expect(decoded.result).toEqual({
          kind: "win",
          winnerSeat: game.players.indexOf(game.winner),
        });
      } else {
        expect(game.status).toBe(GameStatus.GAME_ENDS_IN_A_DRAW);
        expect(decoded.result).toEqual({ kind: "draw" });
      }
      // re-encoding the decoded structure reproduces the line
      expect(encodeGame(game)).toBe(game.notation as string);
    }
  });
});
