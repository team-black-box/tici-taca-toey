import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import { GameDb } from "../src/db";
import { countSequences } from "../src/rules";
import { decodeGame } from "../src/notation";
import {
  ErrorCodes,
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
} from "../src/model";

// The 2026-07 variants: multiple required win sequences, and teams.
// These tests define the rules - see shared/rules.ts for the rationale.

class FakeConnection implements PlayerConnection {
  messages: Array<Record<string, unknown>> = [];
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

const start = async (
  engine: TiciTacaToeyGameEngine,
  gameId: string,
  config: Record<string, unknown>,
  connection = new FakeConnection(),
  playerId = "p0"
) => {
  await engine.play({
    type: MessageTypes.START_GAME,
    name: "variant game",
    gameId,
    playerId,
    connection,
    ...config,
  } as unknown as Message);
  return connection;
};

const join = (engine: TiciTacaToeyGameEngine, gameId: string, playerId: string) =>
  engine.play({
    type: MessageTypes.JOIN_GAME,
    gameId,
    playerId,
    connection: new FakeConnection(),
  } as Message);

const move = (
  engine: TiciTacaToeyGameEngine,
  gameId: string,
  playerId: string,
  x: number,
  y: number
) =>
  engine.play({
    type: MessageTypes.MAKE_MOVE,
    gameId,
    playerId,
    coordinateX: x,
    coordinateY: y,
  } as Message);

describe("sequence counting (shared/rules)", () => {
  const board = (rows: string[]): string[][] =>
    rows.map((row) => row.split(""));

  test("a run of four counts as two length-2 sequences, never three", () => {
    const positions = board(["aaaa", "----", "----", "----"]);
    const scan = countSequences(positions, 2, (value) => value === "a");
    expect(scan.count).toBe(2);
  });

  test("a run of three counts as one length-2 sequence", () => {
    const positions = board(["aaa-", "----", "----", "----"]);
    expect(countSequences(positions, 2, (v) => v === "a").count).toBe(1);
  });

  test("crossing sequences in different directions both count", () => {
    // A plus sign: one horizontal and one vertical length-3 run sharing
    // the centre cell - crossword rules, two sequences.
    const positions = board(["-a---", "aaa--", "-a---", "-----", "-----"]);
    expect(countSequences(positions, 3, (v) => v === "a").count).toBe(2);
  });
});

describe("multi-sequence games", () => {
  test("the game continues after the first sequence and ends on the required count", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await start(engine, "ms", {
      boardSize: 5,
      playerCount: 2,
      winningSequenceLength: 2,
      winningSequenceCount: 2,
    });
    await join(engine, "ms", "p1");

    await move(engine, "ms", "p0", 0, 0);
    await move(engine, "ms", "p1", 4, 0);
    await move(engine, "ms", "p0", 0, 1); // first sequence complete
    expect(engine.games["ms"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    await move(engine, "ms", "p1", 4, 2); // p1 has no adjacent pair
    await move(engine, "ms", "p0", 2, 0);
    await move(engine, "ms", "p1", 4, 4);
    await move(engine, "ms", "p0", 2, 1); // second sequence - game over

    const game = engine.games["ms"];
    expect(game.status).toBe(GameStatus.GAME_WON);
    expect(game.winner).toBe("p0");
    expect(game.winningTeam).toBe(-1);
    // Both sequences are in the highlight set.
    expect(game.winningSequence.length).toBe(4);
    // Variant games record TTN v3 and round-trip through the decoder.
    const decoded = decodeGame(game.notation as string);
    expect(decoded.winningSequenceCount).toBe(2);
    expect(decoded.teamCount).toBe(0);
    expect(decoded.result).toEqual({ kind: "win", winnerSeat: 0 });
  });

  test("sequence count must physically fit each side's share of the board", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const connection = await start(engine, "toobig", {
      boardSize: 3,
      playerCount: 2,
      winningSequenceLength: 3,
      winningSequenceCount: 2, // 2 * 3 = 6 cells > floor(9 / 2)
    });
    expect(connection.last().error).toBe(
      ErrorCodes.INVALID_WINNING_SEQUENCE_COUNT
    );
    expect(engine.games["toobig"]).toBeUndefined();
  });
});

describe("team games", () => {
  test("teams alternate by seat and sequences may mix teammates' marks", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await start(engine, "tg", {
      boardSize: 5,
      playerCount: 4,
      teamCount: 2,
      winningSequenceLength: 3,
    });
    for (const playerId of ["p1", "p2", "p3"]) {
      await join(engine, "tg", playerId);
    }
    expect(engine.games["tg"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    // Seats p0,p1,p2,p3 -> teams 0,1,0,1. Team 0 builds a row with marks
    // from both members; team 1 scatters.
    await move(engine, "tg", "p0", 0, 0);
    await move(engine, "tg", "p1", 3, 3);
    await move(engine, "tg", "p2", 0, 1); // teammate extends the run
    await move(engine, "tg", "p3", 4, 4);
    await move(engine, "tg", "p0", 0, 2); // three across two players - win

    const game = engine.games["tg"];
    expect(game.status).toBe(GameStatus.GAME_WON);
    expect(game.winner).toBe("p0");
    expect(game.winningTeam).toBe(0);
    expect(game.winningSequence.length).toBe(3);

    const decoded = decodeGame(game.notation as string);
    expect(decoded.teamCount).toBe(2);
    expect(decoded.result.winnerTeam).toBe(0);
  });

  test("team counts must divide players into at least two per team", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const uneven = await start(engine, "bad1", {
      boardSize: 6,
      playerCount: 4,
      teamCount: 3, // 4 % 3 != 0
    });
    expect(uneven.last().error).toBe(ErrorCodes.INVALID_TEAM_CONFIGURATION);
    const solo = await start(engine, "bad2", {
      boardSize: 6,
      playerCount: 4,
      teamCount: 4, // teams of one are not teams
    });
    expect(solo.last().error).toBe(ErrorCodes.INVALID_TEAM_CONFIGURATION);
  });

  test("a whole team must run out of time before the other wins on time", async () => {
    const engine = new TiciTacaToeyGameEngine();
    await start(engine, "tt", {
      boardSize: 5,
      playerCount: 4,
      teamCount: 2,
      winningSequenceLength: 3,
      timePerPlayer: 5000,
    });
    for (const playerId of ["p1", "p2", "p3"]) {
      await join(engine, "tt", playerId);
    }
    const game = engine.games["tt"];
    expect(game.status).toBe(GameStatus.GAME_IN_PROGRESS);

    // Drain seat 0's clock only: their teammate p2 still has time, so the
    // game must continue (a skip, not a loss).
    game.timers["p0"].timeLeft = 0;
    await engine.play({
      type: MessageTypes.PLAYER_TIMEOUT,
      gameId: "tt",
      playerId: "p0",
    } as Message);
    expect(engine.games["tt"].status).toBe(GameStatus.GAME_IN_PROGRESS);

    // Now drain the teammate too - all of team 0 is out, team 1 wins.
    engine.games["tt"].timers["p2"].timeLeft = 0;
    await engine.play({
      type: MessageTypes.PLAYER_TIMEOUT,
      gameId: "tt",
      playerId: "p2",
    } as Message);
    const finished = engine.games["tt"];
    expect(finished.status).toBe(GameStatus.GAME_WON_BY_TIMEOUT);
    expect(finished.winningTeam).toBe(1);
    expect(["p1", "p3"]).toContain(finished.winner);
  });

  test("ratings settle by team, and every game feeds the global pool", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    for (const playerId of ["p0", "p1", "p2", "p3"]) {
      await engine.play({
        type: MessageTypes.REGISTER_PLAYER,
        name: playerId,
        playerId,
        playerKey: `key-${playerId}`,
        connection: new FakeConnection(),
      } as Message);
    }
    await start(engine, "tr", {
      boardSize: 5,
      playerCount: 4,
      teamCount: 2,
      winningSequenceLength: 3,
    });
    for (const playerId of ["p1", "p2", "p3"]) {
      await join(engine, "tr", playerId);
    }
    await move(engine, "tr", "p0", 0, 0);
    await move(engine, "tr", "p1", 3, 3);
    await move(engine, "tr", "p2", 0, 1);
    await move(engine, "tr", "p3", 4, 4);
    await move(engine, "tr", "p0", 0, 2);
    expect(engine.games["tr"].status).toBe(GameStatus.GAME_WON);

    // The teammate who did not play the final move still gains rating,
    // and both losers lose - in the config pool and the global pool.
    const pools = db.pools();
    expect(pools).toContain("5x3x4-t2");
    expect(pools).toContain("global");
    const ratingsOf = (playerId: string) =>
      Object.fromEntries(
        (db.playerProfile(playerId)?.ratings ?? []).map((row) => [
          row.pool,
          row.rating,
        ])
      );
    expect(ratingsOf("p2")["5x3x4-t2"]).toBeGreaterThan(1000);
    expect(ratingsOf("p2")["global"]).toBeGreaterThan(1000);
    expect(ratingsOf("p1")["5x3x4-t2"]).toBeLessThan(1000);
    expect(ratingsOf("p3")["global"]).toBeLessThan(1000);
  });
});

describe("personal history over the websocket", () => {
  test("LIST_MY_GAMES returns the archive shaped for the asker, handles only", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    const alice = new FakeConnection();
    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Alice",
      playerId: "alice",
      playerKey: "alice-key",
      connection: alice,
    } as Message);
    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "alice",
      playerId: "alice",
      connection: alice,
    } as Message);
    await start(
      engine,
      "h1",
      { boardSize: 3, playerCount: 2, winningSequenceLength: 3 },
      alice,
      "alice"
    );
    await join(engine, "h1", "bob");
    await move(engine, "h1", "alice", 0, 0);
    await move(engine, "h1", "bob", 1, 0);
    await move(engine, "h1", "alice", 0, 1);
    await move(engine, "h1", "bob", 1, 1);
    await move(engine, "h1", "alice", 0, 2);
    expect(engine.games["h1"].status).toBe(GameStatus.GAME_WON);

    await engine.play({
      type: MessageTypes.LIST_MY_GAMES,
      playerId: "alice",
      connection: alice,
    } as Message);
    const response = alice.ofType(MessageTypes.MY_GAMES)[0] as {
      games: Array<Record<string, unknown>>;
    };
    expect(response.games.length).toBe(1);
    const archived = response.games[0];
    expect(archived.mySeat).toBe(0);
    expect(archived.winnerSeat).toBe(0);
    expect(typeof archived.ttn).toBe("string");
    const seats = archived.players as Array<Record<string, unknown>>;
    expect(seats[0].handle).toBe("alice");
    expect(seats[1].handle).toBe("anonymous");
    // The whole point: no playerId ever leaves the server here.
    expect(JSON.stringify(response)).not.toContain("bob");
  });

  test("LIST_MY_GAMES without a database answers empty, never errors", async () => {
    // Clients refresh history automatically on connect; a db-less server
    // (dev, tests) must answer with an empty archive, not an error toast.
    const engine = new TiciTacaToeyGameEngine();
    const connection = new FakeConnection();
    await engine.play({
      type: MessageTypes.LIST_MY_GAMES,
      playerId: "nobody",
      connection,
    } as Message);
    expect(connection.last()).toEqual({
      type: MessageTypes.MY_GAMES,
      games: [],
    });
  });
});
