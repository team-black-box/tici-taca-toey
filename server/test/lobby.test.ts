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
}

describe("LIST_GAMES lobby", () => {
  test("lists active games with human/robot/spectator counts, hides finished ones", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = new FakeConnection();
    const robotConn = new FakeConnection();
    const watcher = new FakeConnection();

    await engine.play({
      type: MessageTypes.REGISTER_ROBOT,
      name: "robo",
      capabilities: {
        boardSizes: { min: 2, max: 12 },
        playerCounts: { min: 2, max: 10 },
        maxConcurrentGames: 5,
        timed: true,
      },
      playerId: "robo",
      connection: robotConn,
    } as Message);

    // waiting 3-player game with one robot seated
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "Open Table",
      boardSize: 5,
      playerCount: 3,
      gameId: "g1",
      playerId: "alice",
      connection: host,
    } as Message);
    await engine.play({
      type: MessageTypes.REQUEST_ROBOT,
      gameId: "g1",
      playerId: "alice",
    } as Message);
    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Sam",
      playerId: "sam",
      connection: watcher,
    } as Message);
    await engine.play({
      type: MessageTypes.SPECTATE_GAME,
      gameId: "g1",
      playerId: "sam",
      connection: watcher,
    } as Message);

    // a completed game must not be listed
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "Done Game",
      boardSize: 3,
      playerCount: 2,
      gameId: "g2",
      playerId: "alice",
      connection: host,
    } as Message);
    await engine.play({
      type: MessageTypes.REQUEST_ROBOT,
      gameId: "g2",
      playerId: "alice",
    } as Message);
    for (const [playerId, x, y] of [
      ["alice", 0, 0],
      ["robo", 1, 0],
      ["alice", 0, 1],
      ["robo", 1, 1],
      ["alice", 0, 2],
    ] as const) {
      await engine.play({
        type: MessageTypes.MAKE_MOVE,
        gameId: "g2",
        coordinateX: x,
        coordinateY: y,
        playerId,
      } as Message);
    }
    expect(engine.games["g2"].status).toBe(GameStatus.GAME_WON);

    await engine.play({
      type: MessageTypes.LIST_GAMES,
      playerId: "sam",
      connection: watcher,
    } as Message);

    const response = watcher.last();
    expect(response.type).toBe(MessageTypes.LIST_GAMES);
    expect(response.games.length).toBe(1);
    expect(response.games[0]).toEqual({
      gameId: "g1",
      name: "Open Table",
      boardSize: 5,
      winningSequenceLength: 5,
      winningSequenceCount: 1,
      teamCount: 0,
      playerCount: 3,
      agentCount: 0,
      humanCount: 1,
      robotCount: 1,
      spectatorCount: 1,
      openSeats: false,
      status: GameStatus.WAITING_FOR_PLAYERS,
      timed: false,
    });
  });
});
