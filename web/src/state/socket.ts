// A small self-healing websocket connection. The socket reconnects with
// capped exponential backoff so the app survives server restarts, sleeping
// free-tier hosts, and flaky networks without anyone reloading the page.

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;

// `bun build --env 'TTT_*'` rewrites the exact expression
// `process.env.TTT_SERVER_URL` into a string literal. It must be a bare
// member access (no typeof guard, no optional chaining - both defeat the
// rewrite or survive into the bundle and discard the value, which once
// shipped a build that ignored its configured server). In the dev server
// nothing is rewritten and the browser has no `process`, so the
// ReferenceError routes to the localhost fallback.
const readInlinedServerUrl = (): string | undefined => {
  try {
    return process.env.TTT_SERVER_URL;
  } catch {
    return undefined;
  }
};

const resolveServerUrl = (): string => {
  const fromEnv = readInlinedServerUrl();
  if (fromEnv) {
    return fromEnv;
  }
  const { hostname, host, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "ws://localhost:8080";
  }
  // Same-origin deployment behind a reverse proxy that routes /ws.
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
};

// The server's HTTP API (leaderboard, replays) lives on the same host.
export const getServerHttpBase = (): string =>
  resolveServerUrl().replace(/^ws/, "http");

interface SocketHandlers {
  onMessage: (data: unknown) => void;
  onOpen: () => void;
  onClose: () => void;
}

let socket: WebSocket | null = null;
let backoffMs = INITIAL_BACKOFF_MS;

export const initSocket = (handlers: SocketHandlers) => {
  const connect = () => {
    socket = new WebSocket(resolveServerUrl());

    socket.addEventListener("open", () => {
      backoffMs = INITIAL_BACKOFF_MS;
      handlers.onOpen();
    });

    socket.addEventListener("message", (event) => {
      try {
        handlers.onMessage(JSON.parse(String(event.data)));
      } catch (error) {
        console.error("Could not parse server message", error, event.data);
      }
    });

    socket.addEventListener("close", () => {
      socket = null;
      handlers.onClose();
      const jitter = Math.random() * 250;
      setTimeout(connect, backoffMs + jitter);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    });

    socket.addEventListener("error", () => {
      // The close event always follows and drives the reconnect.
    });
  };

  connect();
};

export const sendToServer = (message: unknown) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn("Not connected to server, message dropped", message);
  }
};
