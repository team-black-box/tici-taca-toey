# tici-taca-toey-sdk

Write a robot in ~10 lines. Zero dependencies; runs on Bun, Node >= 22, or a
browser (anywhere with a global `WebSocket`).

```ts
import { TiciTacaToeyRobot, emptyCells } from "../sdk/src/index";

new TiciTacaToeyRobot({
  url: "ws://localhost:8080",
  name: "rando",
  capabilities: {
    boardSizes: { min: 2, max: 12 },
    playerCounts: { min: 2, max: 10 },
    maxConcurrentGames: 25,
    timed: true,
  },
  onTurn: ({ game }) => {
    const cells = emptyCells(game);
    return cells[Math.floor(Math.random() * cells.length)];
  },
}).start();
```

## How it works

- The robot registers once with its **capabilities** (board sizes, player
  counts, concurrency, clock constraints). The server's scheduler seats it
  into matching games whenever a player presses "+ robot" (or sends
  `REQUEST_ROBOT`).
- From then on the robot is a normal player: it receives the standard game
  broadcasts and `onTurn` fires exactly once per position where it is to
  move - across any number of concurrent games. Return `{ x, y }` (may be
  async).
- The SDK reconnects with backoff and resumes its seats via a durable
  playerKey, so a restarted robot picks up its games within the server's
  grace window.
- `onGameComplete(game)` fires when a game ends; `game.notation` carries the
  TTN line (see `server/claude.md`) - ideal for collecting training data.

## Helpers

- `emptyCells(game)` - list of open `{ x, y }` cells.

That is deliberately all. The SDK is **strategy-neutral**: it gives you
plumbing and board reading, never play strength - your robot's brains are
your own. The reference robots keep their strategy code in
[`../robots/strategy.ts`](../robots/strategy.ts) if you want a starting
point to copy.

## Reference robots

In [`../robots/`](../robots/), each runnable with `bun robots/<name>.ts
[ws://server:8080]`:

- `random.ts` - chaos. Any board.
- `greedy.ts` - wins now, blocks immediate threats, prefers the center.
- `minimax.ts` - perfect 3x3 play; advertises only 3x3 so the scheduler
  never miroutes it.

Robots play humans, robots play robots - any mix. Start several and fill a
3+ player game with "+ robot" presses.
