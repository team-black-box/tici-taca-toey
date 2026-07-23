import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import { GameDb } from "../src/db";
import {
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
} from "../src/model";

// Dead games must END, not vanish: the players hear about it, the archive
// keeps it, and the robot seats come back. Silently deleting a game out
// from under a connected client is what leaves ghosts in the lobby.

const IDLE_MS = 30 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const COMPLETED_MS = 10 * 60 * 1000;

class FakeConnection implements PlayerConnection {
  messages: any[] = [];
  send(data: string) {
    this.messages.push(JSON.parse(data));
  }
  ofType(type: string) {
    return this.messages.filter((message) => message.type === type);
  }
}

const startGame = async (
  engine: TiciTacaToeyGameEngine,
  gameId: string,
  host: PlayerConnection,
  timed = false
) => {
  await engine.play({
    type: MessageTypes.START_GAME,
    name: gameId,
    boardSize: 3,
    playerCount: 2,
    winningSequenceLength: 3,
    ...(timed ? { timePerPlayer: 60_000, incrementPerPlayer: 0 } : {}),
    gameId,
    playerId: `${gameId}-host`,
    connection: host,
  } as Message);
};

const joinGame = async (
  engine: TiciTacaToeyGameEngine,
  gameId: string,
  guest: PlayerConnection
) => {
  await engine.play({
    type: MessageTypes.JOIN_GAME,
    gameId,
    playerId: `${gameId}-guest`,
    connection: guest,
  } as Message);
};

describe("sweep ends dead games properly", () => {
  test("an idle untimed game is abandoned, broadcast, and archived", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    const host = new FakeConnection();
    const guest = new FakeConnection();
    await startGame(engine, "idle-1", host);
    await joinGame(engine, "idle-1", guest);
    expect(engine.games["idle-1"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    // Not yet: still inside the idle window.
    engine.sweep(Date.now() + IDLE_MS - 1000);
    expect(engine.games["idle-1"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    engine.sweep(Date.now() + IDLE_MS + 1000);
    expect(engine.games["idle-1"].status).toBe(GameStatus.GAME_ABANDONED);

    // Both seats were told, and the archive kept it.
    expect(host.ofType(MessageTypes.PLAYER_DISCONNECT).length).toBeGreaterThan(0);
    expect(guest.ofType(MessageTypes.PLAYER_DISCONNECT).length).toBeGreaterThan(0);
    expect(db.getGame("idle-1")).not.toBeNull();
  });

  test("a waiting game nobody joins is cleaned up too", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = new FakeConnection();
    await startGame(engine, "lonely-1", host);
    expect(engine.games["lonely-1"].status).toBe(
      GameStatus.WAITING_FOR_PLAYERS
    );

    engine.sweep(Date.now() + IDLE_MS + 1000);
    expect(engine.games["lonely-1"].status).toBe(GameStatus.GAME_ABANDONED);
  });

  test("a timed game in progress is left to its own clock", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = new FakeConnection();
    const guest = new FakeConnection();
    await startGame(engine, "timed-1", host, true);
    await joinGame(engine, "timed-1", guest);
    expect(engine.games["timed-1"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    // A long think is legitimate while a clock is running - PLAYER_TIMEOUT
    // ends this game, not the idle sweep.
    engine.sweep(Date.now() + IDLE_MS + 1000);
    expect(engine.games["timed-1"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    // The 24h backstop still applies to everything.
    engine.sweep(Date.now() + STALE_MS + 1000);
    expect(engine.games["timed-1"].status).toBe(GameStatus.GAME_ABANDONED);
    Object.values(engine.games["timed-1"].timers).forEach((timer: any) =>
      expect(timer.isRunning).toBe(false)
    );
  });

  test("an idle game frees its robot seat", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = new FakeConnection();
    const robot = new FakeConnection();
    await engine.play({
      type: MessageTypes.REGISTER_ROBOT,
      name: "sweeper-bot",
      playerId: "robot-1",
      capabilities: {
        boardSizes: { min: 2, max: 12 },
        playerCounts: { min: 2, max: 10 },
        maxConcurrentGames: 1,
        timed: true,
      },
      connection: robot,
    } as Message);
    await startGame(engine, "seat-1", host);
    await engine.play({
      type: MessageTypes.REQUEST_ROBOT,
      gameId: "seat-1",
      playerId: "seat-1-host",
      connection: host,
    } as Message);
    expect(engine.robots["robot-1"].activeGames).toContain("seat-1");

    engine.sweep(Date.now() + IDLE_MS + 1000);
    expect(engine.robots["robot-1"].activeGames).not.toContain("seat-1");
  });

  test("abandoned games are removed once the completed TTL passes", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = new FakeConnection();
    await startGame(engine, "gone-1", host);

    const idleAt = Date.now() + IDLE_MS + 1000;
    engine.sweep(idleAt);
    // Still present, so connected clients see the final state.
    expect(engine.games["gone-1"].status).toBe(GameStatus.GAME_ABANDONED);

    engine.sweep(idleAt + COMPLETED_MS + 1000);
    expect(engine.games["gone-1"]).toBeUndefined();
  });

  test("active play is never swept", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = new FakeConnection();
    const guest = new FakeConnection();
    await startGame(engine, "live-1", host);
    await joinGame(engine, "live-1", guest);
    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId: "live-1",
      coordinateX: 1,
      coordinateY: 1,
      playerId: engine.games["live-1"].turn,
    } as Message);

    // The move reset the idle clock.
    engine.sweep(Date.now() + IDLE_MS - 1000);
    expect(engine.games["live-1"].status).toBe(GameStatus.GAME_IN_PROGRESS);
  });
});

describe("capacity limits", () => {
  test("new games are refused past the active-game cap", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const connection = new FakeConnection();
    const cap = Number(process.env.TTT_MAX_GAMES ?? 1000);
    for (let index = 0; index < cap; index++) {
      await startGame(engine, `cap-${index}`, connection);
    }
    expect(Object.keys(engine.games).length).toBe(cap);

    await startGame(engine, "one-too-many", connection);
    expect(engine.games["one-too-many"]).toBeUndefined();
    const errors = connection.messages.filter(
      (message) => message.error === "SERVER_AT_CAPACITY"
    );
    expect(errors.length).toBe(1);
  }, 30_000);
});
