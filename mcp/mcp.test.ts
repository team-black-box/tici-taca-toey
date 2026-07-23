import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";

// End to end: a real game server + the MCP server as a child process,
// driven over stdio exactly like an MCP client would - handshake, tool
// discovery, then a full agent-vs-resident-robot exchange.

const ROOT = join(import.meta.dir, "..");
const PORT = 8907;

let gameServer: ReturnType<typeof Bun.spawn>;
let mcp: ReturnType<typeof Bun.spawn>;
let nextId = 1;
let lines: AsyncGenerator<string>;

async function* linesOf(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      yield buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
}

const send = (message: Record<string, unknown>) => {
  const sink = mcp.stdin as import("bun").FileSink;
  sink.write(`${JSON.stringify(message)}\n`);
  sink.flush();
};

const request = async (
  method: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>> => {
  const id = nextId++;
  send({ jsonrpc: "2.0", id, method, params });
  while (true) {
    const { value, done } = await lines.next();
    if (done) {
      throw new Error("mcp server closed its stdout");
    }
    const parsed = JSON.parse(value);
    if (parsed.id === id) {
      expect(parsed.error).toBeUndefined();
      return parsed.result;
    }
  }
};

const callTool = async (
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ text: string; isError: boolean }> => {
  const result = await request("tools/call", { name, arguments: args });
  const content = result.content as Array<{ type: string; text: string }>;
  return { text: content[0]?.text ?? "", isError: result.isError === true };
};

let ready: Promise<void> | null = null;

const setup = () => {
  ready ??= (async () => {
  gameServer = Bun.spawn({
    cmd: [process.execPath, join(ROOT, "server", "src", "server.ts")],
    cwd: join(ROOT, "server"),
    env: {
      ...process.env,
      PORT: String(PORT),
      TTN_LOG: "off",
      TTT_DB: "off",
    },
    stdout: "ignore",
    stderr: "ignore",
  });
  // wait for /health before speaking to it
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://localhost:${PORT}/health`);
      if (response.ok) {
        break;
      }
    } catch {
      await Bun.sleep(100);
    }
  }
  mcp = Bun.spawn({
    cmd: [process.execPath, join(import.meta.dir, "server.ts")],
    cwd: import.meta.dir,
    env: {
      ...process.env,
      TTT_SERVER_URL: `ws://localhost:${PORT}`,
      TTT_PLAYER_KEY: "mcp-e2e-test-key-0001",
    },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  });
  lines = linesOf(mcp.stdout as ReadableStream<Uint8Array>);
  })();
  return ready;
};

afterAll(() => {
  mcp?.kill();
  gameServer?.kill();
});

describe("MCP play service", () => {
  test("initialize handshake and tool discovery", async () => {
    await setup();
    const init = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "e2e", version: "0" },
    });
    expect(init.protocolVersion).toBe("2025-06-18");
    expect((init.serverInfo as { name: string }).name).toBe("tici-taca-toey");
    send({ jsonrpc: "2.0", method: "notifications/initialized" });

    const listed = await request("tools/list");
    const names = (listed.tools as Array<{ name: string }>).map(
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
    await setup();
    const started = await callTool("start_game", {
      name: "mcp e2e",
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

    // play until the game completes (3x3 always ends within 9 moves)
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
      const board = /board[\s\S]*/.exec(state.text)![0];
      const rows = board
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
    const final = await callTool("get_game", { gameId });
    expect(final.text).toContain("game over");
  }, 30_000);

  test("errors surface as isError content, not crashes", async () => {
    await setup();
    const bogus = await callTool("join_game", { gameId: "does-not-exist" });
    expect(bogus.isError).toBe(true);
    const stillAlive = await request("ping");
    expect(stillAlive).toEqual({});
  });
});
