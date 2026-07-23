import { describe, expect, test } from "bun:test";
import { Timer } from "../src/timer";
import { GameEngine, Message, MessageTypes } from "../src/model";

// Captures messages the timer dispatches into the engine.
const makeEngineRecorder = () => {
  const played: Message[] = [];
  const engine = {
    play: (message: Message) => {
      played.push(message);
      return Promise.resolve(engine as unknown as GameEngine);
    },
  } as unknown as GameEngine;
  return { engine, played };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Timer", () => {
  test("counts down while running and stops with an increment", async () => {
    const { engine } = makeEngineRecorder();
    const timer = new Timer(10_000, "alice", "g1", 10);
    timer.start(engine);
    await sleep(60);
    timer.stop(500);
    expect(timer.isRunning).toBe(false);
    expect(timer.timeLeft).toBeLessThan(10_500);
    expect(timer.timeLeft).toBeGreaterThan(10_000); // increment outweighs ~60ms elapsed
    const settled = timer.timeLeft;
    await sleep(30);
    expect(timer.timeLeft).toBe(settled); // fully stopped, no drift
  });

  test("dispatches PLAYER_TIMEOUT exactly once when time runs out", async () => {
    const { engine, played } = makeEngineRecorder();
    const timer = new Timer(30, "alice", "g1", 10);
    timer.start(engine);
    await sleep(120);
    const timeouts = played.filter(
      (each) => each.type === MessageTypes.PLAYER_TIMEOUT
    );
    expect(timeouts.length).toBe(1);
    expect(timeouts[0]).toMatchObject({ gameId: "g1", playerId: "alice" });
    expect(timer.isRunning).toBe(false);
    expect(timer.timeLeft).toBe(0);
  });

  test("starting twice does not double-run, destroy halts everything", async () => {
    const { engine, played } = makeEngineRecorder();
    const timer = new Timer(10_000, "alice", "g1", 10);
    timer.start(engine);
    timer.start(engine);
    await sleep(30);
    timer.destroy();
    const countAfterDestroy = played.length;
    await sleep(40);
    expect(played.length).toBe(countAfterDestroy);
    expect(timer.isRunning).toBe(false);
  });
});
