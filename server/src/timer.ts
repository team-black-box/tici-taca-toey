import {
  GameEngine,
  MessageTypes,
  PlayerTimeoutMessage,
  UpdateTimeMessage,
} from "./model";

import { TimerBase } from "../../shared/model";

export type { TimerBase };

const DEFAULT_TICK_MS = 250;
// Clients only need clock updates about once a second; timeouts are still
// detected at tick granularity.
const NOTIFY_EVERY_N_TICKS = 4;

export class Timer implements TimerBase {
  isRunning: boolean;
  timeLeft: number;
  #startTime: number;
  #intervalID: ReturnType<typeof setInterval> | undefined;
  #playerId: string;
  #gameId: string;
  #tickMs: number;
  #ticks: number;

  constructor(
    allotedTime: number,
    playerId: string,
    gameId: string,
    tickMs: number = DEFAULT_TICK_MS
  ) {
    this.#playerId = playerId;
    this.#gameId = gameId;
    this.#tickMs = tickMs;
    this.#ticks = 0;
    this.isRunning = false;
    this.#startTime = 0;
    this.timeLeft = allotedTime;
  }

  #getTimeElapsedSinceLastStart() {
    return this.#startTime === 0 ? 0 : Date.now() - this.#startTime;
  }

  start(engine: GameEngine) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.#startTime = Date.now();

    this.#intervalID = setInterval(() => {
      this.timeLeft = this.timeLeft - this.#getTimeElapsedSinceLastStart();
      this.#startTime = Date.now();
      this.#ticks++;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.stop(0); // no increment if the player timed out
        const playerTimeoutMessage: PlayerTimeoutMessage = {
          type: MessageTypes.PLAYER_TIMEOUT,
          gameId: this.#gameId,
          playerId: this.#playerId,
        };
        engine.play(playerTimeoutMessage);
        return;
      }
      if (this.#ticks % NOTIFY_EVERY_N_TICKS === 0) {
        const timeUpdateMessage: UpdateTimeMessage = {
          type: MessageTypes.NOTIFY_TIME,
          gameId: this.#gameId,
        };
        engine.play(timeUpdateMessage);
      }
    }, this.#tickMs);
  }

  stop(increment: number) {
    if (!this.isRunning) {
      return;
    }
    this.timeLeft = this.timeLeft - this.#getTimeElapsedSinceLastStart();
    this.timeLeft = this.timeLeft + increment;
    this.isRunning = false;
    if (this.#intervalID !== undefined) {
      clearInterval(this.#intervalID);
      this.#intervalID = undefined;
    }
  }

  // Halt the timer without adjusting the clock - used when a game completes
  // or is garbage collected, so no interval is ever left running.
  destroy() {
    this.isRunning = false;
    if (this.#intervalID !== undefined) {
      clearInterval(this.#intervalID);
      this.#intervalID = undefined;
    }
  }
}
