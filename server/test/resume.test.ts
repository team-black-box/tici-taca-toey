import { describe, expect, test } from "bun:test";
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
  ofType(type: string) {
    return this.messages.filter((each) => each.type === type);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GRACE = 40;

// Mirrors what server.ts does: resolve the durable key to a playerId before
// the engine sees the registration.
const register = async (
  engine: TiciTacaToeyGameEngine,
  connectionScopedId: string,
  playerKey: string,
  name: string,
  connection: FakeConnection
) => {
  const playerId = engine.resolvePlayerKey(playerKey, connectionScopedId);
  await engine.play({
    type: MessageTypes.REGISTER_PLAYER,
    name,
    playerId,
    playerKey,
    connection,
  } as Message);
  return playerId;
};

const setupGame = async (engine: TiciTacaToeyGameEngine) => {
  const aliceConn = new FakeConnection();
  const bobConn = new FakeConnection();
  const alice = await register(
    engine,
    "conn-1",
    "alice-secret-key",
    "Alice",
    aliceConn
  );
  const bob = await register(engine, "conn-2", "bob-secret-key", "Bob", bobConn);
  await engine.play({
    type: MessageTypes.START_GAME,
    name: "Resumable",
    boardSize: 3,
    playerCount: 2,
    gameId: "g1",
    playerId: alice,
    connection: aliceConn,
  } as Message);
  await engine.play({
    type: MessageTypes.JOIN_GAME,
    gameId: "g1",
    playerId: bob,
    connection: bobConn,
  } as Message);
  return { alice, bob, aliceConn, bobConn };
};

describe("reconnect and resume", () => {
  test("the same key resolves to the same playerId across connections", () => {
    const engine = new TiciTacaToeyGameEngine();
    const first = engine.resolvePlayerKey("a-durable-secret", "conn-1");
    const second = engine.resolvePlayerKey("a-durable-secret", "conn-2");
    expect(first).toBe("conn-1");
    expect(second).toBe("conn-1");
  });

  test("short or invalid keys never resolve to an existing identity", () => {
    const engine = new TiciTacaToeyGameEngine();
    expect(engine.resolvePlayerKey("short", "conn-9")).toBe("conn-9");
    expect(engine.resolvePlayerKey(undefined, "conn-9")).toBe("conn-9");
    expect(engine.resolvePlayerKey("x".repeat(100), "conn-9")).toBe("conn-9");
  });

  test("a player who reconnects within grace resumes their game and keeps playing", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: GRACE });
    const { alice, bob, bobConn } = await setupGame(engine);

    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId: "g1",
      coordinateX: 0,
      coordinateY: 0,
      playerId: alice,
    } as Message);

    // alice's socket dies
    await engine.play({ type: MessageTypes.PLAYER_DISCONNECT, playerId: alice });
    expect(engine.players[alice].connected).toBe(false);

    // bob can still move during the grace window
    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId: "g1",
      coordinateX: 1,
      coordinateY: 0,
      playerId: bob,
    } as Message);

    // alice reconnects with the same key on a fresh connection
    const newConn = new FakeConnection();
    const resumedId = await register(
      engine,
      "conn-99",
      "alice-secret-key",
      "Alice",
      newConn
    );
    expect(resumedId).toBe(alice);

    const resumed = newConn.ofType(MessageTypes.GAME_RESUMED);
    expect(resumed.length).toBe(1);
    expect(resumed[0].game.gameId).toBe("g1");
    expect(resumed[0].game.status).toBe(GameStatus.GAME_IN_PROGRESS);
    expect(resumed[0].game.positions[0][0]).toBe(alice);
    expect(resumed[0].game.positions[1][0]).toBe(bob);
    expect(resumed[0].game.turn).toBe(alice);

    // grace expiry must not abandon a resumed player's games
    await sleep(GRACE * 2);
    expect(engine.games["g1"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    // and alice keeps playing on the new connection
    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId: "g1",
      coordinateX: 0,
      coordinateY: 1,
      playerId: alice,
    } as Message);
    expect(newConn.last().game.positions[0][1]).toBe(alice);
    expect(bobConn.last().game.positions[0][1]).toBe(alice);
  });

  test("grace expiry abandons games and cleans the key registry", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: GRACE });
    const { alice, bobConn } = await setupGame(engine);

    await engine.play({ type: MessageTypes.PLAYER_DISCONNECT, playerId: alice });
    await sleep(GRACE * 2);

    expect(engine.games["g1"].status).toBe(GameStatus.GAME_ABANDONED);
    expect(engine.games["g1"].notation?.endsWith(".a")).toBe(true);
    expect(engine.players[alice]).toBeUndefined();
    expect(bobConn.last().type).toBe(MessageTypes.PLAYER_DISCONNECT);
    expect(bobConn.last().game.status).toBe(GameStatus.GAME_ABANDONED);

    // the key now maps to a fresh identity
    const reborn = engine.resolvePlayerKey("alice-secret-key", "conn-new");
    expect(reborn).toBe("conn-new");
  });

  test("spectators resume too", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: GRACE });
    const { alice } = await setupGame(engine);
    const samConn = new FakeConnection();
    const sam = await register(
      engine,
      "conn-3",
      "sam-secret-key",
      "Sam",
      samConn
    );
    await engine.play({
      type: MessageTypes.SPECTATE_GAME,
      gameId: "g1",
      playerId: sam,
      connection: samConn,
    } as Message);

    await engine.play({ type: MessageTypes.PLAYER_DISCONNECT, playerId: sam });
    const newConn = new FakeConnection();
    await register(engine, "conn-31", "sam-secret-key", "Sam", newConn);

    const resumed = newConn.ofType(MessageTypes.SPECTATE_GAME);
    expect(resumed.length).toBe(1);
    expect(resumed[0].game.gameId).toBe("g1");
    expect(engine.games["g1"].status).toBe(GameStatus.GAME_IN_PROGRESS);
    // alice unused beyond setup; reference to satisfy lints
    expect(alice).toBeDefined();
  });

  test("broadcasts skip disconnected players", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: 10_000 });
    const { alice, bob, bobConn } = await setupGame(engine);
    await engine.play({ type: MessageTypes.PLAYER_DISCONNECT, playerId: bob });
    const bobMessageCount = bobConn.messages.length;
    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId: "g1",
      coordinateX: 0,
      coordinateY: 0,
      playerId: alice,
    } as Message);
    expect(bobConn.messages.length).toBe(bobMessageCount);
  });

  test("a timed game's clock keeps running through a disconnect", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: 10_000 });
    const aliceConn = new FakeConnection();
    const bobConn = new FakeConnection();
    const alice = await register(
      engine,
      "conn-1",
      "alice-secret-key",
      "Alice",
      aliceConn
    );
    const bob = await register(
      engine,
      "conn-2",
      "bob-secret-key",
      "Bob",
      bobConn
    );
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "Timed",
      boardSize: 3,
      playerCount: 2,
      gameId: "t1",
      playerId: alice,
      connection: aliceConn,
      timePerPlayer: 5000,
      incrementPerPlayer: 0,
    } as Message);
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "t1",
      playerId: bob,
      connection: bobConn,
    } as Message);

    expect(engine.games["t1"].timers[alice].isRunning).toBe(true);
    await engine.play({ type: MessageTypes.PLAYER_DISCONNECT, playerId: alice });
    expect(engine.games["t1"].timers[alice].isRunning).toBe(true);

    // clean up the running timer
    Object.values(engine.games["t1"].timers).forEach((timer) =>
      (timer as any).destroy()
    );
  });
});
