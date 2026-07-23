// TTN - tici-taca-toey notation. One short ASCII line per game, lossless,
// built for cheap retention of game data (and eventually model training).
//
//   v1 (untimed): <1>.<size>.<winLen>.<players>.<time>.<moves>.<result>
//   v2 (timed):   <2>.<size>.<winLen>.<players>.<time>.<moves>.<result>.<clocks>
//   v3 (variants): <3>.<size>.<winLen>.<seqCount>.<players>.<teams>.<time>.<moves>.<result>[.<clocks>]
//
//   version  "1" | "2" | "3"
//   size     board size, base 10
//   winLen   winning sequence length, base 10
//   seqCount (v3) sequences required to win, base 10 (v1/v2 imply 1)
//   players  player count, base 10
//   teams    (v3) team count, base 10, 0 = no teams (v1/v2 imply 0).
//            Team of a seat is seat % teams.
//   time     "u" untimed | "t<msBase36>+<msBase36>" timed (time, increment)
//   moves    chronological fixed-width tokens: 2-char base36 cell where
//            cell = x * size + y, or "--" when a seat is skipped (timed-out
//            player in a 3+ player game). Mover implied by rotation.
//   result   "w<i>" win | "t<i>" win by timeout | "d" draw | "a" abandoned
//            (i = seat index of the winner, base 10; in a team game the
//            seat's team is the winner)
//
//   clocks   (timed games) per-move thinking time: fixed-width 3-char
//            base36 deciseconds, one token per moves token ("000" for
//            skips). 3 chars cover ~78 min, beyond the 60-min clock cap.
//
// Classic games still emit v1/v2 so the corpus format stays stable; v3
// appears only when a game uses sequence counts > 1 or teams.
//
// Examples:
//   1.3.3.2.u.0003010402.w0            (untimed)
//   2.3.3.2.t1aa0+rs.0003.a.00d005     (timed, with clock track)
//   3.12.2.4.4.2.u.<moves>.w2          (12x12, four len-2 sequences, 2 teams)

import { Game, GameStatus } from "./model";

export const SKIP_TOKEN = "--";
const TOKEN_WIDTH = 2;
const CLOCK_TOKEN_WIDTH = 3;
export const SKIP_CLOCK_TOKEN = "000";
const EMPTY_POSITION = "-";

// Thinking time in deciseconds, clamped into the 3-char base36 range.
export const encodeClock = (elapsedMs: number): string =>
  Math.min(Math.max(Math.round(elapsedMs / 100), 0), 36 ** 3 - 1)
    .toString(36)
    .padStart(CLOCK_TOKEN_WIDTH, "0");

export const encodeCell = (x: number, y: number, size: number): string =>
  (x * size + y).toString(36).padStart(TOKEN_WIDTH, "0");

const encodeTime = (game: Game): string =>
  game.timed
    ? `t${game.timePerPlayer.toString(36)}+${game.incrementPerPlayer.toString(36)}`
    : "u";

const encodeResult = (game: Game): string => {
  switch (game.status) {
    case GameStatus.GAME_WON:
      return `w${game.players.indexOf(game.winner)}`;
    case GameStatus.GAME_WON_BY_TIMEOUT:
      return `t${game.players.indexOf(game.winner)}`;
    case GameStatus.GAME_ENDS_IN_A_DRAW:
      return "d";
    default:
      return "a";
  }
};

export const encodeGame = (game: Game): string => {
  const variant = game.winningSequenceCount > 1 || game.teamCount > 0;
  const fields: Array<string | number> = variant
    ? [
        "3",
        game.boardSize,
        game.winningSequenceLength,
        game.winningSequenceCount,
        game.playerCount,
        game.teamCount,
        encodeTime(game),
        game.moveLog,
        encodeResult(game),
      ]
    : [
        game.timed ? "2" : "1",
        game.boardSize,
        game.winningSequenceLength,
        game.playerCount,
        encodeTime(game),
        game.moveLog,
        encodeResult(game),
      ];
  if (game.timed) {
    fields.push(game.clockLog);
  }
  return fields.join(".");
};

export interface DecodedMove {
  seat: number;
  x: number;
  y: number;
  skip: boolean;
  // Thinking time for this move in ms (0 for skips and for v1 lines).
  clockMs: number;
}

export interface DecodedGame {
  version: number;
  boardSize: number;
  winningSequenceLength: number;
  winningSequenceCount: number;
  playerCount: number;
  // 0 = no teams; else team of a seat is seat % teamCount.
  teamCount: number;
  timed: boolean;
  timePerPlayer: number;
  incrementPerPlayer: number;
  moves: DecodedMove[];
  result: {
    kind: "win" | "timeout" | "draw" | "abandoned";
    winnerSeat?: number;
    // The winning seat's team, in team games.
    winnerTeam?: number;
  };
  // Final board, seats as base-10 strings ("0".."9"), "-" empty.
  positions: string[][];
}

const fail = (reason: string): never => {
  throw new Error(`Invalid TTN line: ${reason}`);
};

export const decodeGame = (line: string): DecodedGame => {
  const parts = line.trim().split(".");
  const version = parts[0];
  if (version !== "1" && version !== "2" && version !== "3") {
    fail(`unsupported version ${version}`);
  }
  // v3 carries seqCount and teams fields and appends clocks only when
  // timed; v1/v2 imply seqCount 1 and no teams.
  let sizeRaw: string;
  let winLenRaw: string;
  let seqCountRaw = "1";
  let playersRaw: string;
  let teamsRaw = "0";
  let timeRaw: string;
  let movesRaw: string;
  let resultRaw: string;
  let clocksRaw = "";
  if (version === "3") {
    if (parts.length !== 9 && parts.length !== 10) {
      fail(`expected 9 or 10 fields, got ${parts.length}`);
    }
    [, sizeRaw, winLenRaw, seqCountRaw, playersRaw, teamsRaw, timeRaw, movesRaw, resultRaw] =
      parts;
    clocksRaw = parts[9] ?? "";
  } else {
    const expectedFields = version === "1" ? 7 : 8;
    if (parts.length !== expectedFields) {
      fail(`expected ${expectedFields} fields, got ${parts.length}`);
    }
    [, sizeRaw, winLenRaw, playersRaw, timeRaw, movesRaw, resultRaw] = parts;
    clocksRaw = version === "2" ? parts[7] : "";
  }
  const boardSize = Number(sizeRaw);
  const winningSequenceLength = Number(winLenRaw);
  const winningSequenceCount = Number(seqCountRaw);
  const playerCount = Number(playersRaw);
  const teamCount = Number(teamsRaw);
  if (
    !Number.isInteger(boardSize) ||
    boardSize < 2 ||
    boardSize > 12 ||
    !Number.isInteger(winningSequenceLength) ||
    winningSequenceLength < 2 ||
    winningSequenceLength > boardSize ||
    !Number.isInteger(playerCount) ||
    playerCount < 2 ||
    playerCount > 10
  ) {
    fail(`bad configuration ${sizeRaw}/${winLenRaw}/${playersRaw}`);
  }
  if (
    !Number.isInteger(winningSequenceCount) ||
    winningSequenceCount < 1 ||
    winningSequenceCount > 99
  ) {
    fail(`bad sequence count ${seqCountRaw}`);
  }
  if (
    !Number.isInteger(teamCount) ||
    teamCount < 0 ||
    teamCount === 1 ||
    (teamCount > 0 &&
      (playerCount % teamCount !== 0 || teamCount > playerCount / 2))
  ) {
    fail(`bad team count ${teamsRaw}`);
  }

  let timed = false;
  let timePerPlayer = 0;
  let incrementPerPlayer = 0;
  if (timeRaw !== "u") {
    const match = /^t([0-9a-z]+)\+([0-9a-z]+)$/.exec(timeRaw);
    if (!match) {
      fail(`bad time field ${timeRaw}`);
    } else {
      timed = true;
      timePerPlayer = parseInt(match[1], 36);
      incrementPerPlayer = parseInt(match[2], 36);
    }
  }

  if (movesRaw.length % TOKEN_WIDTH !== 0) {
    fail("moves field is not token aligned");
  }
  const hasClocks = version === "2" || (version === "3" && timed);
  if (version === "2" && !timed) {
    fail("v2 lines must carry a timed configuration");
  }
  if (version === "3" && timed !== (parts.length === 10)) {
    fail("clock track must be present exactly when the game is timed");
  }
  if (hasClocks) {
    if (
      clocksRaw.length !== (movesRaw.length / TOKEN_WIDTH) * CLOCK_TOKEN_WIDTH ||
      !/^[0-9a-z]*$/.test(clocksRaw)
    ) {
      fail("clock track does not match the move count");
    }
  }

  const positions: string[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => EMPTY_POSITION)
  );
  const moves: DecodedMove[] = [];
  for (let i = 0; i < movesRaw.length; i += TOKEN_WIDTH) {
    const token = movesRaw.slice(i, i + TOKEN_WIDTH);
    const seat = moves.length % playerCount;
    const clockMs =
      hasClocks
        ? parseInt(
            clocksRaw.slice(
              moves.length * CLOCK_TOKEN_WIDTH,
              (moves.length + 1) * CLOCK_TOKEN_WIDTH
            ),
            36
          ) * 100
        : 0;
    if (token === SKIP_TOKEN) {
      moves.push({ seat, x: -1, y: -1, skip: true, clockMs: 0 });
      continue;
    }
    if (!/^[0-9a-z]{2}$/.test(token)) {
      fail(`bad move token ${token}`);
    }
    const cell = parseInt(token, 36);
    if (cell < 0 || cell >= boardSize * boardSize) {
      fail(`cell ${token} outside a ${boardSize}x${boardSize} board`);
    }
    const x = Math.floor(cell / boardSize);
    const y = cell % boardSize;
    if (positions[x][y] !== EMPTY_POSITION) {
      fail(`cell ${token} played twice`);
    }
    positions[x][y] = String(seat);
    moves.push({ seat, x, y, skip: false, clockMs });
  }

  let result: DecodedGame["result"];
  if (resultRaw === "d") {
    result = { kind: "draw" };
  } else if (resultRaw === "a") {
    result = { kind: "abandoned" };
  } else {
    const match = /^([wt])([0-9])$/.exec(resultRaw);
    if (!match) {
      return fail(`bad result field ${resultRaw}`);
    }
    const winnerSeat = Number(match[2]);
    if (winnerSeat >= playerCount) {
      fail(`winner seat ${winnerSeat} outside player count ${playerCount}`);
    }
    result = {
      kind: match[1] === "w" ? "win" : "timeout",
      winnerSeat,
      ...(teamCount > 0 ? { winnerTeam: winnerSeat % teamCount } : {}),
    };
  }

  return {
    version: Number(version),
    boardSize,
    winningSequenceLength,
    winningSequenceCount,
    playerCount,
    teamCount,
    timed,
    timePerPlayer,
    incrementPerPlayer,
    moves,
    result,
    positions,
  };
};

// --- replay helpers (used by the web and mobile replay viewers) ------------

// Board state after the first `frame` moves (seats as base-10 strings).
export const boardAtFrame = (game: DecodedGame, frame: number): string[][] => {
  const positions = Array.from({ length: game.boardSize }, () =>
    Array.from({ length: game.boardSize }, () => EMPTY_POSITION)
  );
  game.moves.slice(0, frame).forEach((move) => {
    if (!move.skip) {
      positions[move.x][move.y] = String(move.seat);
    }
  });
  return positions;
};

// Client-facing aliases (the decoder predates the shared module).
export const decodeTtn = decodeGame;
export type TtnGame = DecodedGame;
export type TtnMove = DecodedMove;
