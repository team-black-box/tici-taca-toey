#!/usr/bin/env bun
// The learning path, step two: play the learned policy as a robot.
//
//   bun playground/train.ts            # writes playground/policy.json
//   bun playground/learner.ts          # seats "cloney" on ws://localhost:8080
//   bun playground/learner.ts <url> [policy.json]
//
// The learner is a plain SDK robot: it advertises only the configuration it
// was trained on, looks each position up through the same canonical encoding
// the trainer used, and falls back to a random legal move on states it has
// never seen. Play it via "+ robot" in the web app - pick "cloney".
import { readFileSync } from "node:fs";
import { TiciTacaToeyRobot, emptyCells } from "../sdk/src/index";
import { PolicyFile, pickMove } from "./policy";

const policyPath =
  process.argv[3] ?? new URL("policy.json", import.meta.url).pathname;

let policy: PolicyFile;
try {
  policy = JSON.parse(readFileSync(policyPath, "utf8"));
} catch {
  console.error(`no policy at ${policyPath}`);
  console.error("train one first: bun playground/train.ts");
  process.exit(1);
}

console.log(
  `policy: ${policy.states} states from ${policy.games} games (${policy.generatedAt})`
);

new TiciTacaToeyRobot({
  url: process.argv[2] ?? process.env.TTT_SERVER_URL ?? "ws://localhost:8080",
  name: "cloney",
  capabilities: {
    boardSizes: { min: policy.boardSize, max: policy.boardSize },
    playerCounts: { min: policy.playerCount, max: policy.playerCount },
    maxConcurrentGames: 10,
    timed: true,
  },
  onTurn: ({ game, you }) => {
    const seats = game.positions.map((row) =>
      row.map((cell) => (cell === "-" ? -1 : game.players.indexOf(cell)))
    );
    const learned = pickMove(policy, seats, game.players.indexOf(you));
    if (learned) {
      return learned;
    }
    const cells = emptyCells(game);
    return cells[Math.floor(Math.random() * cells.length)];
  },
}).start();
