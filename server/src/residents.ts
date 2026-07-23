// Resident robots: rando, greedo, and minnie-max living inside the server
// process as in-memory PlayerConnections, so "+ robot" always answers on
// every instance with zero external infrastructure. External SDK robots
// remain first-class and identical in protocol.
//
// Strategy code is intentionally self-contained here (server/src is the
// whole Docker build context and must not reach into robots/ or sdk/).
import {
  Game,
  GameStatus,
  MessageTypes,
  PlayerConnection,
  RobotCapabilities,
} from "./model";
import { countSequences, ownerOfSeat, teamOfSeat } from "./rules";
import type TiciTacaToeyGameEngine from "./TiciTacaToeyGameEngine";

const EMPTY = "-";

interface Move {
  x: number;
  y: number;
}

const emptyCells = (game: Game): Move[] => {
  const cells: Move[] = [];
  game.positions.forEach((row, x) =>
    row.forEach((cell, y) => {
      if (cell === EMPTY) {
        cells.push({ x, y });
      }
    })
  );
  return cells;
};

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// Same side as `playerId`: their team in a team game, else just them.
const alliesOf = (game: Game, playerId: string): ((value: string) => boolean) =>
  ownerOfSeat(game.players, game.players.indexOf(playerId), game.teamCount);

const isVariant = (game: Game): boolean =>
  game.winningSequenceCount > 1 || game.teamCount > 0;

const isWinningPlacement = (
  game: Game,
  playerId: string,
  move: Move
): boolean => {
  // Classic games: a win must run through the new mark, so scan only the
  // four lines through it - O(4 * winLen).
  if (!isVariant(game)) {
    const size = game.boardSize;
    const at = (x: number, y: number): string =>
      x === move.x && y === move.y ? playerId : game.positions[x][y];
    for (const [dx, dy] of DIRECTIONS) {
      let run = 1;
      for (const sign of [1, -1] as const) {
        let x = move.x + dx * sign;
        let y = move.y + dy * sign;
        while (
          x >= 0 &&
          x < size &&
          y >= 0 &&
          y < size &&
          at(x, y) === playerId
        ) {
          run++;
          x += dx * sign;
          y += dy * sign;
        }
      }
      if (run >= game.winningSequenceLength) {
        return true;
      }
    }
    return false;
  }
  // Variants: teammates' marks count too, and the bar is the required
  // number of sequences - the same rules the engine settles with.
  const previous = game.positions[move.x][move.y];
  game.positions[move.x][move.y] = playerId;
  const { count } = countSequences(
    game.positions,
    game.winningSequenceLength,
    alliesOf(game, playerId)
  );
  game.positions[move.x][move.y] = previous;
  return count >= game.winningSequenceCount;
};

const findWinningMove = (game: Game, playerId: string): Move | null => {
  for (const move of emptyCells(game)) {
    if (isWinningPlacement(game, playerId, move)) {
      return move;
    }
  }
  return null;
};

// --- the three residents ---

const randomMove = (game: Game): Move => {
  const cells = emptyCells(game);
  return cells[Math.floor(Math.random() * cells.length)];
};

const greedyMove = (game: Game, you: string): Move => {
  const winNow = findWinningMove(game, you);
  if (winNow) {
    return winNow;
  }
  // Block opponents - never a teammate, whose threat is our own win.
  const myTeam = teamOfSeat(game.players.indexOf(you), game.teamCount);
  for (const opponent of game.players) {
    const sameSide =
      game.teamCount > 0
        ? teamOfSeat(game.players.indexOf(opponent), game.teamCount) === myTeam
        : opponent === you;
    if (sameSide) {
      continue;
    }
    const threat = findWinningMove(game, opponent);
    if (threat) {
      return threat;
    }
  }
  const center = (game.boardSize - 1) / 2;
  return emptyCells(game).reduce((best, cell) => {
    const score = (move: Move) =>
      Math.abs(move.x - center) + Math.abs(move.y - center);
    return score(cell) < score(best) ? cell : best;
  });
};

const minimaxMemo = new Map<string, number>();

const minimaxMove = (game: Game, you: string): Move => {
  const opponent = game.players.find((player) => player !== you) as string;
  const key = () =>
    game.positions
      .flat()
      .map((cell) => (cell === EMPTY ? "." : cell === you ? "A" : "B"))
      .join("");
  const score = (toMove: string, depth: number): number => {
    const k = `${key()}:${toMove === you ? "A" : "B"}`;
    const cached = minimaxMemo.get(k);
    if (cached !== undefined) {
      return cached;
    }
    const cells = emptyCells(game);
    if (cells.length === 0) {
      return 0;
    }
    let best = toMove === you ? -Infinity : Infinity;
    for (const move of cells) {
      let value: number;
      if (isWinningPlacement(game, toMove, move)) {
        value = toMove === you ? 10 - depth : depth - 10;
      } else {
        game.positions[move.x][move.y] = toMove;
        value = score(toMove === you ? opponent : you, depth + 1);
        game.positions[move.x][move.y] = EMPTY;
      }
      best = toMove === you ? Math.max(best, value) : Math.min(best, value);
    }
    minimaxMemo.set(k, best);
    return best;
  };
  let bestMove: Move | null = null;
  let bestScore = -Infinity;
  for (const move of emptyCells(game)) {
    let value: number;
    if (isWinningPlacement(game, you, move)) {
      value = 10;
    } else {
      game.positions[move.x][move.y] = you;
      value = score(opponent, 1);
      game.positions[move.x][move.y] = EMPTY;
    }
    if (value > bestScore) {
      bestScore = value;
      bestMove = move;
    }
  }
  return bestMove as Move;
};

interface ResidentSpec {
  name: string;
  capabilities: RobotCapabilities;
  chooseMove: (game: Game, you: string) => Move;
}

const RESIDENTS: ResidentSpec[] = [
  {
    name: "rando",
    capabilities: {
      boardSizes: { min: 2, max: 12 },
      playerCounts: { min: 2, max: 10 },
      maxConcurrentGames: 50,
      timed: true,
    },
    chooseMove: (game) => randomMove(game),
  },
  {
    name: "greedo",
    capabilities: {
      boardSizes: { min: 2, max: 12 },
      playerCounts: { min: 2, max: 10 },
      maxConcurrentGames: 50,
      timed: true,
    },
    chooseMove: greedyMove,
  },
  {
    name: "minnie-max",
    capabilities: {
      boardSizes: { min: 3, max: 3 },
      playerCounts: { min: 2, max: 2 },
      maxConcurrentGames: 50,
      timed: true,
      minTimePerPlayer: 10_000,
    },
    chooseMove: minimaxMove,
  },
];

export interface ResidentOptions {
  // Human-feeling move pacing; tests pass () => 0.
  moveDelayMs?: () => number;
}

export const startResidents = (
  engine: TiciTacaToeyGameEngine,
  options: ResidentOptions = {}
) => {
  const delay = options.moveDelayMs ?? (() => 400 + Math.random() * 300);

  RESIDENTS.forEach((spec) => {
    const playerId = `resident-${spec.name}`;
    // One acted-position marker per game prevents double moves when clock
    // updates rebroadcast the same board.
    const acted = new Map<string, string>();

    const connection: PlayerConnection = {
      send(data: string) {
        try {
          const message = JSON.parse(String(data)) as {
            game?: Game;
          };
          const game = message.game;
          if (!game || !game.gameId) {
            return;
          }
          if (game.status !== GameStatus.GAME_IN_PROGRESS) {
            acted.delete(game.gameId);
            return;
          }
          if (game.turn !== playerId || !game.players.includes(playerId)) {
            return;
          }
          if (acted.get(game.gameId) === game.moveLog) {
            return;
          }
          acted.set(game.gameId, game.moveLog);
          const move = spec.chooseMove(
            // deep-copy positions: strategies may scratch on the board
            { ...game, positions: game.positions.map((row) => [...row]) },
            playerId
          );
          setTimeout(() => {
            engine.play({
              type: MessageTypes.MAKE_MOVE,
              gameId: game.gameId,
              coordinateX: move.x,
              coordinateY: move.y,
              playerId,
            });
          }, delay());
        } catch (error) {
          console.error(`Resident ${spec.name} failed to act`, error);
        }
      },
    };

    engine
      .play({
        type: MessageTypes.REGISTER_ROBOT,
        name: spec.name,
        capabilities: spec.capabilities,
        playerId,
        connection,
      })
      .then(() => {
        // Claim the name as a handle so leaderboards show who beat you.
        engine.play({
          type: MessageTypes.CLAIM_HANDLE,
          handle: spec.name,
          playerId,
          connection,
        });
      });
  });
};
