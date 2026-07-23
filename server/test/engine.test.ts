import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import {
  ErrorCodes,
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

interface TestPlayer {
  playerId: string;
  connection: FakeConnection;
}

const makePlayer = (id: string): TestPlayer => ({
  playerId: id,
  connection: new FakeConnection(),
});

const register = async (
  engine: TiciTacaToeyGameEngine,
  player: TestPlayer,
  name: string
) => {
  await engine.play({
    type: MessageTypes.REGISTER_PLAYER,
    name,
    playerId: player.playerId,
    connection: player.connection,
  });
};

const startGame = async (
  engine: TiciTacaToeyGameEngine,
  player: TestPlayer,
  gameId: string,
  options: Partial<{
    boardSize: number;
    playerCount: number;
    winningSequenceLength: number;
    timePerPlayer: number;
    incrementPerPlayer: number;
  }> = {}
) => {
  await engine.play({
    type: MessageTypes.START_GAME,
    name: "Test Game",
    boardSize: options.boardSize ?? 3,
    playerCount: options.playerCount ?? 2,
    winningSequenceLength: options.winningSequenceLength,
    timePerPlayer: options.timePerPlayer,
    incrementPerPlayer: options.incrementPerPlayer,
    gameId,
    playerId: player.playerId,
    connection: player.connection,
  } as Message);
};

const join = async (
  engine: TiciTacaToeyGameEngine,
  player: TestPlayer,
  gameId: string
) => {
  await engine.play({
    type: MessageTypes.JOIN_GAME,
    gameId,
    playerId: player.playerId,
    connection: player.connection,
  });
};

const move = async (
  engine: TiciTacaToeyGameEngine,
  player: TestPlayer,
  gameId: string,
  x: unknown,
  y: unknown
) => {
  await engine.play({
    type: MessageTypes.MAKE_MOVE,
    gameId,
    coordinateX: x,
    coordinateY: y,
    playerId: player.playerId,
    connection: player.connection,
  } as Message);
};

describe("registration", () => {
  test("a registering player receives their playerId", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    await register(engine, alice, "Alice");
    expect(alice.connection.last()).toEqual({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Alice",
      playerId: "alice",
    });
  });

  test("absurdly long names are truncated", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    await register(engine, alice, "a".repeat(5000));
    expect(alice.connection.last().name.length).toBe(50);
  });
});

describe("starting and joining games", () => {
  test("start game enters WAITING_FOR_PLAYERS and broadcasts state", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    await startGame(engine, alice, "g1");
    const response = alice.connection.last();
    expect(response.type).toBe(MessageTypes.START_GAME);
    expect(response.game.status).toBe(GameStatus.WAITING_FOR_PLAYERS);
    expect(response.game.positions).toEqual([
      ["-", "-", "-"],
      ["-", "-", "-"],
      ["-", "-", "-"],
    ]);
  });

  test("when the last player joins, the game starts and the creator moves first", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    await startGame(engine, alice, "g1");
    await join(engine, bob, "g1");
    const response = bob.connection.last();
    expect(response.game.status).toBe(GameStatus.GAME_IN_PROGRESS);
    expect(response.game.turn).toBe("alice");
    expect(alice.connection.last().game.status).toBe(
      GameStatus.GAME_IN_PROGRESS
    );
  });

  test("joining an unknown game returns GAME_NOT_FOUND without crashing", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const bob = makePlayer("bob");
    await register(engine, bob, "Bob");
    await join(engine, bob, "nope");
    expect(bob.connection.last().type).toBe("ERROR");
    expect(bob.connection.last().error).toBe(ErrorCodes.GAME_NOT_FOUND);
  });

  test("joining a full game returns GAME_ALREADY_IN_PROGRESS", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    const carol = makePlayer("carol");
    await startGame(engine, alice, "g1");
    await join(engine, bob, "g1");
    await register(engine, carol, "Carol");
    await join(engine, carol, "g1");
    expect(carol.connection.last().error).toBe(
      ErrorCodes.GAME_ALREADY_IN_PROGRESS
    );
  });

  test("invalid game configurations are rejected", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    await register(engine, alice, "Alice");

    const expectError = async (
      options: Parameters<typeof startGame>[3],
      error: ErrorCodes
    ) => {
      await startGame(engine, alice, crypto.randomUUID(), options);
      expect(alice.connection.last().type).toBe("ERROR");
      expect(alice.connection.last().error).toBe(error);
    };

    await expectError({ boardSize: 1 }, ErrorCodes.BOARD_SIZE_LESS_THAN_2);
    await expectError(
      { boardSize: 13 },
      ErrorCodes.BOARD_SIZE_CANNOT_BE_GREATER_THAN_12
    );
    await expectError(
      { playerCount: 1, boardSize: 3 },
      ErrorCodes.PLAYER_COUNT_LESS_THAN_2
    );
    await expectError(
      { playerCount: 3, boardSize: 3 },
      ErrorCodes.PLAYER_COUNT_MUST_BE_LESS_THAN_BOARD_SIZE
    );
    await expectError(
      { playerCount: 11, boardSize: 12 },
      ErrorCodes.PLAYER_COUNT_CANNOT_BE_GREATER_THAN_10
    );
    await expectError(
      { boardSize: 3, winningSequenceLength: 4 },
      ErrorCodes.WIN_SEQ_LENGTH_MUST_BE_LESS_THAN_OR_EQUAL_TO_BOARD_SIZE
    );
    await expectError(
      { boardSize: 3, timePerPlayer: 50 },
      ErrorCodes.INVALID_TIMER_CONFIGURATION
    );
  });

  test("unknown message types are rejected as BAD_REQUEST", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    await register(engine, alice, "Alice");
    await engine.play({
      type: "LAUNCH_THE_MISSILES",
      playerId: "alice",
      connection: alice.connection,
    } as unknown as Message);
    expect(alice.connection.last().error).toBe(ErrorCodes.BAD_REQUEST);
  });
});

describe("playing", () => {
  const setupTwoPlayerGame = async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    await register(engine, alice, "Alice");
    await register(engine, bob, "Bob");
    await startGame(engine, alice, "g1");
    await join(engine, bob, "g1");
    return { engine, alice, bob };
  };

  test("a full game plays through to a win with a winning sequence", async () => {
    const { engine, alice, bob } = await setupTwoPlayerGame();
    await move(engine, alice, "g1", 0, 0);
    await move(engine, bob, "g1", 1, 0);
    await move(engine, alice, "g1", 0, 1);
    await move(engine, bob, "g1", 1, 1);
    await move(engine, alice, "g1", 0, 2);

    const final = alice.connection.last();
    expect(final.type).toBe(MessageTypes.GAME_COMPLETE);
    expect(final.game.status).toBe(GameStatus.GAME_WON);
    expect(final.game.winner).toBe("alice");
    expect(final.game.turn).toBe("");
    expect(final.game.winningSequence).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
    expect(bob.connection.last().game.status).toBe(GameStatus.GAME_WON);
  });

  test("a full board with no winner ends in a draw", async () => {
    const { engine, alice, bob } = await setupTwoPlayerGame();
    // a o a
    // a o b   -> no three in a row anywhere
    // b a b
    await move(engine, alice, "g1", 0, 0);
    await move(engine, bob, "g1", 0, 1);
    await move(engine, alice, "g1", 0, 2);
    await move(engine, bob, "g1", 1, 1);
    await move(engine, alice, "g1", 1, 0);
    await move(engine, bob, "g1", 1, 2);
    await move(engine, alice, "g1", 2, 1);
    await move(engine, bob, "g1", 2, 0);
    await move(engine, alice, "g1", 2, 2);

    const final = alice.connection.last();
    expect(final.type).toBe(MessageTypes.GAME_COMPLETE);
    expect(final.game.status).toBe(GameStatus.GAME_ENDS_IN_A_DRAW);
  });

  test("moving out of turn is rejected", async () => {
    const { engine, bob } = await setupTwoPlayerGame();
    await move(engine, bob, "g1", 0, 0);
    expect(bob.connection.last().error).toBe(ErrorCodes.MOVE_OUT_OF_TURN);
  });

  test("occupied cells are rejected", async () => {
    const { engine, alice, bob } = await setupTwoPlayerGame();
    await move(engine, alice, "g1", 0, 0);
    await move(engine, bob, "g1", 0, 0);
    expect(bob.connection.last().error).toBe(ErrorCodes.INVALID_MOVE);
  });

  test("out-of-bounds and malformed coordinates are rejected, not crashes", async () => {
    const { engine, alice } = await setupTwoPlayerGame();
    for (const [x, y] of [
      [-1, 0],
      [0, 3],
      [99, 99],
      [1.5, 1],
      ["1", "1"],
      [null, null],
      [undefined, undefined],
    ]) {
      await move(engine, alice, "g1", x, y);
      expect(alice.connection.last().error).toBe(ErrorCodes.INVALID_MOVE);
    }
    // engine still works afterwards
    await move(engine, alice, "g1", 0, 0);
    expect(alice.connection.last().game.positions[0][0]).toBe("alice");
  });

  test("turns rotate correctly in a three player game", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const players = [makePlayer("p0"), makePlayer("p1"), makePlayer("p2")];
    await startGame(engine, players[0], "g3", {
      boardSize: 5,
      playerCount: 3,
      winningSequenceLength: 4,
    });
    await join(engine, players[1], "g3");
    await join(engine, players[2], "g3");
    expect(players[2].connection.last().game.turn).toBe("p0");

    await move(engine, players[0], "g3", 0, 0);
    expect(players[0].connection.last().game.turn).toBe("p1");
    await move(engine, players[1], "g3", 1, 0);
    expect(players[1].connection.last().game.turn).toBe("p2");
    await move(engine, players[2], "g3", 2, 0);
    expect(players[2].connection.last().game.turn).toBe("p0");
  });
});

describe("spectating", () => {
  test("spectators receive game updates as SPECTATE_GAME messages", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    const sam = makePlayer("sam");
    await startGame(engine, alice, "g1");
    await join(engine, bob, "g1");
    await register(engine, sam, "Sam");
    await engine.play({
      type: MessageTypes.SPECTATE_GAME,
      gameId: "g1",
      playerId: "sam",
      connection: sam.connection,
    });
    await move(engine, alice, "g1", 0, 0);
    const updates = sam.connection.ofType(MessageTypes.SPECTATE_GAME);
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates[updates.length - 1].game.positions[0][0]).toBe("alice");
  });

  test("a player cannot spectate their own game", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    await startGame(engine, alice, "g1");
    await engine.play({
      type: MessageTypes.SPECTATE_GAME,
      gameId: "g1",
      playerId: "alice",
      connection: alice.connection,
    });
    expect(alice.connection.last().error).toBe(
      ErrorCodes.PLAYER_ALREADY_PART_OF_GAME
    );
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("disconnects and cleanup", () => {
  test("an unresumed disconnect abandons the player's unfinished games after grace and informs others", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: 5 });
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    await startGame(engine, alice, "g1");
    await join(engine, bob, "g1");
    await engine.play({
      type: MessageTypes.PLAYER_DISCONNECT,
      playerId: "alice",
    });
    await sleep(30);
    const final = bob.connection.last();
    expect(final.type).toBe(MessageTypes.PLAYER_DISCONNECT);
    expect(final.game.status).toBe(GameStatus.GAME_ABANDONED);
    expect(engine.players["alice"]).toBeUndefined();
  });

  test("completed games never affect each other's stores", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: 5 });
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    await startGame(engine, alice, "g1");
    await join(engine, bob, "g1");
    await startGame(engine, alice, "g2", { boardSize: 4 });
    await engine.play({
      type: MessageTypes.PLAYER_DISCONNECT,
      playerId: "bob",
    });
    await sleep(30);
    expect(engine.games["g1"].status).toBe(GameStatus.GAME_ABANDONED);
    expect(engine.games["g2"].status).toBe(GameStatus.WAITING_FOR_PLAYERS);
  });

  test("sweep removes expired completed games and stale waiting games", async () => {
    const engine = new TiciTacaToeyGameEngine({ disconnectGraceMs: 5 });
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    await startGame(engine, alice, "done");
    await join(engine, bob, "done");
    await engine.play({
      type: MessageTypes.PLAYER_DISCONNECT,
      playerId: "bob",
    });
    await sleep(30);
    await startGame(engine, alice, "fresh");

    const now = Date.now();
    engine.sweep(now); // nothing is expired yet
    expect(Object.keys(engine.games).sort()).toEqual(["done", "fresh"]);

    engine.sweep(now + 11 * 60 * 1000); // completed TTL is 10 minutes
    expect(Object.keys(engine.games)).toEqual(["fresh"]);

    // A game that outlives its idle/stale window is ENDED, not deleted out
    // from under whoever is still connected: it becomes GAME_ABANDONED
    // (broadcast + archived, see sweep.test.ts) and only then ages out on
    // the completed TTL like any other finished game.
    const expired = now + 25 * 60 * 60 * 1000; // stale TTL is 24 hours
    engine.sweep(expired);
    expect(engine.games["fresh"].status).toBe(GameStatus.GAME_ABANDONED);

    engine.sweep(expired + 11 * 60 * 1000);
    expect(Object.keys(engine.games)).toEqual([]);
  });
});

describe("timed games", () => {
  test("a timed game starts the first player's clock and times out to a win", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    await startGame(engine, alice, "g1", {
      timePerPlayer: 5000,
      incrementPerPlayer: 0,
    });
    await join(engine, bob, "g1");
    expect(engine.games["g1"].timers["alice"].isRunning).toBe(true);

    // Simulate alice's clock hitting zero, exactly as the Timer would.
    engine.games["g1"].timers["alice"].timeLeft = 0;
    (engine.games["g1"].timers["alice"] as any).destroy();
    await engine.play({
      type: MessageTypes.PLAYER_TIMEOUT,
      gameId: "g1",
      playerId: "alice",
    });

    const final = bob.connection.last();
    expect(final.type).toBe(MessageTypes.GAME_COMPLETE);
    expect(final.game.status).toBe(GameStatus.GAME_WON_BY_TIMEOUT);
    expect(final.game.winner).toBe("bob");
    expect(engine.games["g1"].timers["bob"].isRunning).toBe(false);
  });

  test("untimed games carry no timers at all", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");
    await startGame(engine, alice, "g1");
    await join(engine, bob, "g1");
    expect(engine.games["g1"].timed).toBe(false);
    expect(Object.keys(engine.games["g1"].timers)).toEqual([]);
    await move(engine, alice, "g1", 0, 0);
    expect(alice.connection.last().game.turn).toBe("bob");
  });
});
