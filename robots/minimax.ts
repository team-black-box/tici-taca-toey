// Perfect play for classic 3x3 two-player games via memoized minimax. It
// only advertises 3x3/2-player capability, so the scheduler never routes it
// anywhere it cannot play perfectly.
// Run: bun robots/minimax.ts [ws://server:8080]
import {
  TiciTacaToeyRobot,
  emptyCells,
  GameView,
  Move,
} from "../sdk/src/index";
import { isWinningPlacement } from "./strategy";

const memo = new Map<string, number>();

const boardKey = (game: GameView, you: string): string =>
  game.positions
    .flat()
    .map((cell) => (cell === "-" ? "." : cell === you ? "A" : "B"))
    .join("");

// Score from "you"'s perspective: positive = winning, prefer faster wins.
const minimax = (
  game: GameView,
  you: string,
  opponent: string,
  toMove: string,
  depth: number
): number => {
  const key = `${boardKey(game, you)}:${toMove === you ? "A" : "B"}`;
  const cached = memo.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const cells = emptyCells(game);
  if (cells.length === 0) {
    return 0;
  }
  let best = toMove === you ? -Infinity : Infinity;
  for (const move of cells) {
    let score: number;
    if (isWinningPlacement(game, toMove, move)) {
      score = toMove === you ? 10 - depth : depth - 10;
    } else {
      game.positions[move.x][move.y] = toMove;
      score = minimax(
        game,
        you,
        opponent,
        toMove === you ? opponent : you,
        depth + 1
      );
      game.positions[move.x][move.y] = "-";
    }
    best = toMove === you ? Math.max(best, score) : Math.min(best, score);
  }
  memo.set(key, best);
  return best;
};

new TiciTacaToeyRobot({
  url: process.argv[2] ?? process.env.TTT_SERVER_URL ?? "ws://localhost:8080",
  name: "minnie-max",
  capabilities: {
    boardSizes: { min: 3, max: 3 },
    playerCounts: { min: 2, max: 2 },
    maxConcurrentGames: 25,
    timed: true,
    minTimePerPlayer: 10_000,
  },
  onTurn: ({ game, you }) => {
    const opponent = game.players.find((player) => player !== you) as string;
    let bestMove: Move | null = null;
    let bestScore = -Infinity;
    for (const move of emptyCells(game)) {
      let score: number;
      if (isWinningPlacement(game, you, move)) {
        score = 10;
      } else {
        game.positions[move.x][move.y] = you;
        score = minimax(game, you, opponent, opponent, 1);
        game.positions[move.x][move.y] = "-";
      }
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove as Move;
  },
}).start();
