# Post-launch fixes batch

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium (web + one protocol change)
**Created:** 2026-07-23 23:01 IST
**Completed:** 2026-07-23 23:15 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

A batch of fixes found by the user in production; ship together, one
release at the end (user asked: do not release until all are done).

## Scope

- [x] **Leaderboard empty in production.** `getServerHttpBase()` did
      `wsUrl.replace(/^ws/, "http")` on the same-origin socket URL
      `wss://host/ws`, yielding `https://host/ws` - keeping the `/ws`
      path. The leaderboard then fetched `https://host/ws/api/leaderboard`,
      which misses and returns the SPA HTML, so `.json()` throws and the
      board is empty. Worked locally only because dev resolves to
      `ws://localhost:8080` with no path. Fix: return the origin.
- [x] **Overflowing history / player-page cards.** The player-handle list
      on the right of the tile overflows past the card edge. Let it wrap
      and shrink.
- [x] **Start-game from a browse page does not navigate.** On
      `/leaderboard` (or `/player/<h>`, `/replay`), starting a game sets
      the active game but the redirect effect is suppressed by the
      `!isBrowsing` guard, so you are stranded. Redirect on a genuine
      active-game *change* instead.
- [x] **Spectator cannot upgrade to player.** A spectator of a game that
      is still waiting with room can only join by editing the URL. Let
      them take a seat, and drop them from the spectator list when they do.
- [x] **Forfeit ("gg").** A player can concede an in-progress game.
      2 sides -> the other wins; more -> abandoned, attributed to the
      forfeiter. New `FORFEIT` message; server + web + mobile + tests.

## Files Likely To Change

web/src/state/socket.ts, web/src/features/listing/{History,Listing}.tsx,
web/src/features/leaderboard/PlayerPage.tsx, web/src/styles/app.css,
web/src/app/App.tsx, shared/model.ts, server/src/{model,TiciTacaToeyGameEngine}.ts,
web/src/features/game/status/Status.tsx, mobile/src/*.

## Checkpoints

- 2026-07-24 07:19 IST - Link previews + Dependabot. Per-route OG meta is now rewritten
  server-side in static.ts (crawlers do not run JS): /play, /spectate,
  /leaderboard, /player/<handle>, /replay each unfurl with their own
  title/description, plus injected twitter:* tags; privacy.html and
  terms.html got their own OG meta directly. Verified over HTTP on the real
  bundle for every route, with attribute escaping on handles. Found and
  fixed that the bundler wraps og:description across lines - regexes now
  tolerate whitespace. 8 static tests (5 new). Dependabot: the 6 alerts
  were all Ruby gems in mobile/Gemfile; relaxed the concurrent-ruby pin and
  generated a Gemfile.lock resolving to concurrent-ruby 1.3.8 +
  activesupport 7.2.3.1 (both patched). Closed all 9 open Dependabot PRs
  (breaking majors like TypeScript 7 / Babel 8) and reworked dependabot.yml
  to group updates, ignore majors, and add the bundler ecosystem so this
  noise does not return.

- 2026-07-24 07:01 IST - Second batch (clarity + polish) done and browser-verified:
  game header now shows "> goal: 6x6 board · first to make 2 lines of 3 in
  a row"; the start form labels are "in a row"/"lines to win" with a live
  goal preview; help rewritten to explain lines. Move particles are
  multicolour (verified visually - pink/cyan/yellow/white flecks). Handle
  input got id/name/autocomplete (Chrome console warning gone). Finished
  games capped at 10 in the rail with a "see all / your profile" button.
  Added CONTRIBUTING.md, SECURITY.md, issue + PR templates, and README
  MCP-connect + robot quick-start sections. Latency: the perceived delay
  is the resident robots' deliberate 400-700ms think time plus normal
  India->Nuremberg RTT, not server load. Full matrix green.

- 2026-07-23 23:15 IST - All five done and browser-verified: leaderboard sidebar+page
  populate (origin fix, confirmed the /ws path was the cause); player-page
  and history cards no longer overflow at 1280 or 560; starting a game
  from /leaderboard redirects to /play; a spectator of a waiting game with
  room sees "take a seat" and upgrades (URL flips /spectate -> /play);
  "gg (forfeit)" ends an in-progress game as a loss. Full matrix green:
  server 127 tests, web 9 + build, sdk, mobile typecheck + both bundles.

- 2026-07-23 23:01 IST - Batch opened; root-caused the empty leaderboard to the /ws path
  in getServerHttpBase.
