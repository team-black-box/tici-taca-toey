// Same-origin serving of the built web app (web/dist). Enabled by setting
// TTT_WEB_DIR; unset in dev, where the web dev server runs separately.
// Serving the app and the websocket from one origin means the client's
// same-origin wss://<host>/ws fallback works with no build-time server URL.
//
// Never-die rules apply: a bad path, a missing file, or a filesystem error
// must never break the game endpoint - every failure falls through to
// undefined and the caller's plain response.
import { readFileSync, statSync } from "node:fs";
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

// --- per-route link previews -----------------------------------------------
//
// Crawlers (Slack, iMessage, Discord, Twitter, ...) fetch the HTML and read
// the meta tags without running any JavaScript, so an SPA cannot set them
// from React - they only ever see the static index.html. The server
// therefore rewrites the title/description/OG tags in the served HTML based
// on the path, so a shared /leaderboard or /player/<handle> link unfurls
// with something about that page instead of the generic home preview.

interface PreviewMeta {
  title: string;
  description: string;
}

const DEFAULT_META: PreviewMeta = {
  title: "tici-taca-toey",
  description:
    "multiplayer tic-tac-toe, terminal style - boards 2-12, robots standing by, chess clocks optional",
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const metaForPath = (pathname: string): PreviewMeta => {
  const player = pathname.match(/^[/]player[/]([^/]+)[/]?$/);
  if (player) {
    const handle = decode(player[1]);
    return {
      title: `${handle} · tici-taca-toey`,
      description: `${handle}'s games and rating. Watch their matches and replay any of them.`,
    };
  }
  if (/^[/]play[/]/.test(pathname)) {
    return {
      title: "Join a game · tici-taca-toey",
      description:
        "You have been invited to a game of multiplayer tic-tac-toe. Take a seat and play.",
    };
  }
  if (/^[/]spectate[/]/.test(pathname)) {
    return {
      title: "Watch a game · tici-taca-toey",
      description:
        "Watch a live game of multiplayer tic-tac-toe - boards up to 12x12, humans, robots, and AI agents.",
    };
  }
  if (/^[/]replay[/]/.test(pathname)) {
    return {
      title: "Game replay · tici-taca-toey",
      description:
        "Replay a finished game of tici-taca-toey move by move. The whole game is in the link.",
    };
  }
  if (pathname === "/leaderboard") {
    return {
      title: "Leaderboard · tici-taca-toey",
      description:
        "The top players and robots, ranked by a difficulty-weighted Elo across every game.",
    };
  }
  return DEFAULT_META;
};

// The bundler wraps some meta tags across lines, so match any run of
// whitespace between the attributes rather than a single space.
const TITLE = /<title>[^<]*<\/title>/;
const OG_TITLE = /(<meta\s+property="og:title"\s+content=")[^"]*(")/;
const OG_DESC = /(<meta\s+property="og:description"\s+content=")[^"]*(")/;
const NAME_DESC = /(<meta\s+name="description"\s+content=")[^"]*(")/;

// Rewrite the title, description, and OG tags of the built index.html, and
// inject explicit twitter:* tags so every platform reads the same thing.
const applyMeta = (html: string, meta: PreviewMeta): string => {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  return html
    .replace(TITLE, `<title>${title}</title>`)
    .replace(OG_TITLE, `$1${title}$2`)
    .replace(OG_DESC, `$1${description}$2`)
    .replace(NAME_DESC, `$1${description}$2`)
    .replace(
      "</head>",
      `    <meta name="twitter:title" content="${title}" />\n` +
        `    <meta name="twitter:description" content="${description}" />\n` +
        `  </head>`
    );
};

// Returns a handler that serves GET/HEAD requests from webDir, with
// client-side routes (/play/<id>, /replay/<ttn>, ...) falling back to
// index.html - rewritten with route-specific link-preview meta. Returns
// undefined for anything it does not handle.
export const createStaticHandler = (
  webDir: string
): ((method: string, pathname: string) => Response | undefined) => {
  const root = resolve(webDir);
  const indexPath = join(root, "index.html");
  // Read the index template once; per-request we only string-swap the meta.
  let indexTemplate: string | null = null;
  try {
    indexTemplate = readFileSync(indexPath, "utf8");
  } catch {
    indexTemplate = null;
  }

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
      // SPA fallback: serve index.html with route-specific preview meta.
      if (indexTemplate !== null) {
        const html = applyMeta(indexTemplate, metaForPath(pathname));
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": CACHE_REVALIDATE,
          },
        });
      }
      if (isFile(indexPath)) {
        return fileResponse(indexPath, CACHE_REVALIDATE);
      }
    } catch {
      // fall through - static serving must never take down the server
    }
    return undefined;
  };
};
