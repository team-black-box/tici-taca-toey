// Same-origin serving of the built web app (web/dist). Enabled by setting
// TTT_WEB_DIR; unset in dev, where the web dev server runs separately.
// Serving the app and the websocket from one origin means the client's
// same-origin wss://<host>/ws fallback works with no build-time server URL.
//
// Never-die rules apply: a bad path, a missing file, or a filesystem error
// must never break the game endpoint - every failure falls through to
// undefined and the caller's plain response.
import { statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// Bun's bundler emits content-hashed names (index-4xj4drp0.js); those are
// safe to cache forever. Everything else (manifest.json, og.png,
// robots.txt) revalidates hourly, and index.html always revalidates so a
// deploy is picked up on the next load.
const HASHED_ASSET = /-[a-z0-9]{6,}\.[a-z0-9]+$/;
const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_HOURLY = "public, max-age=3600";
const CACHE_REVALIDATE = "no-cache";

const fileResponse = (path: string, cacheControl: string): Response =>
  new Response(Bun.file(path), {
    headers: { "Cache-Control": cacheControl },
  });

const isFile = (path: string): boolean => {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return false;
  }
};

// Returns a handler that serves GET/HEAD requests from webDir, with
// client-side routes (/play/<id>, /replay/<ttn>, ...) falling back to
// index.html. Returns undefined for anything it does not handle.
export const createStaticHandler = (
  webDir: string
): ((method: string, pathname: string) => Response | undefined) => {
  const root = resolve(webDir);
  return (method, pathname) => {
    if (method !== "GET" && method !== "HEAD") {
      return undefined;
    }
    try {
      let decoded: string;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        decoded = pathname;
      }
      const target = resolve(root, `.${decoded}`);
      // resolve() collapses any ../ - anything that escapes the web root
      // is treated as a client-side route, never served.
      const inRoot = target === root || target.startsWith(root + sep);
      if (inRoot && isFile(target)) {
        return fileResponse(
          target,
          HASHED_ASSET.test(target) ? CACHE_IMMUTABLE : CACHE_HOURLY
        );
      }
      const index = join(root, "index.html");
      if (isFile(index)) {
        return fileResponse(index, CACHE_REVALIDATE);
      }
    } catch {
      // fall through - static serving must never take down the server
    }
    return undefined;
  };
};
