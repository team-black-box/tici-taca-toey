import { describe, expect, test } from "bun:test";
import TiciTacaToeyGameEngine, {
  isUsablePlayerKey,
} from "../src/TiciTacaToeyGameEngine";
import { Message, MessageTypes, PlayerConnection } from "../src/model";

// The playerKey is the only credential in the system. Clients that can
// generate one with real entropy do (the web uses crypto.randomUUID);
// clients that cannot - React Native has no CSPRNG - get one minted by
// the server rather than inventing a guessable one.

class FakeConnection implements PlayerConnection {
  messages: any[] = [];
  send(data: string) {
    this.messages.push(JSON.parse(data));
  }
  registrations() {
    return this.messages.filter(
      (each) => each.type === MessageTypes.REGISTER_PLAYER
    );
  }
  last() {
    return this.messages[this.messages.length - 1];
  }
}

describe("isUsablePlayerKey", () => {
  test("rejects what a client might send when it has no identity yet", () => {
    expect(isUsablePlayerKey(undefined)).toBe(false);
    expect(isUsablePlayerKey(null)).toBe(false);
    expect(isUsablePlayerKey("")).toBe(false);
    expect(isUsablePlayerKey("short")).toBe(false);
    expect(isUsablePlayerKey(12345678)).toBe(false);
    expect(isUsablePlayerKey("x".repeat(65))).toBe(false);
  });

  test("accepts a real key", () => {
    expect(isUsablePlayerKey(crypto.randomUUID())).toBe(true);
    expect(isUsablePlayerKey("x".repeat(8))).toBe(true);
    expect(isUsablePlayerKey("x".repeat(64))).toBe(true);
  });
});

describe("minted player keys", () => {
  test("mints a key with real entropy and hands back a stable playerId", () => {
    const engine = new TiciTacaToeyGameEngine();
    const minted = engine.mintPlayerKey("connection-scoped-id");

    expect(isUsablePlayerKey(minted.playerKey)).toBe(true);
    // A UUID, not a timestamp with Math.random glued on.
    expect(minted.playerKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(minted.playerId).toBe("connection-scoped-id");
  });

  test("every minted key is different", () => {
    const engine = new TiciTacaToeyGameEngine();
    const keys = new Set(
      Array.from({ length: 200 }, (_, index) =>
        engine.mintPlayerKey(`p${index}`).playerKey
      )
    );
    expect(keys.size).toBe(200);
  });

  test("the minted key resolves back to the same player", () => {
    const engine = new TiciTacaToeyGameEngine();
    const minted = engine.mintPlayerKey("first-connection");
    // A later socket presenting that key is the same player.
    expect(engine.resolvePlayerKey(minted.playerKey, "second-connection")).toBe(
      "first-connection"
    );
  });

  test("the key reaches the registering client, once", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const connection = new FakeConnection();
    const minted = engine.mintPlayerKey("alice");

    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Alice",
      playerId: minted.playerId,
      playerKey: minted.playerKey,
      connection,
    } as Message);

    expect(connection.registrations()[0].playerKey).toBe(minted.playerKey);

    // Drained: a re-registration must not echo the secret again.
    connection.messages = [];
    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Alice",
      playerId: minted.playerId,
      playerKey: minted.playerKey,
      connection,
    } as Message);
    expect(connection.registrations()[0].playerKey).toBeUndefined();
  });

  test("a client that brought its own key is never sent one", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const connection = new FakeConnection();
    const ownKey = crypto.randomUUID();
    const playerId = engine.resolvePlayerKey(ownKey, "web-player");

    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Web",
      playerId,
      playerKey: ownKey,
      connection,
    } as Message);

    expect(connection.registrations()[0].playerKey).toBeUndefined();
  });

  test("the secret never reaches anyone else", async () => {
    const engine = new TiciTacaToeyGameEngine();
    const host = new FakeConnection();
    const guest = new FakeConnection();
    const minted = engine.mintPlayerKey("host");

    await engine.play({
      type: MessageTypes.REGISTER_PLAYER,
      name: "Host",
      playerId: minted.playerId,
      playerKey: minted.playerKey,
      connection: host,
    } as Message);
    await engine.play({
      type: MessageTypes.START_GAME,
      name: "Game",
      boardSize: 3,
      playerCount: 2,
      gameId: "g1",
      playerId: minted.playerId,
      connection: host,
    } as Message);
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId: "g1",
      playerId: "guest",
      connection: guest,
    } as Message);

    // Nothing the other player ever received mentions the key.
    expect(JSON.stringify(guest.messages)).not.toContain(minted.playerKey);
  });
});
