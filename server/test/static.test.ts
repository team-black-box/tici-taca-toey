import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createStaticHandler } from "../src/static";

const WEB_ROOT = join(import.meta.dir, "fixtures", "web");
const serve = createStaticHandler(WEB_ROOT);

const bodyOf = async (response: Response | undefined): Promise<string> => {
  expect(response).toBeDefined();
  return response!.text();
};

describe("same-origin static serving", () => {
  test("serves index.html at / with revalidation caching", async () => {
    const response = serve("GET", "/");
    expect(await bodyOf(response)).toContain("<title>tici</title>");
    expect(response!.headers.get("Cache-Control")).toBe("no-cache");
  });

  test("serves hashed assets as immutable", async () => {
    const response = serve("GET", "/index-ab12cd34.js");
    expect(await bodyOf(response)).toContain("app");
    expect(response!.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  test("serves unhashed files with hourly caching", () => {
    const response = serve("GET", "/manifest.json");
    expect(response!.headers.get("Cache-Control")).toBe(
      "public, max-age=3600"
    );
  });

  test("client-side routes fall back to index.html", async () => {
    for (const route of [
      "/play/some-game-id",
      "/spectate/abc",
      "/replay/1.3.3.2.u.0003010402.w0",
      "/missing.png",
    ]) {
      expect(await bodyOf(serve("GET", route))).toContain(
        "<title>tici</title>"
      );
    }
  });

  test("path traversal never escapes the web root", async () => {
    for (const attempt of [
      "/../outside.txt",
      "/%2e%2e/outside.txt",
      "/assets/../../outside.txt",
      "/..%2foutside.txt",
    ]) {
      const response = serve("GET", attempt);
      // Traversal collapses to a client-side route: index, never the file.
      expect(await bodyOf(response)).toContain("<title>tici</title>");
    }
  });

  test("only GET and HEAD are handled", () => {
    expect(serve("POST", "/")).toBeUndefined();
    expect(serve("PUT", "/index.html")).toBeUndefined();
    expect(serve("HEAD", "/")).toBeDefined();
  });

  test("a handler over a missing directory serves nothing and never throws", () => {
    const missing = createStaticHandler("/nonexistent-web-root");
    expect(missing("GET", "/")).toBeUndefined();
    expect(missing("GET", "/play/x")).toBeUndefined();
  });
});
