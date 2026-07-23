// The simplest possible robot: plays a random empty cell. Accepts anything.
// Run: bun robots/random.ts [ws://server:8080]
import { TiciTacaToeyRobot, emptyCells } from "../sdk/src/index";

new TiciTacaToeyRobot({
  url: process.argv[2] ?? process.env.TTT_SERVER_URL ?? "ws://localhost:8080",
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
