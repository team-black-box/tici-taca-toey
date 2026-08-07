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
    const html = await bodyOf(response);
    // The SPA shell, with the default link-preview title applied.
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain("<title>tici-taca-toey</title>");
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

  test("client-side routes fall back to the index shell", async () => {
    for (const route of [
      "/play/some-game-id",
      "/spectate/abc",
      "/replay/1.3.3.2.u.0003010402.w0",
      "/missing.png",
    ]) {
      expect(await bodyOf(serve("GET", route))).toContain(
        '<div id="root"></div>'
      );
    }
  });

  test("each route gets its own link-preview meta", async () => {
    const preview = async (route: string) => bodyOf(serve("GET", route));

    const play = await preview("/play/abc");
    expect(play).toContain("<title>Join a game · tici-taca-toey</title>");
    expect(play).toContain('property="og:title" content="Join a game');
    // Twitter tags are injected so every scraper reads the same thing.
    expect(play).toContain('name="twitter:title" content="Join a game');

    const spectate = await preview("/spectate/abc");
    expect(spectate).toContain("Watch a game");

    const leaderboard = await preview("/leaderboard");
    expect(leaderboard).toContain(
      "<title>Leaderboard · tici-taca-toey</title>"
    );
    expect(leaderboard).toContain("difficulty-weighted Elo");

    // A player page names the handle.
    const player = await preview("/player/neo");
    expect(player).toContain("<title>neo · tici-taca-toey</title>");
    expect(player).toContain("neo's games");

    // Nothing exotic in a handle can break out of an attribute.
    const nasty = await preview(
      "/player/" + encodeURIComponent('a"><script>')
    );
    expect(nasty).not.toContain("<script>");
    expect(nasty).toContain("&lt;script&gt;");
  });

  test("path traversal never escapes the web root", async () => {
    for (const attempt of [
      "/../outside.txt",
      "/%2e%2e/outside.txt",
      "/assets/../../outside.txt",
      "/..%2foutside.txt",
    ]) {
      const response = serve("GET", attempt);
      // Traversal collapses to a client-side route: the index shell, never
      // the file outside the web root.
      expect(await bodyOf(response)).toContain('<div id="root"></div>');
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

  // Deep-link association files. Getting these wrong fails silently -
  // iOS and Android simply do not open the app, which is
  // indistinguishable from not having shipped the files at all. Both of
  // these were serving the SPA's HTML before they existed on disk.
  test("apple-app-site-association is served as JSON despite having no extension", async () => {
    const response = serve("GET", "/.well-known/apple-app-site-association");
    expect(response).toBeDefined();
    // Apple requires application/json, and the missing file extension is
    // exactly what would otherwise leave this as octet-stream.
    expect(response!.headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(await bodyOf(response));
    expect(body.applinks.details[0].appIDs).toContain(
      "NZ2N94X98Y.com.ticitacatoey"
    );
  });

  test("assetlinks.json is served as JSON", async () => {
    const response = serve("GET", "/.well-known/assetlinks.json");
    expect(response).toBeDefined();
    expect(response!.headers.get("Content-Type")).toBe("application/json");
  });

  test("association files claim only paths the app can route", async () => {
    const response = serve("GET", "/.well-known/apple-app-site-association");
    const claimed: string[] = JSON.parse(
      await bodyOf(response)
    ).applinks.details[0].components.map(
      (component: Record<string, string>) => component["/"]
    );
    // The app's LINK_PATTERN handles play and spectate, nothing else.
    expect(claimed).toEqual(["/play/*", "/spectate/*"]);
    // The legal pages must stay with the browser: the mobile footer opens
    // them with Linking.openURL, so claiming them would bounce the user
    // back into the app instead of showing the page.
    expect(claimed.some((path) => path.includes("privacy"))).toBe(false);
    expect(claimed.some((path) => path.includes("terms"))).toBe(false);
  });
});
