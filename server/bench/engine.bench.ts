// Full-pipeline engine benchmark: every message runs validate ->
// transition -> notify with counting fake connections, exactly like
// production minus the sockets. Run: bun run bench:engine
import TiciTacaToeyGameEngine from "../src/TiciTacaToeyGameEngine";
import {
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
} from "../src/model";

let sends = 0;
const connection: PlayerConnection = {
  send: () => {
    sends++;
  },
};

let seed = 123456789;
const random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0xffffffff;
};

interface PlayResult {
  messages: number;
}

const playGame = async (
  engine: TiciTacaToeyGameEngine,
  gameId: string,
  boardSize: number,
  winningSequenceLength: number
): Promise<PlayResult> => {
  let messages = 0;
  const play = async (message: Record<string, unknown>) => {
    messages++;
    await engine.play(message as unknown as Message);
  };
  await play({
    type: MessageTypes.START_GAME,
    name: "bench",
    boardSize,
    playerCount: 2,
    winningSequenceLength,
    gameId,
    playerId: `${gameId}-p0`,
    connection,
  });
  await play({
    type: MessageTypes.JOIN_GAME,
    gameId,
    playerId: `${gameId}-p1`,
    connection,
  });
  while (engine.games[gameId]?.status === GameStatus.GAME_IN_PROGRESS) {
    const game = engine.games[gameId];
    const empty: Array<{ x: number; y: number }> = [];
    game.positions.forEach((row, x) =>
      row.forEach((cell, y) => {
        if (cell === "-") {
          empty.push({ x, y });
        }
      })
    );
    const move = empty[Math.floor(random() * empty.length)];
    await play({
      type: MessageTypes.MAKE_MOVE,
      gameId,
      coordinateX: move.x,
      coordinateY: move.y,
      playerId: game.turn,
    });
  }
  return { messages };
};

const benchGames = async (
  label: string,
  games: number,
  boardSize: number,
  winningSequenceLength: number
) => {
  const engine = new TiciTacaToeyGameEngine();
  sends = 0;
  let messages = 0;
  const start = performance.now();
  for (let index = 0; index < games; index++) {
    const result = await playGame(
      engine,
      `${label}-${index}`,
      boardSize,
      winningSequenceLength
    );
    messages += result.messages;
  }
  const seconds = (performance.now() - start) / 1000;
  console.log(
    `${label.padEnd(18)} ${games} games in ${seconds.toFixed(2)}s  ` +
      `${Math.round(games / seconds).toLocaleString()} games/s  ` +
      `${Math.round(messages / seconds).toLocaleString()} msgs/s  ` +
      `${Math.round(sends / seconds).toLocaleString()} sends/s`
  );
};

const benchLobby = async (activeGames: number, polls: number) => {
  const engine = new TiciTacaToeyGameEngine();
  for (let index = 0; index < activeGames; index++) {
    await engine.play({
      type: MessageTypes.START_GAME,
      name: `lobby-${index}`,
      boardSize: 3,
      playerCount: 2,
      winningSequenceLength: 3,
      gameId: `lobby-${index}`,
      playerId: `lobby-${index}-p0`,
      connection,
    } as unknown as Message);
  }
  const start = performance.now();
  for (let index = 0; index < polls; index++) {
    await engine.play({
      type: MessageTypes.LIST_GAMES,
      playerId: "lobby-0-p0",
      connection,
    } as unknown as Message);
  }
  const seconds = (performance.now() - start) / 1000;
  console.log(
    `LIST_GAMES         ${polls} polls @ ${activeGames} active games  ` +
      `${Math.round(polls / seconds).toLocaleString()} polls/s`
  );
};

const benchMemory = async (activeGames: number) => {
  const engine = new TiciTacaToeyGameEngine();
  Bun.gc(true);
  const before = process.memoryUsage.rss();
  for (let index = 0; index < activeGames; index++) {
    const gameId = `mem-${index}`;
    await engine.play({
      type: MessageTypes.START_GAME,
      name: gameId,
      boardSize: 3,
      playerCount: 2,
      winningSequenceLength: 3,
      gameId,
      playerId: `${gameId}-p0`,
      connection,
    } as unknown as Message);
    await engine.play({
      type: MessageTypes.JOIN_GAME,
      gameId,
      playerId: `${gameId}-p1`,
      connection,
    } as unknown as Message);
    await engine.play({
      type: MessageTypes.MAKE_MOVE,
      gameId,
      coordinateX: 0,
      coordinateY: 0,
      playerId: engine.games[gameId].turn,
    } as unknown as Message);
  }
  Bun.gc(true);
  const perGame =
    (process.memoryUsage.rss() - before) / Math.max(activeGames, 1);
  console.log(
    `memory             ~${Math.max(
      Math.round(perGame / 1024),
      0
    ).toLocaleString()} KB rss per active 3x3 game+2 players (${activeGames} live)`
  );
};

console.log("engine pipeline benchmark (validate -> transition -> notify)");
await benchGames("warmup", 500, 3, 3);
await benchGames("3x3 win-3", 5000, 3, 3);
await benchGames("12x12 win-5", 300, 12, 5);
await benchLobby(500, 5000);
await benchMemory(500);
