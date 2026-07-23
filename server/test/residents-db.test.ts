import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import { startResidents } from "../src/residents";
import { GameDb } from "../src/db";
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate: () => boolean, timeoutMs = 3000) => {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await sleep(10);
  }
  expect(predicate()).toBe(true);
};

describe("resident robots", () => {
  test("residents register on boot and + robot seats one instantly", async () => {
    const engine = new TiciTacaToeyGameEngine();
    startResidents(engine, { moveDelayMs: () => 0 });
    await sleep(20);
    expect(Object.keys(engine.robots).sort()).toEqual([
      "resident-greedo",
      "resident-minnie-max",
      "resident-rando",
    ]);

    const host = new FakeConnection();
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "vs resident",
      boardSize: 3,
      playerCount: 2,
      gameId: "g1",
      playerId: "alice",
      connection: host,
    } as Message);
    await engine.play({
      type: MessageTypes.REQUEST_ROBOT,
      gameId: "g1",
      playerId: "alice",
    } as Message);
    expect(engine.games["g1"].status).toBe(GameStatus.GAME_IN_PROGRESS);
    expect(
      engine.games["g1"].players.some((id) => id.startsWith("resident-"))
    ).toBe(true);
  });

  test("a resident plays a full game to completion", async () => {
    const engine = new TiciTacaToeyGameEngine();
    startResidents(engine, { moveDelayMs: () => 0 });
    await sleep(20);
    const host = new FakeConnection();
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "duel",
      boardSize: 3,
      playerCount: 2,
      gameId: "g1",
      playerId: "alice",
      connection: host,
    } as Message);
    await engine.play({
      type: MessageTypes.REQUEST_ROBOT,
      gameId: "g1",
      playerId: "alice",
    } as Message);

    // alice plays first-empty; the resident responds until the game ends
    for (let i = 0; i < 9; i++) {
      const game = engine.games["g1"];
      if (game.status !== GameStatus.GAME_IN_PROGRESS) {
        break;
      }
      if (game.turn === "alice") {
        const empty: Array<[number, number]> = [];
        game.positions.forEach((row, x) =>
          row.forEach((cell, y) => {
            if (cell === "-") {
              empty.push([x, y]);
            }
          })
        );
        await engine.play({
          type: MessageTypes.MAKE_MOVE,
          gameId: "g1",
          coordinateX: empty[0][0],
          coordinateY: empty[0][1],
          playerId: "alice",
        } as Message);
      }
      await sleep(15);
    }
    await waitFor(() =>
      [
        GameStatus.GAME_WON,
        GameStatus.GAME_ENDS_IN_A_DRAW,
      ].includes(engine.games["g1"].status)
    );
    expect(engine.games["g1"].notation).toBeDefined();
  });

  test("two residents can play each other", async () => {
    const engine = new TiciTacaToeyGameEngine();
    startResidents(engine, { moveDelayMs: () => 0 });
    await sleep(20);
    const host = new FakeConnection();
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "robo rumble",
      boardSize: 4,
      playerCount: 3,
      winningSequenceLength: 3,
      gameId: "rvr",
      playerId: "alice",
      connection: host,
    } as Message);
    await engine.play({ type: MessageTypes.REQUEST_ROBOT, gameId: "rvr", playerId: "alice" } as Message);
    await engine.play({ type: MessageTypes.REQUEST_ROBOT, gameId: "rvr", playerId: "alice" } as Message);
    expect(engine.games["rvr"].status).toBe(GameStatus.GAME_IN_PROGRESS);
    const residents = engine.games["rvr"].players.filter((id) =>
      id.startsWith("resident-")
    );
    expect(residents.length).toBe(2);
  });
});

describe("named-robot matchmaking", () => {
  test("REQUEST_ROBOT with robotName seats exactly that robot", async () => {
    const engine = new TiciTacaToeyGameEngine();
    startResidents(engine, { moveDelayMs: () => 0 });
    await sleep(20);
    const host = new FakeConnection();
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "pick me",
      boardSize: 3,
      playerCount: 2,
      gameId: "g1",
      playerId: "alice",
      connection: host,
    } as Message);
    await engine.play({
      type: MessageTypes.REQUEST_ROBOT,
      gameId: "g1",
      robotName: "minnie-max",
      playerId: "alice",
    } as Message);
    expect(engine.games["g1"].players).toContain("resident-minnie-max");
  });

  test("an impossible robotName errors instead of seating someone else", async () => {
    const engine = new TiciTacaToeyGameEngine();
    startResidents(engine, { moveDelayMs: () => 0 });
    await sleep(20);
    const host = new FakeConnection();
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "5x5",
      boardSize: 5,
      playerCount: 2,
      gameId: "g2",
      playerId: "alice",
      connection: host,
    } as Message);
    // minnie-max only plays 3x3
    await engine.play({
      type: MessageTypes.REQUEST_ROBOT,
      gameId: "g2",
      robotName: "minnie-max",
      playerId: "alice",
    } as Message);
    expect(host.last().error).toBe(ErrorCodes.NO_ROBOT_AVAILABLE);
    expect(engine.games["g2"].players).toEqual(["alice"]);
  });

  test("LIST_GAMES carries the robot roster", async () => {
    const engine = new TiciTacaToeyGameEngine();
    startResidents(engine, { moveDelayMs: () => 0 });
    await sleep(20);
    const conn = new FakeConnection();
    await engine.play({
      type: MessageTypes.LIST_GAMES,
      playerId: "x",
      connection: conn,
    } as Message);
    const names = conn.last().robots.map((r: { name: string }) => r.name).sort();
    expect(names).toEqual(["greedo", "minnie-max", "rando"]);
  });

  test("residents claim their handles so leaderboards can name them", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    startResidents(engine, { moveDelayMs: () => 0 });
    await sleep(30);
    expect(db.getHandle("resident-rando")).toBe("rando");
    expect(db.getHandle("resident-minnie-max")).toBe("minnie-max");
  });
});

describe("database: identities, handles, archive, elo", () => {
  const boot = () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    return { db, engine };
  };

  const register = async (
    engine: TiciTacaToeyGameEngine,
    playerId: string,
    name: string
  ) => {
    const connection = new FakeConnection();
    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name,
      playerId,
      playerKey: `${playerId}-secret-key`,
      connection,
    } as Message);
    return connection;
  };

  const playWin = async (
    engine: TiciTacaToeyGameEngine,
    gameId: string,
    a: string,
    b: string,
    aConn: FakeConnection,
    bConn: FakeConnection
  ) => {
    await engine.play({
      type: MessageTypes.START_GAME,
      name: gameId,
      boardSize: 3,
      playerCount: 2,
      gameId,
      playerId: a,
      connection: aConn,
    } as Message);
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId,
      playerId: b,
      connection: bConn,
    } as Message);
    for (const [playerId, x, y] of [
      [a, 0, 0],
      [b, 1, 0],
      [a, 0, 1],
      [b, 1, 1],
      [a, 0, 2],
    ] as const) {
      await engine.play({
        type: MessageTypes.MAKE_MOVE,
        gameId,
        coordinateX: x,
        coordinateY: y,
        playerId,
      } as Message);
    }
  };

  test("registration persists players with hashed keys only", async () => {
    const { db, engine } = boot();
    await register(engine, "alice", "Alice");
    const profile = db.playerProfile("alice");
    expect(profile).not.toBeNull();
    // never the raw key
    expect(JSON.stringify(profile)).not.toContain("alice-secret-key");
  });

  test("handle claiming: claim, uniqueness, invalid, rename", async () => {
    const { db, engine } = boot();
    const alice = await register(engine, "alice", "Alice");
    const bob = await register(engine, "bob", "Bob");

    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "neo",
      playerId: "alice",
      connection: alice,
    } as Message);
    expect(alice.last()).toMatchObject({
      type: MessageTypes.HANDLE_CLAIMED,
      handle: "neo",
    });
    expect(db.getHandle("alice")).toBe("neo");
    // name updated for broadcasts
    expect(engine.players["alice"].name).toBe("neo");

    // case-insensitive uniqueness
    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "NEO",
      playerId: "bob",
      connection: bob,
    } as Message);
    expect(bob.last().error).toBe(ErrorCodes.HANDLE_TAKEN);

    // invalid pattern
    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "not a handle!!",
      playerId: "bob",
      connection: bob,
    } as Message);
    expect(bob.last().error).toBe(ErrorCodes.INVALID_HANDLE);

    // rename keeps identity
    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "the-one",
      playerId: "alice",
      connection: alice,
    } as Message);
    expect(db.getHandle("alice")).toBe("the-one");

    // "neo" is free again
    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "neo",
      playerId: "bob",
      connection: bob,
    } as Message);
    expect(db.getHandle("bob")).toBe("neo");
  });

  test("claimed handles survive re-registration (login restores username)", async () => {
    const { engine } = boot();
    const alice = await register(engine, "alice", "Alice");
    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "trinity",
      playerId: "alice",
      connection: alice,
    } as Message);
    // fresh connection, same identity
    const fresh = await register(engine, "alice", "");
    expect(fresh.ofType(MessageTypes.REGISTER_PLAYER)[0].name).toBe("trinity");
  });

  test("finished games are archived with TTN and rated with Elo", async () => {
    const { db, engine } = boot();
    const aliceConn = await register(engine, "alice", "Alice");
    const bobConn = await register(engine, "bob", "Bob");
    await playWin(engine, "g1", "alice", "bob", aliceConn, bobConn);

    const archived = db.getGame("g1");
    expect(archived?.ttn).toBe("1.3.3.2.u.0003010402.w0");
    expect(archived?.winnerSeat).toBe(0);
    expect(archived?.players.length).toBe(2);

    // Every player is given a handle on arrival, so every leaderboard row
    // is a real, clickable identity - no "anonymous" rows to filter out.
    expect(db.leaderboard("3x3x2").length).toBe(2);
    db.claimHandle("alice", "alice");
    db.claimHandle("bob", "bob");

    // Public rows carry handles only - never playerIds.
    const board = db.leaderboard("3x3x2");
    expect(board.length).toBe(2);
    expect(Object.keys(board[0])).not.toContain("playerId");
    expect(board[0].handle).toBe("alice"); // the winner leads
    expect(board[0].rating).toBeGreaterThan(1000);
    expect(board[0].wins).toBe(1);
    expect(board[0].losses).toBe(0);
    expect(board[0].winRate).toBe(100);
    expect(board[1].rating).toBeLessThan(1000);
    expect(board[1].losses).toBe(1);
    // Every game also settles the difficulty-weighted global pool.
    expect(db.pools()).toEqual(["3x3x2", "global"]);
    const global = db.leaderboard("global");
    expect(global.length).toBe(2);
    expect(global[0].rating).toBeGreaterThan(1000);

    const myGames = db.playerGames("alice");
    expect(myGames.length).toBe(1);
    expect(myGames[0].gameId).toBe("g1");

    // Anyone can look up a player's games by their public handle, which is
    // what makes another player's game replayable.
    const byHandle = db.gamesByHandle("ALICE");
    expect(byHandle.length).toBe(1);
    expect(byHandle[0].ttn).toBe(archived?.ttn as string);
    expect(db.gamesByHandle("nobody-here")).toEqual([]);
  });

  test("handles unavailable without a db", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const alice = await register(engine, "alice", "Alice");
    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "neo",
      playerId: "alice",
      connection: alice,
    } as Message);
    expect(alice.last().error).toBe(ErrorCodes.HANDLES_UNAVAILABLE);
  });
});

describe("identity survives server restarts", () => {
  test("same playerKey resolves to the same playerId on a fresh engine", async () => {
    const db = new GameDb(":memory:");
    const before = new TiciTacaToeyGameEngine({ db });
    const key = "phoenix-key-12345678";

    const firstId = before.resolvePlayerKey(key, "boot-1-conn");
    expect(firstId).toBe("boot-1-conn");
    const connection = new FakeConnection();
    await before.play({
      type: MessageTypes.REGISTER_PLAYER,
      playerId: firstId,
      name: "phoenix",
      playerKey: key,
      connection,
    } as Message);
    await before.play({
      type: MessageTypes.CLAIM_HANDLE,
      playerId: firstId,
      handle: "phoenix",
      connection,
    } as Message);

    // "restart": a brand new engine over the same database
    const after = new TiciTacaToeyGameEngine({ db });
    const resolvedId = after.resolvePlayerKey(key, "boot-2-conn");
    expect(resolvedId).toBe(firstId);
    const newConnection = new FakeConnection();
    await after.play({
      type: MessageTypes.REGISTER_PLAYER,
      playerId: resolvedId,
      name: "",
      playerKey: key,
      connection: newConnection,
    } as Message);
    expect(after.players[firstId].name).toBe("phoenix");

    // a different key still gets a fresh identity
    expect(after.resolvePlayerKey("stranger-key-9999", "boot-2-other")).toBe(
      "boot-2-other"
    );
  });
});
