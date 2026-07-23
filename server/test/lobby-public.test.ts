import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import { GameDb } from "../src/db";
import { generateHandle, HANDLE_WORDS } from "../../shared/handles";
import { HANDLE_PATTERN } from "../src/db";
import {
  ErrorCodes,
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
  PlayerKind,
} from "../src/model";

// Public games (strangers may take a seat) and default handles.

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

const register = async (
  engine: TiciTacaToeyGameEngine,
  playerId: string,
  name = ""
) => {
  const connection = new FakeConnection();
  await engine.play({
    type: MessageTypes.REGISTER_PLAYER,
    playerId,
    name,
    playerKey: `key-${playerId}-0001`,
    connection,
  } as Message);
  return connection;
};

const startGame = (
  engine: TiciTacaToeyGameEngine,
  gameId: string,
  playerId: string,
  connection: PlayerConnection,
  extra: Record<string, unknown> = {}
) =>
  engine.play({
    type: MessageTypes.START_GAME,
    gameId,
    name: "Open Table",
    boardSize: 3,
    playerCount: 2,
    winningSequenceLength: 3,
    playerId,
    connection,
    ...extra,
  } as unknown as Message);

describe("public games", () => {
  test("a lobby join is refused until the host opens the game", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = await register(engine, "host");
    await startGame(engine, "g1", "host", host);
    expect(engine.games["g1"].openSeats).toBe(false);

    // A stranger browsing the lobby cannot just sit down.
    const stranger = await register(engine, "stranger");
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "g1",
      playerId: "stranger",
      connection: stranger,
      fromLobby: true,
    } as Message);
    expect(stranger.last().error).toBe(ErrorCodes.GAME_IS_NOT_OPEN);
    expect(engine.games["g1"].players).toEqual(["host"]);

    // Holding the invite link still works - that is the invitation.
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "g1",
      playerId: "stranger",
      connection: stranger,
    } as Message);
    expect(engine.games["g1"].players).toEqual(["host", "stranger"]);
  });

  test("the host opens the game and a stranger takes a seat from the lobby", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = await register(engine, "host");
    await startGame(engine, "g2", "host", host);

    await engine.play({
      type: MessageTypes.OPEN_SEATS,
      gameId: "g2",
      playerId: "host",
      connection: host,
    } as Message);
    expect(engine.games["g2"].openSeats).toBe(true);
    // Broadcast as a JOIN_GAME shape, which clients already handle.
    expect(host.last().type).toBe(MessageTypes.JOIN_GAME);

    const stranger = await register(engine, "stranger");
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "g2",
      playerId: "stranger",
      connection: stranger,
      fromLobby: true,
    } as Message);
    expect(engine.games["g2"].players).toEqual(["host", "stranger"]);
    expect(engine.games["g2"].status).toBe(GameStatus.GAME_IN_PROGRESS);
  });

  test("only a seated player can open a game, and not once it has started", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = await register(engine, "host");
    await startGame(engine, "g3", "host", host);

    const outsider = await register(engine, "outsider");
    await engine.play({
      type: MessageTypes.OPEN_SEATS,
      gameId: "g3",
      playerId: "outsider",
      connection: outsider,
    } as Message);
    expect(outsider.last().error).toBe(ErrorCodes.PLAYER_NOT_PART_OF_GAME);
    expect(engine.games["g3"].openSeats).toBe(false);

    // Fill the game, then try to open it mid-play.
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "g3",
      playerId: "outsider",
      connection: outsider,
    } as Message);
    await engine.play({
      type: MessageTypes.OPEN_SEATS,
      gameId: "g3",
      playerId: "host",
      connection: host,
    } as Message);
    expect(host.last().error).toBe(ErrorCodes.GAME_ALREADY_IN_PROGRESS);
  });

  test("a game can be started already open, and closed again", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = await register(engine, "host");
    await startGame(engine, "g4", "host", host, { openSeats: true });
    expect(engine.games["g4"].openSeats).toBe(true);

    await engine.play({
      type: MessageTypes.OPEN_SEATS,
      gameId: "g4",
      playerId: "host",
      connection: host,
      open: false,
    } as Message);
    expect(engine.games["g4"].openSeats).toBe(false);
  });

  test("the lobby advertises which games strangers may join", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = await register(engine, "host");
    await startGame(engine, "g5", "host", host, { openSeats: true });
    const watcher = new FakeConnection();
    await engine.play({
      type: MessageTypes.LIST_GAMES,
      playerId: "watcher",
      connection: watcher,
    } as Message);
    const listed = (watcher.last().games as Array<Record<string, unknown>>)[0];
    expect(listed.openSeats).toBe(true);
    expect(listed.agentCount).toBe(0);
  });
});

describe("default handles", () => {
  test("generated handles are in the house style and always valid", () => {
    for (let i = 0; i < 200; i++) {
      const handle = generateHandle();
      expect(HANDLE_PATTERN.test(handle)).toBe(true);
      expect(HANDLE_WORDS).toContain(handle.split("-")[0]);
    }
  });

  test("a new player is given a handle, so nobody is anonymous", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    const connection = await register(engine, "fresh");
    const registered = connection.ofType(MessageTypes.REGISTER_PLAYER)[0];
    expect(typeof registered.name).toBe("string");
    expect(HANDLE_PATTERN.test(registered.name as string)).toBe(true);
    expect(registered.kind).toBe(PlayerKind.HUMAN);
    expect(db.getHandle("fresh")).toBe(registered.name as string);
  });

  test("the assigned handle survives reconnects and empty name fields", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    const first = await register(engine, "p1");
    const assigned = first.ofType(MessageTypes.REGISTER_PLAYER)[0]
      .name as string;

    // Re-registering with an empty name (what a cleared handle field
    // sends) echoes the stored handle back rather than blanking it.
    const again = await register(engine, "p1");
    expect(again.ofType(MessageTypes.REGISTER_PLAYER)[0].name).toBe(assigned);
    expect(db.getHandle("p1")).toBe(assigned);
  });

  test("claiming a handle replaces the assigned one", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    const connection = await register(engine, "p2");
    const assigned = db.getHandle("p2");

    await engine.play({
      type: MessageTypes.CLAIM_HANDLE,
      handle: "chosen-name",
      playerId: "p2",
      connection,
    } as Message);
    expect(db.getHandle("p2")).toBe("chosen-name");
    expect(db.getHandle("p2")).not.toBe(assigned);
  });

  test("every leaderboard row is therefore a real, clickable handle", async () => {
    const db = new GameDb(":memory:");
    const engine = new TiciTacaToeyGameEngine({ db });
    await register(engine, "a");
    await register(engine, "b");
    expect(db.getHandle("a")).not.toBe("");
    expect(db.getHandle("b")).not.toBe("");
    expect(db.getHandle("a")).not.toBe(db.getHandle("b"));
  });
});
