// MCP over streamable HTTP, served by the game server itself.
//
// The stdio service in mcp/server.ts bridges to this server over a
// websocket; this one skips the bridge entirely. An MCP session is just an
// in-process player - the same trick residents.ts uses for the robots - so
// an agent connects with nothing but a URL:
//
//   { "mcpServers": { "tici-taca-toey": { "url": "https://ticitacatoey.com/mcp" } } }
//
// Transport: POST carries JSON-RPC and gets JSON back. We never initiate
// messages, so the optional SSE stream (GET) is not offered. Sessions are
// keyed by the Mcp-Session-Id header handed out at initialize.
import {
  Game,
  GameStatus,
  Message,
  MessageTypes,
  PlayerConnection,
  GameEngine,
  PlayerKind,
} from "./model";
import {
  MCP_DEFAULT_WAIT_SECONDS,
  MCP_INSTRUCTIONS,
  MCP_MAX_WAIT_SECONDS,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  MCP_TOOLS,
  MCP_COMPLETED_STATUSES,
  parseGameId,
  renderGame,
} from "../../shared/mcp";

const SESSION_HEADER = "mcp-session-id";
const PLAYER_KEY_HEADER = "x-ttt-player-key";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const MAX_SESSIONS = Number(process.env.TTT_MAX_MCP_SESSIONS ?? 200);

interface Waiter {
  gameId: string;
  resolve: () => void;
}

interface Session {
  playerId: string;
  connection: PlayerConnection;
  games: Map<string, Game>;
  names: Record<string, string>;
  lobby: unknown[];
  robots: unknown[];
  lastError: string | null;
  waiters: Waiter[];
  lastSeen: number;
}

const sessions = new Map<string, Session>();

const createSession = (engine: GameEngine, playerId: string): Session => {
  const session: Session = {
    playerId,
    games: new Map(),
    names: {},
    lobby: [],
    robots: [],
    lastError: null,
    waiters: [],
    lastSeen: Date.now(),
    // Every broadcast the engine sends this player lands here. Nothing is
    // allowed to throw: a bad payload must never break the engine's
    // notify loop for the other players in the game.
    connection: {
      send(data: string) {
        try {
          const message = JSON.parse(String(data)) as Record<string, unknown>;
          if (message.error) {
            session.lastError = String(message.message ?? message.error);
            return;
          }
          if (message.type === MessageTypes.LIST_GAMES) {
            session.lobby = (message.games as unknown[]) ?? [];
            session.robots = (message.robots as unknown[]) ?? [];
          }
          const players = message.players as
            | Record<string, { name?: string }>
            | undefined;
          const spectators = message.spectators as
            | Record<string, { name?: string }>
            | undefined;
          [players, spectators].forEach((group) => {
            Object.entries(group ?? {}).forEach(([id, player]) => {
              if (player?.name) {
                session.names[id] = player.name;
              }
            });
          });
          const game = message.game as Game | undefined;
          if (game?.gameId) {
            session.games.set(game.gameId, game);
            const ready =
              game.turn === session.playerId ||
              MCP_COMPLETED_STATUSES.has(game.status);
            if (ready) {
              session.waiters = session.waiters.filter((waiter) => {
                if (waiter.gameId !== game.gameId) {
                  return true;
                }
                waiter.resolve();
                return false;
              });
            }
          }
        } catch {
          // unparseable payloads are simply not state we can use
        }
      },
    },
  };
  return session;
};

const endSession = (engine: GameEngine, sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }
  sessions.delete(sessionId);
  session.waiters.forEach((waiter) => waiter.resolve());
  // Same path a closing websocket takes: the grace window starts, and the
  // player's games abandon if they do not come back.
  engine
    .play({
      type: MessageTypes.PLAYER_DISCONNECT,
      playerId: session.playerId,
    } as Message)
    .catch((error) => console.error("MCP disconnect failed", error));
};

export const sweepMcpSessions = (engine: GameEngine, now = Date.now()) => {
  sessions.forEach((session, id) => {
    if (session.lastSeen + SESSION_IDLE_MS < now) {
      endSession(engine, id);
    }
  });
};

// --- tools -----------------------------------------------------------------

const stateOf = (session: Session, gameId: string, origin: string): string => {
  const game = session.games.get(gameId);
  return game
    ? renderGame(game, session.playerId, session.names, origin)
    : `no local state for game ${gameId} - join_game or spectate_game first`;
};

// Run one engine message as this session's player and surface any
// validation error the engine sent back to us.
const play = async (
  engine: GameEngine,
  session: Session,
  message: Record<string, unknown>
) => {
  session.lastError = null;
  await engine.play({
    ...message,
    playerId: session.playerId,
    connection: session.connection,
  } as Message);
  if (session.lastError) {
    throw new Error(session.lastError);
  }
};

const callTool = async (
  engine: GameEngine,
  session: Session,
  origin: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> => {
  switch (name) {
    case "list_games": {
      await play(engine, session, { type: MessageTypes.LIST_GAMES });
      return JSON.stringify(
        { games: session.lobby, robots: session.robots },
        null,
        2
      );
    }
    case "start_game": {
      const gameId = crypto.randomUUID();
      await play(engine, session, {
        type: MessageTypes.START_GAME,
        gameId,
        name: String(args.name ?? "Agent Arena"),
        boardSize: Number(args.boardSize ?? 3),
        playerCount: Number(args.playerCount ?? 2),
        winningSequenceLength: Number(args.winningSequenceLength ?? 3),
        ...(args.winningSequenceCount
          ? { winningSequenceCount: Number(args.winningSequenceCount) }
          : {}),
        ...(args.teamCount ? { teamCount: Number(args.teamCount) } : {}),
        ...(args.timePerPlayer
          ? {
              timePerPlayer: Number(args.timePerPlayer),
              incrementPerPlayer: Number(args.incrementPerPlayer ?? 1000),
            }
          : {}),
      });
      return stateOf(session, gameId, origin);
    }
    case "join_game": {
      const gameId = parseGameId(args.gameId);
      await play(engine, session, { type: MessageTypes.JOIN_GAME, gameId });
      return stateOf(session, gameId, origin);
    }
    case "spectate_game": {
      const gameId = parseGameId(args.gameId);
      await play(engine, session, { type: MessageTypes.SPECTATE_GAME, gameId });
      return stateOf(session, gameId, origin);
    }
    case "request_robot": {
      const gameId = parseGameId(args.gameId);
      await play(engine, session, {
        type: MessageTypes.REQUEST_ROBOT,
        gameId,
        ...(args.robotName ? { robotName: String(args.robotName) } : {}),
      });
      return stateOf(session, gameId, origin);
    }
    case "make_move": {
      const gameId = parseGameId(args.gameId);
      await play(engine, session, {
        type: MessageTypes.MAKE_MOVE,
        gameId,
        coordinateX: Number(args.x),
        coordinateY: Number(args.y),
      });
      return stateOf(session, gameId, origin);
    }
    case "wait_for_turn": {
      const gameId = parseGameId(args.gameId);
      const seconds = Math.min(
        Math.max(Number(args.timeoutSeconds ?? MCP_DEFAULT_WAIT_SECONDS), 1),
        MCP_MAX_WAIT_SECONDS
      );
      const game = session.games.get(gameId);
      const readyNow =
        game !== undefined &&
        (game.turn === session.playerId ||
          MCP_COMPLETED_STATUSES.has(game.status));
      if (!readyNow) {
        await new Promise<void>((resolve) => {
          const waiter: Waiter = { gameId, resolve };
          session.waiters.push(waiter);
          setTimeout(() => {
            session.waiters = session.waiters.filter((w) => w !== waiter);
            resolve();
          }, seconds * 1000);
        });
      }
      return stateOf(session, gameId, origin);
    }
    case "get_game":
      return stateOf(session, parseGameId(args.gameId), origin);
    case "claim_handle": {
      await play(engine, session, {
        type: MessageTypes.CLAIM_HANDLE,
        handle: String(args.handle ?? ""),
      });
      return `handle claimed: ${args.handle}`;
    }
    default:
      throw new Error(`unknown tool ${name}`);
  }
};

// --- JSON-RPC over HTTP ----------------------------------------------------

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const rpcError = (id: unknown, code: number, message: string) =>
  json({ jsonrpc: "2.0", id, error: { code, message } });

export const handleMcpRequest = async (
  request: Request,
  engine: GameEngine,
  origin: string
): Promise<Response> => {
  if (request.method === "DELETE") {
    const id = request.headers.get(SESSION_HEADER);
    if (id) {
      endSession(engine, id);
    }
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") {
    // We never push server-initiated messages, so the optional SSE stream
    // is not offered - the spec allows declining it.
    return new Response("use POST for MCP JSON-RPC", {
      status: 405,
      headers: { Allow: "POST, DELETE" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return rpcError(null, -32700, "parse error");
  }
  const { id, method } = body;
  const params = (body.params ?? {}) as Record<string, unknown>;

  if (method === "initialize") {
    if (sessions.size >= MAX_SESSIONS) {
      return rpcError(id, -32000, "too many MCP sessions - try again shortly");
    }
    const sessionId = crypto.randomUUID();
    // A supplied key gives the agent a durable identity (handle, rating,
    // resumable games); without one it plays as a fresh anonymous player.
    const playerKey = request.headers.get(PLAYER_KEY_HEADER);
    const playerId = engine.resolvePlayerKey
      ? engine.resolvePlayerKey(playerKey, crypto.randomUUID())
      : crypto.randomUUID();
    const session = createSession(engine, playerId);
    sessions.set(sessionId, session);
    await engine
      .play({
        type: MessageTypes.REGISTER_PLAYER,
        playerId,
        name: "agent",
        // Seats taken over MCP are badged as agents in every client.
        kind: PlayerKind.AGENT,
        ...(playerKey ? { playerKey } : {}),
        connection: session.connection,
      } as Message)
      .catch((error) => console.error("MCP register failed", error));
    const requested = String(params.protocolVersion ?? MCP_PROTOCOL_VERSION);
    return json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: /^\d{4}-\d{2}-\d{2}$/.test(requested)
            ? requested
            : MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: MCP_SERVER_INFO,
          instructions: MCP_INSTRUCTIONS,
        },
      },
      200,
      { "Mcp-Session-Id": sessionId }
    );
  }

  if (method === "ping") {
    return json({ jsonrpc: "2.0", id, result: {} });
  }
  if (method === "tools/list") {
    return json({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
  }

  if (method === "tools/call") {
    const sessionId = request.headers.get(SESSION_HEADER);
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      // 404 tells a client its session expired so it can re-initialize.
      return rpcError(id, -32001, "unknown or expired MCP session");
    }
    session.lastSeen = Date.now();
    try {
      const text = await callTool(
        engine,
        session,
        origin,
        String(params.name),
        (params.arguments ?? {}) as Record<string, unknown>
      );
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
    } catch (error) {
      // Tool failures are results, not protocol errors - the agent reads
      // the message and tries something else.
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: String((error as Error).message) }],
          isError: true,
        },
      });
    }
  }

  if (id === undefined) {
    // A notification (notifications/initialized and friends): nothing to
    // answer, but the client expects the request to be accepted.
    return new Response(null, { status: 202 });
  }
  return rpcError(id, -32601, `method not found: ${method}`);
};

export const mcpSessionCount = () => sessions.size;
