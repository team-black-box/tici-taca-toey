#!/usr/bin/env bun
// The learning path, step one: behavior cloning from TTN game records.
//
//   bun playground/train.ts                       # data/games.ttn + self-play
//   bun playground/train.ts --selfplay 8000       # generate fresh games too
//   bun playground/train.ts --ttn data/games.ttn  # train from a TTN file
//   bun playground/train.ts --eval 500            # evaluation games per rival
//
// The trainer replays finished games (recorded lines and/or fresh self-play
// through the real engine - the same code that runs production), collects
// "in this position, the eventual winner played here" counts, and writes the
// majority vote per canonical state to playground/policy.json. learner.ts
// then plays that table as a robot. No frameworks, no gradients - the
// simplest thing that genuinely learns from data.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import TiciTacaToeyGameEngine from "../server/src/TiciTacaToeyGameEngine";
import { decodeGame } from "../server/src/notation";
import {
  Game,
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
} from "../server/src/model";
import { GameView } from "../sdk/src/index";
import { findWinningMove } from "../robots/strategy";
import {
  Move,
  PolicyFile,
  canonicalize,
  cellInFrame,
  pickMove,
} from "./policy";

// v1 scope: classic 3x3, two players. The encoding generalizes; the
// training data is what doesn't yet.
const BOARD_SIZE = 3;
const WINNING_SEQUENCE_LENGTH = 3;
const PLAYER_COUNT = 2;
const WIN_WEIGHT = 2;
const DRAW_WEIGHT = 1;
const DEFAULT_SELFPLAY_GAMES = 6000;
const DEFAULT_EVAL_GAMES = 400;
const TEACHER_MIX = 0.5;

const args = process.argv.slice(2);
const flagValue = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const ttnPath =
  flagValue("ttn") ?? new URL("../data/games.ttn", import.meta.url).pathname;
const outPath =
  flagValue("out") ?? new URL("policy.json", import.meta.url).pathname;
const selfplayGames = Number(
  flagValue("selfplay") ?? DEFAULT_SELFPLAY_GAMES
);
const evalGames = Number(flagValue("eval") ?? DEFAULT_EVAL_GAMES);

// --- playing games through the real engine ---------------------------------

type Chooser = (game: Game, seat: number) => Move;

const silentConnection: PlayerConnection = { send: () => {} };
let gameSequence = 0;

const emptyCellsOf = (game: Game): Move[] =>
  game.positions.flatMap((row, x) =>
    row.reduce<Move[]>((cells, cell, y) => {
      if (cell === "-") {
        cells.push({ x, y });
      }
      return cells;
    }, [])
  );

const randomChooser: Chooser = (game) => {
  const cells = emptyCellsOf(game);
  return cells[Math.floor(Math.random() * cells.length)];
};

// Win now, else block, else random - the same heuristic as robots/greedy.ts.
const greedyChooser: Chooser = (game, seat) => {
  const view = game as unknown as GameView;
  const you = game.players[seat];
  const winNow = findWinningMove(view, you);
  if (winNow) {
    return winNow;
  }
  for (const opponent of game.players) {
    if (opponent !== you) {
      const threat = findWinningMove(view, opponent);
      if (threat) {
        return threat;
      }
    }
  }
  return randomChooser(game, seat);
};

const policyChooser = (policy: PolicyFile): Chooser => (game, seat) => {
  const seats = game.positions.map((row) =>
    row.map((cell) => (cell === "-" ? -1 : game.players.indexOf(cell)))
  );
  return pickMove(policy, seats, seat) ?? randomChooser(game, seat);
};

// Run one full game through the engine and return its TTN line.
const runGame = async (choosers: Chooser[]): Promise<string | undefined> => {
  const engine = new TiciTacaToeyGameEngine();
  const gameId = `lab-${gameSequence++}`;
  await engine.play({
    type: MessageTypes.START_GAME,
    name: "lab",
    boardSize: BOARD_SIZE,
    playerCount: PLAYER_COUNT,
    winningSequenceLength: WINNING_SEQUENCE_LENGTH,
    gameId,
    playerId: "seat-0",
    connection: silentConnection,
  } as Message);
  for (let seat = 1; seat < PLAYER_COUNT; seat++) {
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId,
      playerId: `seat-${seat}`,
      connection: silentConnection,
    } as Message);
  }
  let guard = BOARD_SIZE * BOARD_SIZE + 1;
  while (
    engine.games[gameId]?.status === GameStatus.GAME_IN_PROGRESS &&
    guard-- > 0
  ) {
    const game = engine.games[gameId];
    const seat = game.players.indexOf(game.turn);
    const move = choosers[seat](game, seat);
    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId,
      coordinateX: move.x,
      coordinateY: move.y,
      playerId: game.turn,
    } as Message);
  }
  return engine.games[gameId]?.notation;
};

// --- training --------------------------------------------------------------

const counts = new Map<string, Map<number, number>>();
let trainedGames = 0;

// Replay one TTN line; count winners' moves (and both sides of a draw,
// half-weighted) per canonical state.
const trainOnLine = (line: string): boolean => {
  let decoded;
  try {
    decoded = decodeGame(line.trim());
  } catch {
    return false;
  }
  if (
    decoded.boardSize !== BOARD_SIZE ||
    decoded.winningSequenceLength !== WINNING_SEQUENCE_LENGTH ||
    decoded.playerCount !== PLAYER_COUNT ||
    decoded.result.kind === "abandoned"
  ) {
    return false;
  }
  const winnerSeat =
    decoded.result.kind === "draw" ? -1 : decoded.result.winnerSeat!;
  const seats: number[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(-1)
  );
  for (const move of decoded.moves) {
    if (move.skip) {
      continue;
    }
    const weight =
      winnerSeat === -1
        ? DRAW_WEIGHT
        : move.seat === winnerSeat
        ? WIN_WEIGHT
        : 0;
    if (weight > 0) {
      const { key, transform } = canonicalize(seats, move.seat, PLAYER_COUNT);
      const cell = cellInFrame(transform, move, BOARD_SIZE);
      const cellCounts = counts.get(key) ?? new Map<number, number>();
      cellCounts.set(cell, (cellCounts.get(cell) ?? 0) + weight);
      counts.set(key, cellCounts);
    }
    seats[move.x][move.y] = move.seat;
  }
  trainedGames++;
  return true;
};

// --- evaluation ------------------------------------------------------------

const evaluate = async (
  policy: Chooser,
  rival: Chooser,
  games: number
): Promise<{ wins: number; draws: number; losses: number }> => {
  const record = { wins: 0, draws: 0, losses: 0 };
  for (let index = 0; index < games; index++) {
    const policySeat = index % PLAYER_COUNT;
    const choosers = Array.from({ length: PLAYER_COUNT }, (_, seat) =>
      seat === policySeat ? policy : rival
    );
    const notation = await runGame(choosers);
    if (!notation) {
      continue;
    }
    const result = decodeGame(notation).result;
    if (result.kind === "draw") {
      record.draws++;
    } else if (result.winnerSeat === policySeat) {
      record.wins++;
    } else {
      record.losses++;
    }
  }
  return record;
};

const percent = (part: number, total: number): string =>
  `${((part / Math.max(total, 1)) * 100).toFixed(1)}%`;

const reportLine = (
  label: string,
  record: { wins: number; draws: number; losses: number },
  games: number
): string =>
  `  vs ${label.padEnd(7)} W ${percent(record.wins, games)}  D ${percent(
    record.draws,
    games
  )}  L ${percent(record.losses, games)}  (${games} games)`;

// --- main ------------------------------------------------------------------

const main = async () => {
  console.log("tici-taca-toey playground - behavior cloning trainer");
  console.log(
    `config ${BOARD_SIZE}x${BOARD_SIZE}, win ${WINNING_SEQUENCE_LENGTH}, players ${PLAYER_COUNT}`
  );

  let recordedLines = 0;
  if (existsSync(ttnPath)) {
    const lines = readFileSync(ttnPath, "utf8").split("\n");
    recordedLines = lines.filter(trainOnLine).length;
    console.log(
      `recorded games: ${recordedLines} usable of ${
        lines.filter((line) => line.trim() !== "").length
      } in ${ttnPath}`
    );
  } else {
    console.log(`recorded games: none (${ttnPath} not found)`);
  }

  if (selfplayGames > 0) {
    console.log(
      `self-play: generating ${selfplayGames} games (${Math.round(
        TEACHER_MIX * 100
      )}% greedy teachers, rest random)...`
    );
    for (let index = 0; index < selfplayGames; index++) {
      const choosers = Array.from({ length: PLAYER_COUNT }, () =>
        Math.random() < TEACHER_MIX ? greedyChooser : randomChooser
      );
      const notation = await runGame(choosers);
      if (notation) {
        trainOnLine(notation);
      }
    }
  }

  const entries: Record<string, number> = {};
  counts.forEach((cellCounts, key) => {
    let bestCell = -1;
    let bestWeight = -1;
    cellCounts.forEach((weight, cell) => {
      if (weight > bestWeight || (weight === bestWeight && cell < bestCell)) {
        bestCell = cell;
        bestWeight = weight;
      }
    });
    entries[key] = bestCell;
  });

  const policy: PolicyFile = {
    generatedAt: new Date().toISOString(),
    boardSize: BOARD_SIZE,
    winningSequenceLength: WINNING_SEQUENCE_LENGTH,
    playerCount: PLAYER_COUNT,
    games: trainedGames,
    states: Object.keys(entries).length,
    entries,
  };
  writeFileSync(outPath, JSON.stringify(policy));
  console.log(
    `trained on ${trainedGames} games -> ${policy.states} canonical states -> ${outPath}`
  );

  if (evalGames > 0) {
    console.log("evaluating...");
    const learned = policyChooser(policy);
    const vsRandom = await evaluate(learned, randomChooser, evalGames);
    const vsGreedy = await evaluate(learned, greedyChooser, evalGames);
    console.log(reportLine("random", vsRandom, evalGames));
    console.log(reportLine("greedy", vsGreedy, evalGames));
    console.log(
      "next: bun playground/learner.ts - seats this policy on your dev server"
    );
  }
};

main();
