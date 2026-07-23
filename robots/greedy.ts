// A simple heuristic robot: win now if possible, otherwise block an
// opponent's immediate win, otherwise take the most central empty cell.
// Run: bun robots/greedy.ts [ws://server:8080]
import { TiciTacaToeyRobot, emptyCells } from "../sdk/src/index";
import { findWinningMove, isSameSide } from "./strategy";

new TiciTacaToeyRobot({
  url: process.argv[2] ?? process.env.TTT_SERVER_URL ?? "ws://localhost:8080",
  name: "greedo",
  capabilities: {
    boardSizes: { min: 2, max: 12 },
    playerCounts: { min: 2, max: 10 },
    maxConcurrentGames: 25,
    timed: true,
  },
  onTurn: ({ game, you }) => {
    const winNow = findWinningMove(game, you);
    if (winNow) {
      return winNow;
    }
    // Block opponents only - a teammate's winning move is our own win.
    for (const opponent of game.players) {
      if (isSameSide(game, you, opponent)) {
        continue;
      }
      const threat = findWinningMove(game, opponent);
      if (threat) {
        return threat;
      }
    }
    const center = (game.boardSize - 1) / 2;
    return emptyCells(game).reduce((best, cell) => {
      const score = (move: { x: number; y: number }) =>
        Math.abs(move.x - center) + Math.abs(move.y - center);
      return score(cell) < score(best) ? cell : best;
    });
  },
}).start();
