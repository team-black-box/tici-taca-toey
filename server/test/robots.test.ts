import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import {
  ErrorCodes,
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
  RobotCapabilities,
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

const ANY_GAME: RobotCapabilities = {
  boardSizes: { min: 2, max: 12 },
  playerCounts: { min: 2, max: 10 },
  maxConcurrentGames: 10,
  timed: true,
};

const registerRobot = async (
  engine: TiciTacaToeyGameEngine,
  robotId: string,
  capabilities: RobotCapabilities,
  connection: FakeConnection = new FakeConnection()
) => {
  await engine.play({
    type: MessageTypes.REGISTER_ROBOT,
    name: robotId,
    capabilities,
    playerId: robotId,
    connection,
  } as Message);
  return connection;
};

const startGame = async (
  engine: TiciTacaToeyGameEngine,
  playerId: string,
  gameId: string,
  connection: FakeConnection,
  options: Partial<{
    boardSize: number;
    playerCount: number;
    timePerPlayer: number;
  }> = {}
) => {
  await engine.play({
    type: MessageTypes.START_GAME,
    name: "Robot Game",
    boardSize: options.boardSize ?? 3,
    playerCount: options.playerCount ?? 2,
    timePerPlayer: options.timePerPlayer,
    gameId,
    playerId,
    connection,
  } as Message);
};

const requestRobot = async (
  engine: TiciTacaToeyGameEngine,
  playerId: string,
  gameId: string
) => {
  await engine.play({
    type: MessageTypes.REQUEST_ROBOT,
    gameId,
    playerId,
  } as Message);
};

describe("robot registration", () => {
  test("a robot registers and receives its playerId", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const conn = await registerRobot(engine, "r1", ANY_GAME);
    expect(conn.last()).toEqual({
      type: MessageTypes.REGISTER_ROBOT,
      name: "r1",
      playerId: "r1",
    });
    expect(engine.robots["r1"].capabilities).toEqual(ANY_GAME);
  });

  test("invalid capabilities are rejected", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const badCaps = [
      undefined,
      {},
      { ...ANY_GAME, boardSizes: { min: 1, max: 12 } },
      { ...ANY_GAME, boardSizes: { min: 5, max: 3 } },
      { ...ANY_GAME, playerCounts: { min: 2, max: 11 } },
      { ...ANY_GAME, maxConcurrentGames: 0 },
      { ...ANY_GAME, maxConcurrentGames: 101 },
      { ...ANY_GAME, timed: "yes" },
      { ...ANY_GAME, minTimePerPlayer: -5 },
    ];
    for (const capabilities of badCaps) {
      const conn = new FakeConnection();
      await engine.play({
        type: MessageTypes.REGISTER_ROBOT,
        name: "bad",
        capabilities,
        playerId: "bad",
        connection: conn,
      } as unknown as Message);
      expect(conn.last().error).toBe(ErrorCodes.INVALID_ROBOT_CAPABILITIES);
    }
    expect(Object.keys(engine.robots)).toEqual([]);
  });
});

describe("robot scheduling", () => {
  test("REQUEST_ROBOT seats a robot and the game starts", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const robotConn = await registerRobot(engine, "r1", ANY_GAME);
    const host = new FakeConnection();
    await startGame(engine, "alice", "g1", host);
    await requestRobot(engine, "alice", "g1");

    expect(engine.games["g1"].status).toBe(GameStatus.GAME_IN_PROGRESS);
    expect(engine.games["g1"].players).toEqual(["alice", "r1"]);
    expect(engine.robots["r1"].activeGames).toEqual(["g1"]);
    // both the host and the robot saw the join broadcast
    expect(host.last().type).toBe(MessageTypes.JOIN_GAME);
    expect(robotConn.last().type).toBe(MessageTypes.JOIN_GAME);
    expect(robotConn.last().game.turn).toBe("alice");
  });

  test("capability mismatches yield NO_ROBOT_AVAILABLE", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await registerRobot(engine, "tiny", {
      boardSizes: { min: 3, max: 3 },
      playerCounts: { min: 2, max: 2 },
      maxConcurrentGames: 5,
      timed: false,
    });

    const expectNoRobot = async (gameId: string) => {
      const host = new FakeConnection();
      await engine.play({
        type: MessageTypes.REGISTER_PLAYER,
        name: "host",
        playerId: `host-${gameId}`,
        connection: host,
      } as Message);
      return { host, playerId: `host-${gameId}` };
    };

    // board too large
    const a = await expectNoRobot("big");
    await startGame(engine, a.playerId, "big", a.host, { boardSize: 7 });
    await requestRobot(engine, a.playerId, "big");
    expect(a.host.last().error).toBe(ErrorCodes.NO_ROBOT_AVAILABLE);

    // timed game vs untimed robot
    const b = await expectNoRobot("timed");
    await startGame(engine, b.playerId, "timed", b.host, {
      timePerPlayer: 60000,
    });
    await requestRobot(engine, b.playerId, "timed");
    expect(b.host.last().error).toBe(ErrorCodes.NO_ROBOT_AVAILABLE);

    // matching game works
    const c = await expectNoRobot("ok");
    await startGame(engine, c.playerId, "ok", c.host, { boardSize: 3 });
    await requestRobot(engine, c.playerId, "ok");
    expect(engine.games["ok"].players).toContain("tiny");
  });

  test("a robot refuses clocks faster than its minTimePerPlayer", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await registerRobot(engine, "slow", {
      ...ANY_GAME,
      minTimePerPlayer: 30_000,
    });
    const host = new FakeConnection();
    await startGame(engine, "alice", "fast", host, { timePerPlayer: 10_000 });
    await requestRobot(engine, "alice", "fast");
    expect(host.last().error).toBe(ErrorCodes.NO_ROBOT_AVAILABLE);
    // clean up timers from the waiting timed game
    Object.values(engine.games["fast"].timers).forEach((timer) =>
      (timer as any).destroy()
    );
  });

  test("the least-loaded robot is selected", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await registerRobot(engine, "busy", ANY_GAME);
    await registerRobot(engine, "idle", ANY_GAME);
    engine.robots["busy"].activeGames = ["x", "y"];

    const host = new FakeConnection();
    await startGame(engine, "alice", "g1", host);
    await requestRobot(engine, "alice", "g1");
    expect(engine.games["g1"].players).toContain("idle");
  });

  test("robots at max concurrency are skipped", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await registerRobot(engine, "r1", { ...ANY_GAME, maxConcurrentGames: 1 });
    engine.robots["r1"].activeGames = ["other"];
    const host = new FakeConnection();
    await startGame(engine, "alice", "g1", host);
    await requestRobot(engine, "alice", "g1");
    expect(host.last().error).toBe(ErrorCodes.NO_ROBOT_AVAILABLE);
  });

  test("requesting a robot requires being in a waiting game", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await registerRobot(engine, "r1", ANY_GAME);
    const host = new FakeConnection();
    const stranger = new FakeConnection();
    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Stranger",
      playerId: "stranger",
      connection: stranger,
    } as Message);
    await startGame(engine, "alice", "g1", host);

    await requestRobot(engine, "stranger", "g1");
    expect(stranger.last().error).toBe(ErrorCodes.PLAYER_NOT_PART_OF_GAME);

    await requestRobot(engine, "alice", "nope");
    expect(host.last().error).toBe(ErrorCodes.GAME_NOT_FOUND);
  });

  test("seats are released when the game completes and when it is abandoned", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: 5 });
    await registerRobot(engine, "r1", ANY_GAME);
    const host = new FakeConnection();

    // completion path: play a full game against the seated robot
    await startGame(engine, "alice", "g1", host);
    await requestRobot(engine, "alice", "g1");
    expect(engine.robots["r1"].activeGames).toEqual(["g1"]);
    const moves: Array<[string, number, number]> = [
      ["alice", 0, 0],
      ["r1", 1, 0],
      ["alice", 0, 1],
      ["r1", 1, 1],
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
    expect(engine.games["g1"].status).toBe(GameStatus.GAME_WON);
    expect(engine.robots["r1"].activeGames).toEqual([]);

    // abandon path
    await startGame(engine, "alice", "g2", host);
    await requestRobot(engine, "alice", "g2");
    expect(engine.robots["r1"].activeGames).toEqual(["g2"]);
    await engine.play({
      type: MessageTypes.PLAYER_DISCONNECT,
      playerId: "alice",
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(engine.games["g2"].status).toBe(GameStatus.GAME_ABANDONED);
    expect(engine.robots["r1"]?.activeGames ?? []).toEqual([]);
  });

  test("one robot can fill several seats across games, and robots can play robots", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const r1 = await registerRobot(engine, "r1", ANY_GAME);
    const r2 = await registerRobot(engine, "r2", ANY_GAME);
    const host = new FakeConnection();

    // robot vs robot: host starts a 3 player game and requests two robots
    await startGame(engine, "alice", "rvr", host, {
      boardSize: 4,
      playerCount: 3,
    });
    await requestRobot(engine, "alice", "rvr");
    await requestRobot(engine, "alice", "rvr");
    expect(engine.games["rvr"].players.sort()).toEqual(["alice", "r1", "r2"]);
    expect(engine.games["rvr"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    // both robots also take seats in separate games
    const host2 = new FakeConnection();
    await startGame(engine, "bena", "g2", host2);
    await requestRobot(engine, "bena", "g2");
    expect(
      engine.robots["r1"].activeGames.length +
        engine.robots["r2"].activeGames.length
    ).toBe(3);
    expect(r1.ofType(MessageTypes.JOIN_GAME).length).toBeGreaterThan(0);
    expect(r2.ofType(MessageTypes.JOIN_GAME).length).toBeGreaterThan(0);
  });
});
