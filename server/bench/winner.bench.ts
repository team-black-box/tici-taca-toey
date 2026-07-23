// Micro-benchmark for the winner calculation - the hot path of the engine.
// Run with: bun run bench
import { calculateWinner } from "../src/TiciTacaToeyGameEngine";

const SIZE = 12;
const SEQ = 12;
const ITERATIONS = 1_000_000;

// Worst case: a full 12x12 board of one player, requiring the longest
// possible scan in all four directions from the centre.
const positions = Array.from({ length: SIZE }, () =>
  Array.from({ length: SIZE }, () => "x")
);
const input = {
  positions,
  winningSequenceLength: SEQ,
  lastTurnPlayerId: "x",
  lastTurnPosition: { x: 6, y: 6 },
};

// warm up
for (let i = 0; i < 10_000; i++) {
  calculateWinner(input);
}

const start = Bun.nanoseconds();
for (let i = 0; i < ITERATIONS; i++) {
  calculateWinner(input);
}
const elapsedMs = (Bun.nanoseconds() - start) / 1_000_000;

console.log(
  `calculateWinner worst case (12x12, seq 12): ${ITERATIONS.toLocaleString()} calls in ${elapsedMs.toFixed(
    0
  )}ms -> ${Math.round((ITERATIONS / elapsedMs) * 1000).toLocaleString()} ops/sec`
);
