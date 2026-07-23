import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";

// The MCP endpoint exercised the way an agent would: plain HTTP JSON-RPC
// against a real server, no local install and no websocket bridge.

const PORT = 8913;
const BASE = `http://127.0.0.1:${PORT}`;
let server: ReturnType<typeof Bun.spawn>;
let sessionId = "";
let nextId = 1;

const rpc = async (
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {}
) => {
  const response = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  return {
    response,
    body: (await response.json()) as {
      result?: Record<string, unknown>;
      error?: { message: string };
    },
  };
};

const callTool = async (name: string, args: Record<string, unknown> = {}) => {
  const { body } = await rpc("tools/call", { name, arguments: args });
  const result = body.result as {
    content: Array<{ text: string }>;
    isError?: boolean;
  };
  return { text: result.content[0]?.text ?? "", isError: result.isError === true };
};

beforeAll(async () => {
  server = Bun.spawn({
    cmd: [process.execPath, join(import.meta.dir, "..", "src", "server.ts")],
    env: {
      ...process.env,
      PORT: String(PORT),
      TTN_LOG: "off",
      TTT_DB: "off",
    },
    stdout: "ignore",
    stderr: "ignore",
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) {
        return;
      }
    } catch {
      await Bun.sleep(100);
    }
  }
});

afterAll(() => server?.kill());

describe("MCP over HTTP", () => {
  test("initialize hands out a session and advertises the tools", async () => {
    const { response, body } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "http-e2e", version: "0" },
    });
    expect(response.status).toBe(200);
    sessionId = response.headers.get("Mcp-Session-Id") ?? "";
    expect(sessionId).not.toBe("");
    const result = body.result as {
      protocolVersion: string;
      serverInfo: { name: string };
      instructions: string;
    };
    expect(result.protocolVersion).toBe("2025-06-18");
    expect(result.serverInfo.name).toBe("tici-taca-toey");
    expect(result.instructions.length).toBeGreaterThan(0);

    const listed = await rpc("tools/list");
    const names = (listed.body.result as { tools: Array<{ name: string }> }).tools.map(
      (tool) => tool.name
    );
    for (const expected of [
      "list_games",
      "start_game",
      "join_game",
      "request_robot",
      "make_move",
      "wait_for_turn",
      "get_game",
      "claim_handle",
    ]) {
      expect(names).toContain(expected);
    }
  });

  test("plays a full game against a resident robot", async () => {
    const started = await callTool("start_game", {
      name: "http mcp e2e",
      boardSize: 3,
      playerCount: 2,
      winningSequenceLength: 3,
    });
    expect(started.isError).toBe(false);
    const gameId = /\[([a-z0-9-]+)\]/.exec(started.text)?.[1];
    expect(gameId).toBeDefined();

    const seated = await callTool("request_robot", {
      gameId,
      robotName: "rando",
    });
    expect(seated.isError).toBe(false);
    expect(seated.text).toContain("2/2 seats");

    for (let turn = 0; turn < 9; turn++) {
      const state = await callTool("wait_for_turn", {
        gameId,
        timeoutSeconds: 20,
      });
      if (state.text.includes("game over")) {
        expect(state.text).toMatch(/won by|draw/);
        return;
      }
      expect(state.text).toContain("YOUR MOVE");
      const rows = state.text
        .split("\n")
        .filter((line) => line.startsWith("x="))
        .map((line) => line.slice(4).trim().split(/\s+/));
      let played = false;
      for (let x = 0; x < 3 && !played; x++) {
        for (let y = 0; y < 3 && !played; y++) {
          if (rows[x][y] === ".") {
            const moved = await callTool("make_move", { gameId, x, y });
            expect(moved.isError).toBe(false);
            played = true;
          }
        }
      }
      expect(played).toBe(true);
    }
    expect((await callTool("get_game", { gameId })).text).toContain("game over");
  }, 30_000);

  test("tool failures come back as content, not protocol errors", async () => {
    const bogus = await callTool("join_game", { gameId: "does-not-exist" });
    expect(bogus.isError).toBe(true);
    const { body } = await rpc("ping");
    expect(body.result).toEqual({});
  });

  test("an unknown session is rejected so the client re-initializes", async () => {
    const response = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Mcp-Session-Id": "not-a-real-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "tools/call",
        params: { name: "list_games", arguments: {} },
      }),
    });
    const body = (await response.json()) as { error?: { message: string } };
    expect(body.error?.message).toMatch(/session/i);
  });

  test("GET is declined and DELETE ends the session", async () => {
    const get = await fetch(`${BASE}/mcp`);
    expect(get.status).toBe(405);

    const deleted = await fetch(`${BASE}/mcp`, {
      method: "DELETE",
      headers: { "Mcp-Session-Id": sessionId },
    });
    expect(deleted.status).toBe(204);

    // the session is gone, so further calls are refused at the protocol
    // level - the client is expected to initialize again
    const { body } = await rpc("tools/call", {
      name: "list_games",
      arguments: {},
    });
    expect(body.error?.message).toMatch(/session/i);
  });

  test("health reports the live MCP session count", async () => {
    const health = (await (await fetch(`${BASE}/health`)).json()) as {
      mcpSessions: number;
    };
    expect(typeof health.mcpSessions).toBe("number");
  });
});
