import TiciTacaToeyGameEngine from "./TiciTacaToeyGameEngine";
import { GameDb } from "./db";
import { startResidents } from "./residents";
import { createStaticHandler } from "./static";
import { handleMcpRequest, mcpSessionCount, sweepMcpSessions } from "./mcp";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  ErrorCodes,
  GameEngine,
  GameStatus,
  Message,
  MessageTypes,
  PlayerDisconnectMessage,
} from "./model";

console.log(`
/$$$$$$$$ /$$$$$$  /$$$$$$  /$$$$$$    /$$$$$$$$ /$$$$$$   /$$$$$$   /$$$$$$       /$$$$$$$$ /$$$$$$  /$$$$$$$$ /$$     /$$
|__  $$__/|_  $$_/ /$$__  $$|_  $$_/   |__  $$__//$$__  $$ /$$__  $$ /$$__  $$     |__  $$__//$$__  $$| $$_____/|  $$   /$$/
   | $$     | $$  | $$  \\__/  | $$        | $$  | $$  \\ $$| $$  \\__/| $$  \\ $$        | $$  | $$  \\ $$| $$       \\  $$ /$$/
   | $$     | $$  | $$        | $$ /$$$$$$| $$  | $$$$$$$$| $$      | $$$$$$$$ /$$$$$$| $$  | $$  | $$| $$$$$     \\  $$$$/
   | $$     | $$  | $$        | $$|______/| $$  | $$__  $$| $$      | $$__  $$|______/| $$  | $$  | $$| $$__/      \\  $$/
   | $$     | $$  | $$    $$  | $$        | $$  | $$  | $$| $$    $$| $$  | $$        | $$  | $$  | $$| $$          | $$
   | $$    /$$$$$$|  $$$$$$/ /$$$$$$      | $$  | $$  | $$|  $$$$$$/| $$  | $$        | $$  |  $$$$$$/| $$$$$$$$    | $$
   |__/   |______/ \\______/ |______/      |__/  |__/  |__/ \\______/ |__/  |__/        |__/   \\______/ |________/    |__/
`);

const PORT = Number(process.env.PORT ?? 8080);
// Production binds 127.0.0.1 behind the reverse proxy; dev binds everywhere
// so simulators/devices on the LAN can connect.
const HOST = process.env.HOST ?? "0.0.0.0";
const MAX_MESSAGE_BYTES = 16 * 1024;
const SWEEP_INTERVAL_MS = 60 * 1000;
const PING_INTERVAL_MS = 45 * 1000;

// Single-origin production: serve the built web app (web/dist) from this
// process. Unset in dev - the web dev server runs separately.
const serveWeb = process.env.TTT_WEB_DIR
  ? createStaticHandler(process.env.TTT_WEB_DIR)
  : () => undefined;

// One TTN line per finished game for future model training. Set TTN_LOG to a
// path to relocate, or TTN_LOG=off to disable.
const ttnLogPath =
  process.env.TTN_LOG === "off"
    ? null
    : process.env.TTN_LOG ?? "data/games.ttn";

// Identities, handles, archive, and ratings. TTT_DB=off disables; the
// default file lives on the box disk and is snapshotted nightly
// (deploy/backup.sh).
const db = (() => {
  if (process.env.TTT_DB === "off") {
    return undefined;
  }
  const path = process.env.TTT_DB ?? "data/tici-taca-toey.db";
  try {
    mkdirSync(dirname(path), { recursive: true });
    return new GameDb(path);
  } catch (error) {
    // A missing/read-only disk must never stop the game server; it just
    // runs without handles/leaderboards/archive.
    console.error("Database unavailable, continuing without it", error);
    return undefined;
  }
})();

const engine = new TiciTacaToeyGameEngine({ ttnLogPath, db });

// Resident robots: "+ robot" always answers, on every instance.
if (process.env.RESIDENT_ROBOTS !== "off") {
  startResidents(engine);
}

// Per-connection message rate limiting: a token bucket generous for humans
// and robots, hostile to floods. Env-tunable for load testing and special
// deployments; the defaults are the production stance.
const RATE_CAPACITY = Number(process.env.TTT_RATE_CAPACITY ?? 40);
const RATE_REFILL_PER_SECOND = Number(process.env.TTT_RATE_REFILL ?? 15);
const RATE_HARD_LIMIT_MULTIPLIER = 4;

// Connections, not games, are what consume memory: bench/sockets.bench.ts
// measured ~365 KB of RSS per socket, so ~2000 is the practical ceiling of
// a 1 GB box. Refusing the upgrade past that keeps the server responsive
// for everyone already playing instead of letting it OOM for everyone.
const MAX_CONNECTIONS = Number(process.env.TTT_MAX_CONNECTIONS ?? 2000);
let openConnections = 0;

const ALLOWED_ORIGINS = (process.env.TTT_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const log = (currentEngine: GameEngine) => {
  console.log(`Active Players Count: ${Object.values(currentEngine.players).length}
Active Players: ${Object.values(currentEngine.players)
    .map((each) => each.name)
    .join(", ")}
Active Games Count: ${Object.values(currentEngine.games).length}
Active Games: ${Object.values(currentEngine.games)
    .filter((each) => each.status === GameStatus.GAME_IN_PROGRESS)
    .map((each) => each.name)
    .join(", ")}
======================================================================`);
};

interface SocketData {
  playerId: string;
  tokens: number;
  lastRefill: number;
  strikes: number;
}

// Optional TLS for running without a reverse proxy. Most deployments should
// terminate TLS at a proxy (Caddy/nginx/platform) and run this server plain.
const tls =
  process.env.TLS_CERT && process.env.TLS_KEY
    ? {
        cert: Bun.file(process.env.TLS_CERT),
        key: Bun.file(process.env.TLS_KEY),
      }
    : undefined;

const server = Bun.serve<SocketData>({
  port: PORT,
  hostname: HOST,
  tls,
  fetch(request, currentServer) {
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "Content-Type": "application/json",
          // The web app lives on a different origin; these are public reads.
          "Access-Control-Allow-Origin": "*",
        },
      });
    // The training corpus, one TTN line per finished game - public data
    // (board sizes and move sequences only). The daily dataset workflow
    // mirrors this into git.
    if (url.pathname === "/dataset") {
      if (!ttnLogPath) {
        return new Response("dataset logging is disabled", { status: 404 });
      }
      // Before the first game finishes the corpus file does not exist yet.
      // That is an empty dataset, not an error - streaming a missing file
      // would 500 and break the daily mirror on a freshly deployed box.
      return new Response(existsSync(ttnLogPath) ? Bun.file(ttnLogPath) : "", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    // MCP over streamable HTTP: agents connect with just this URL, no
    // local install. See shared/mcp.ts for the tool contract.
    if (url.pathname === "/mcp") {
      return handleMcpRequest(request, engine, url.origin);
    }
    if (url.pathname === "/health") {
      return json({
        status: "ok",
        players: Object.keys(engine.players).length,
        games: Object.keys(engine.games).length,
        robots: Object.keys(engine.robots).length,
        // Headroom against the caps, so the pinger shows when to resize.
        connections: openConnections,
        maxConnections: MAX_CONNECTIONS,
        mcpSessions: mcpSessionCount(),
      });
    }
    if (engine.db) {
      if (url.pathname === "/leaderboard") {
        const pool = url.searchParams.get("pool") ?? "3x3x2";
        const limit = Number(url.searchParams.get("limit") ?? 25);
        return json({
          pool,
          pools: engine.db.pools(),
          rows: engine.db.leaderboard(pool, Number.isFinite(limit) ? limit : 25),
        });
      }
      const gameMatch = url.pathname.match(/^[/]games[/]([a-zA-Z0-9-]+)$/);
      if (gameMatch) {
        const game = engine.db.getGame(gameMatch[1]);
        return game ? json(game) : json({ error: "not found" }, 404);
      }
      const playerGamesMatch = url.pathname.match(
        /^[/]players[/]([a-zA-Z0-9-]+)[/]games$/
      );
      if (playerGamesMatch) {
        const limit = Number(url.searchParams.get("limit") ?? 25);
        return json({
          games: engine.db.playerGames(
            playerGamesMatch[1],
            Number.isFinite(limit) ? limit : 25
          ),
        });
      }
      const playerMatch = url.pathname.match(/^[/]players[/]([a-zA-Z0-9-]+)$/);
      if (playerMatch) {
        const profile = engine.db.playerProfile(playerMatch[1]);
        return profile ? json(profile) : json({ error: "not found" }, 404);
      }
    }
    if (
      ALLOWED_ORIGINS.length > 0 &&
      request.headers.get("upgrade")?.toLowerCase() === "websocket"
    ) {
      const origin = request.headers.get("origin");
      // Origin-less clients (robots, native apps) are welcome; browsers
      // must come from an allowed origin.
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return new Response("origin not allowed", { status: 403 });
      }
    }
    if (
      request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
      openConnections >= MAX_CONNECTIONS
    ) {
      return new Response("server at capacity - try again shortly", {
        status: 503,
        headers: { "Retry-After": "30" },
      });
    }
    const upgraded = currentServer.upgrade(request, {
      data: {
        playerId: crypto.randomUUID(),
        tokens: RATE_CAPACITY,
        lastRefill: Date.now(),
        strikes: 0,
      },
    });
    if (upgraded) {
      return undefined;
    }
    const webResponse = serveWeb(request.method, url.pathname);
    if (webResponse) {
      return webResponse;
    }
    return new Response(
      "tici-taca-toey server: connect with a websocket client to play",
      { status: 200 }
    );
  },
  websocket: {
    maxPayloadLength: MAX_MESSAGE_BYTES,
    idleTimeout: 300,
    open() {
      // Players are registered lazily when their first message arrives.
      openConnections++;
    },
    message(ws, data) {
      // token-bucket rate limit per connection
      const now = Date.now();
      ws.data.tokens = Math.min(
        RATE_CAPACITY,
        ws.data.tokens +
          ((now - ws.data.lastRefill) / 1000) * RATE_REFILL_PER_SECOND
      );
      ws.data.lastRefill = now;
      if (ws.data.tokens < 1) {
        ws.data.strikes++;
        if (ws.data.strikes > RATE_CAPACITY * RATE_HARD_LIMIT_MULTIPLIER) {
          ws.close(1008, "rate limit");
          return;
        }
        ws.send(
          JSON.stringify({ error: ErrorCodes.RATE_LIMITED, type: "ERROR" })
        );
        return;
      }
      ws.data.tokens -= 1;

      let message: Partial<Message> | null = null;
      try {
        message = JSON.parse(String(data));
      } catch (exception) {
        ws.send(
          JSON.stringify({
            error: ErrorCodes.BAD_REQUEST,
            message: `Only valid JSON messages are supported. Please review your message and try again. Original Message: ${data}`,
          })
        );
        return;
      }
      if (typeof message !== "object" || message === null) {
        ws.send(
          JSON.stringify({
            error: ErrorCodes.BAD_REQUEST,
            message: "Messages must be JSON objects",
          })
        );
        return;
      }

      // Durable identity: registrations may carry a secret playerKey that
      // resolves to a stable playerId, enabling reconnect-and-resume. All
      // later messages on this socket act as that player.
      if (
        "type" in message &&
        (message.type === MessageTypes.REGISTER_PLAYER ||
          message.type === MessageTypes.REGISTER_ROBOT) &&
        "playerKey" in message
      ) {
        ws.data.playerId = engine.resolvePlayerKey(
          message.playerKey,
          ws.data.playerId
        );
      }

      const enrichedMessage = {
        ...message,
        playerId: ws.data.playerId,
        gameId:
          "gameId" in message && typeof message.gameId === "string" && message.gameId
            ? message.gameId
            : crypto.randomUUID(),
        connection: ws,
      } as Message;
      engine
        .play(enrichedMessage)
        .then(log)
        .catch((error) => console.error("Engine play failed", error));
    },
    close(ws) {
      // Decrement before anything that could throw, so a failed disconnect
      // can never leak a connection slot and slowly close the server.
      openConnections = Math.max(0, openConnections - 1);
      const playerDisconnectMessage: PlayerDisconnectMessage = {
        type: MessageTypes.PLAYER_DISCONNECT,
        playerId: ws.data.playerId,
      };
      engine
        .play(playerDisconnectMessage)
        .then(log)
        .catch((error) => console.error("Disconnect handling failed", error));
    },
  },
});

// Garbage collect finished and stale games so memory stays flat forever.
setInterval(() => {
  try {
    engine.sweep();
    sweepMcpSessions(engine);
  } catch (error) {
    console.error("Sweep failed", error);
  }
}, SWEEP_INTERVAL_MS);

// Keep live connections alive through proxies and let dead ones surface as
// close events.
setInterval(() => {
  Object.values(engine.players).forEach((player) => {
    try {
      player.connection.ping?.();
    } catch (error) {
      console.error("Ping failed", error);
    }
  });
}, PING_INTERVAL_MS);

// The server should never die: log and carry on. State is in memory, so a
// crash costs every active game - a logged error costs only one message.
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception (server kept alive)", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (server kept alive)", reason);
});

log(engine);
console.log(
  `tici-taca-toey server listening on ${tls ? "wss" : "ws"}://localhost:${server.port}`
);
