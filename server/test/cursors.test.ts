import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import {
  CURSOR_OFF_BOARD,
  CursorTuple,
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
  cursors(): CursorTuple[][] {
    return this.messages
      .filter((each) => each.type === MessageTypes.CURSORS)
      .map((each) => each.cursors);
  }
  lastCursors(): CursorTuple[] | undefined {
    const all = this.cursors();
    return all[all.length - 1];
  }
  clear() {
    this.messages = [];
  }
}

// A two-player game in progress, plus a spectator watching it.
const twoPlayerGame = async (options: { showCursors?: boolean } = {}) => {
  const engine = new TiciTacaToeyGameEngine();
  const alice = new FakeConnection();
  const bob = new FakeConnection();
  const watcher = new FakeConnection();
  await engine.play({
    type: MessageTypes.START_GAME,
    name: "Cursors",
    boardSize: 3,
    playerCount: 2,
    gameId: "g1",
    playerId: "alice",
    connection: alice,
    showCursors: options.showCursors,
  } as Message);
  await engine.play({
    type: MessageTypes.JOIN_GAME,
    gameId: "g1",
    playerId: "bob",
    connection: bob,
  } as Message);
  // Spectators are ordinary registered players first - broadcasts reach
  // them through the players store, so an unregistered one gets nothing.
  await engine.play({
    type: MessageTypes.REGISTER_PLAYER,
    name: "Watcher",
    playerId: "watcher",
    connection: watcher,
  } as Message);
  await engine.play({
    type: MessageTypes.SPECTATE_GAME,
    gameId: "g1",
    playerId: "watcher",
    connection: watcher,
  } as Message);
  expect(engine.games["g1"].status).toBe(GameStatus.GAME_IN_PROGRESS);
  [alice, bob, watcher].forEach((each) => each.clear());
  return { engine, alice, bob, watcher };
};

const hover = (
  engine: TiciTacaToeyGameEngine,
  playerId: string,
  x: number,
  y: number,
  gameId = "g1"
) =>
  engine.play({
    type: MessageTypes.CURSOR,
    gameId,
    playerId,
    coordinateX: x,
    coordinateY: y,
  } as Message);

describe("cursor presence", () => {
  test("spectators always see every cursor, even when the game keeps them private", async () => {
    const { engine, watcher } = await twoPlayerGame();
    await hover(engine, "alice", 1, 2);
    engine.flushCursors();
    expect(watcher.lastCursors()).toEqual([[0, 1, 2]]);
  });

  test("opponents see nothing in a teamless game unless showCursors is on", async () => {
    const { engine, bob } = await twoPlayerGame();
    await hover(engine, "alice", 1, 2);
    engine.flushCursors();
    expect(bob.cursors()).toHaveLength(0);
  });

  test("showCursors sends every cursor to the players too", async () => {
    const { engine, alice, bob } = await twoPlayerGame({ showCursors: true });
    await hover(engine, "alice", 1, 2);
    engine.flushCursors();
    expect(bob.lastCursors()).toEqual([[0, 1, 2]]);
    // The payload is one broadcast for the whole audience, so a player sees
    // their own seat in it too and skips it when drawing.
    expect(alice.lastCursors()).toEqual([[0, 1, 2]]);
  });

  test("teammates see each other, opponents do not", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const connections = [0, 1, 2, 3].map(() => new FakeConnection());
    const ids = ["a", "b", "c", "d"];
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "Teams",
      boardSize: 5,
      playerCount: 4,
      teamCount: 2,
      gameId: "t1",
      playerId: ids[0],
      connection: connections[0],
    } as Message);
    for (let seat = 1; seat < 4; seat++) {
      await engine.play({
        type: MessageTypes.JOIN_GAME,
        gameId: "t1",
        playerId: ids[seat],
        connection: connections[seat],
      } as Message);
    }
    expect(engine.games["t1"].status).toBe(GameStatus.GAME_IN_PROGRESS);
    connections.forEach((each) => each.clear());

    // Seats 0 and 2 are team 0; seats 1 and 3 are team 1.
    await hover(engine, "a", 0, 0, "t1");
    await hover(engine, "b", 4, 4, "t1");
    engine.flushCursors();

    // c (seat 2, team 0) sees only its own team's cursors - seat 0.
    expect(connections[2].lastCursors()).toEqual([[0, 0, 0]]);
    // d (seat 3, team 1) sees only seat 1.
    expect(connections[3].lastCursors()).toEqual([[1, 4, 4]]);
  });

  test("cursors are coalesced: many moves, one broadcast", async () => {
    const { engine, watcher } = await twoPlayerGame();
    await hover(engine, "alice", 0, 0);
    await hover(engine, "alice", 0, 1);
    await hover(engine, "alice", 0, 2);
    engine.flushCursors();
    expect(watcher.cursors()).toHaveLength(1);
    expect(watcher.lastCursors()).toEqual([[0, 0, 2]]);
  });

  test("an unchanged cursor does not generate a broadcast", async () => {
    const { engine, watcher } = await twoPlayerGame();
    await hover(engine, "alice", 1, 1);
    engine.flushCursors();
    watcher.clear();
    await hover(engine, "alice", 1, 1);
    engine.flushCursors();
    expect(watcher.cursors()).toHaveLength(0);
  });

  test("leaving the board withdraws the cursor, then goes quiet", async () => {
    const { engine, watcher } = await twoPlayerGame();
    await hover(engine, "alice", 1, 1);
    engine.flushCursors();
    watcher.clear();

    await hover(engine, "alice", CURSOR_OFF_BOARD, CURSOR_OFF_BOARD);
    engine.flushCursors();
    expect(watcher.lastCursors()).toEqual([]);

    // Withdrawing again is a no-op - an idle pointer must not keep the
    // flush busy forever.
    watcher.clear();
    await hover(engine, "alice", CURSOR_OFF_BOARD, CURSOR_OFF_BOARD);
    engine.flushCursors();
    expect(watcher.cursors()).toHaveLength(0);
  });

  test("disconnecting withdraws the cursor", async () => {
    const { engine, watcher } = await twoPlayerGame();
    await hover(engine, "alice", 2, 2);
    engine.flushCursors();
    watcher.clear();

    await engine.play({
      type: MessageTypes.PLAYER_DISCONNECT,
      playerId: "alice",
    } as Message);
    engine.flushCursors();
    expect(watcher.lastCursors()).toEqual([]);
  });

  test("a cursor never reaches the game, the board, or the notation", async () => {
    const { engine } = await twoPlayerGame({ showCursors: true });
    const before = JSON.stringify(engine.games["g1"]);
    await hover(engine, "alice", 1, 1);
    engine.flushCursors();
    expect(JSON.stringify(engine.games["g1"])).toBe(before);
    expect(engine.games["g1"].positions.flat().join("")).toBe("---------");
  });

  test("rejects a cursor from someone not in the game", async () => {
    const { engine, watcher } = await twoPlayerGame({ showCursors: true });
    await hover(engine, "watcher", 1, 1);
    engine.flushCursors();
    // Spectators watch; they do not point.
    expect(watcher.cursors()).toHaveLength(0);
  });

  test("rejects out-of-range and non-integer coordinates", async () => {
    const { engine, watcher } = await twoPlayerGame();
    await hover(engine, "alice", 3, 0);
    await hover(engine, "alice", 0, -2);
    await hover(engine, "alice", 1.5, 1);
    engine.flushCursors();
    expect(watcher.cursors()).toHaveLength(0);
  });

  test("a finished game gets one clearing flush and then nothing", async () => {
    const { engine, watcher } = await twoPlayerGame();
    await hover(engine, "alice", 2, 2);
    engine.flushCursors();
    watcher.clear();

    await engine.play({
      type: MessageTypes.FORFEIT,
      gameId: "g1",
      playerId: "alice",
    } as Message);
    // The forfeit ends the game; the pending cursor is cleared, not kept.
    await hover(engine, "bob", 0, 0);
    engine.flushCursors();
    const seen = watcher.cursors();
    expect(seen[seen.length - 1]).toEqual([]);

    watcher.clear();
    engine.flushCursors();
    expect(watcher.cursors()).toHaveLength(0);
  });

  test("sweep collects cursors whose game is gone", async () => {
    const { engine } = await twoPlayerGame();
    await hover(engine, "alice", 1, 1);
    delete engine.games["g1"];
    engine.sweep();
    // Nothing left to flush, and nothing throws reaching for a dead game.
    expect(() => engine.flushCursors()).not.toThrow();
  });
});
