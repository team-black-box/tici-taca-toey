// Real-websocket load benchmark: N concurrent pairs play continuously
// against a live server and report throughput, move->broadcast latency,
// and server memory. This measures Bun.serve + JSON + engine together -
// the number that matters for the box.
//
//   bun run bench:sockets                 # spawns a server, 200 pairs, 10s
//   bun bench/sockets.bench.ts 500 15     # 500 pairs for 15 seconds
//   TTT_BENCH_URL=ws://host:8080 bun bench/sockets.bench.ts   # external
import { join } from "node:path";

const PAIRS = Number(process.argv[2] ?? 200);
const DURATION_SECONDS = Number(process.argv[3] ?? 10);
const PORT = 8911;
const url = process.env.TTT_BENCH_URL ?? `ws://localhost:${PORT}`;

let serverProcess: ReturnType<typeof Bun.spawn> | null = null;
if (!process.env.TTT_BENCH_URL) {
  serverProcess = Bun.spawn({
    cmd: [process.execPath, join(import.meta.dir, "..", "src", "server.ts")],
    env: {
      ...process.env,
      PORT: String(PORT),
      TTN_LOG: "off",
      TTT_DB: "off",
      RESIDENT_ROBOTS: "off",
      // capacity is the question here - the per-socket limiter is measured
      // by running with defaults via TTT_BENCH_URL instead
      TTT_RATE_CAPACITY: "100000",
      TTT_RATE_REFILL: "100000",
    },
    stdout: "ignore",
    stderr: "ignore",
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/health`)).ok) {
        break;
      }
    } catch {
      await Bun.sleep(100);
    }
  }
}

let received = 0;
let gamesCompleted = 0;
let moveErrors = 0;
const latencies: number[] = [];
const deadline = Date.now() + DURATION_SECONDS * 1000;

const COMPLETED = new Set([
  "GAME_WON",
  "GAME_ENDS_IN_A_DRAW",
  "GAME_WON_BY_TIMEOUT",
  "GAME_ABANDONED",
]);

interface Client {
  socket: WebSocket;
  playerId: string;
  inbox: Array<Record<string, unknown>>;
  wake: (() => void) | null;
}

const connect = (name: string): Promise<Client> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client: Client = { socket, playerId: "", inbox: [], wake: null };
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "REGISTER_PLAYER", name }));
    };
    socket.onmessage = (event) => {
      received++;
      const message = JSON.parse(String(event.data));
      if (message.type === "REGISTER_PLAYER" && !client.playerId) {
        client.playerId = message.playerId;
        resolve(client);
        return;
      }
      client.inbox.push(message);
      client.wake?.();
    };
    socket.onerror = () => reject(new Error("connect failed"));
  });

const nextMessage = async (
  client: Client,
  match: (message: Record<string, unknown>) => boolean
): Promise<Record<string, unknown> | null> => {
  while (Date.now() < deadline + 2000) {
    const index = client.inbox.findIndex(match);
    if (index >= 0) {
      const [message] = client.inbox.splice(index, 1);
      return message;
    }
    await new Promise<void>((resolve) => {
      client.wake = resolve;
      setTimeout(resolve, 250);
    });
    client.wake = null;
  }
  return null;
};

type GameView = {
  gameId: string;
  status: string;
  turn: string;
  positions: string[][];
};

const gameOf = (message: Record<string, unknown>): GameView | undefined =>
  message.game as GameView | undefined;

const runPair = async (index: number) => {
  const a = await connect(`bench-a-${index}`);
  const b = await connect(`bench-b-${index}`);
  const seats: Record<string, Client> = {};
  while (Date.now() < deadline) {
    a.socket.send(
      JSON.stringify({
        type: "START_GAME",
        name: `bench-${index}`,
        boardSize: 3,
        playerCount: 2,
        winningSequenceLength: 3,
      })
    );
    const started = await nextMessage(
      a,
      (m) => m.type === "START_GAME" && gameOf(m) !== undefined
    );
    if (!started) {
      return;
    }
    const gameId = gameOf(started)!.gameId;
    b.socket.send(JSON.stringify({ type: "JOIN_GAME", gameId }));
    const joined = await nextMessage(
      b,
      (m) => m.type === "JOIN_GAME" && gameOf(m)?.gameId === gameId
    );
    if (!joined) {
      return;
    }
    seats[a.playerId] = a;
    seats[b.playerId] = b;
    let view = gameOf(joined)!;
    while (!COMPLETED.has(view.status) && Date.now() < deadline) {
      const mover = seats[view.turn];
      if (!mover) {
        break;
      }
      const empty: Array<{ x: number; y: number }> = [];
      view.positions.forEach((row, x) =>
        row.forEach((cell, y) => {
          if (cell === "-") {
            empty.push({ x, y });
          }
        })
      );
      const move = empty[Math.floor(Math.random() * empty.length)];
      const sentAt = performance.now();
      mover.socket.send(
        JSON.stringify({
          type: "MAKE_MOVE",
          gameId,
          coordinateX: move.x,
          coordinateY: move.y,
        })
      );
      const update = await nextMessage(
        mover,
        (m) =>
          gameOf(m)?.gameId === gameId &&
          (m.type === "MAKE_MOVE" || m.type === "GAME_COMPLETE")
      );
      if (!update) {
        moveErrors++;
        break;
      }
      latencies.push(performance.now() - sentAt);
      view = gameOf(update)!;
      if (m0IsComplete(update, view)) {
        gamesCompleted++;
        break;
      }
    }
  }
  a.socket.close();
  b.socket.close();
};

const m0IsComplete = (
  message: Record<string, unknown>,
  view: GameView
): boolean => message.type === "GAME_COMPLETE" || COMPLETED.has(view.status);

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
};

console.log(
  `socket load: ${PAIRS} pairs (${PAIRS * 2} sockets) for ${DURATION_SECONDS}s against ${url}`
);
const start = performance.now();
await Promise.all(
  Array.from({ length: PAIRS }, (_, index) => runPair(index))
);
const seconds = (performance.now() - start) / 1000;

let serverRss = "n/a";
if (serverProcess) {
  const ps = Bun.spawnSync(["ps", "-o", "rss=", "-p", String(serverProcess.pid)]);
  const kb = Number(ps.stdout.toString().trim());
  if (Number.isFinite(kb) && kb > 0) {
    serverRss = `${Math.round(kb / 1024)} MB`;
  }
}
console.log(
  `${gamesCompleted.toLocaleString()} games completed  ` +
    `${Math.round(received / seconds).toLocaleString()} msgs/s received  ` +
    `${latencies.length.toLocaleString()} moves`
);
console.log(
  `move->broadcast latency  p50 ${percentile(latencies, 50).toFixed(1)}ms  ` +
    `p99 ${percentile(latencies, 99).toFixed(1)}ms  ` +
    `errors ${moveErrors}  server rss ${serverRss}`
);
serverProcess?.kill();
process.exit(0);
