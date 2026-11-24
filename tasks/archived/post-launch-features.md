# Five features after the mobile launch

**Status:** Completed
**Owner:** Claude
**Estimated effort:** Large - five features, one of them (notifications)
with a deliberately bounded first cut
**Created:** 2026-08-07 22:58 IST
**Completed:** 2026-08-07 23:23 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Close the holes that showed up once the game was actually played end to
end on three platforms, and make the two things this project has that
nobody else does - a public game corpus and agents that join by URL -
visible in the product.

## The five

1. **Rematch.** A finished game currently goes nowhere. Reuse the
   configuration, re-seat the same robots, and land in the new game.
2. **Post-game analysis.** Annotate a replay with the moves that decided
   it: a win that was available and missed, a block that was not made.
   The engine, `shared/rules.ts`, and TTN v2 think times already hold
   everything needed, so this is a pure reading of data we keep.
3. **Your move, when you are not looking.** The async foundation is
   built (many concurrent games, turn tracking, blinking tiles) but only
   pays off while you are staring at the tab.
4. **Make the agents visible.** MCP-over-HTTP, the SDK, the corpus, and
   `cloney` exist and are invisible in the UI.
5. **Daily position.** One deterministic puzzle a day, the same for
   everyone, no opponent required - which is also the answer to an empty
   lobby.

## Scope

- [x] 1. Rematch: web + mobile, same config, same robots.
- [x] 2. `shared/analysis.ts` + replay annotations on web and mobile.
- [x] 3. Turn alerts on web (title/favicon + Notification API when the
      tab is not focused). See the note below on what is *not* in this
      cut.
- [x] 4. Humans/agents view on the leaderboard + a route into the SDK.
- [x] 5. Daily position: deterministic from the date, shareable result.
- [x] Docs + full verification matrix.

## Deliberate scope call on #3

True push - a notification that arrives with the browser or app fully
closed - needs the whole Web Push stack (RFC 8291 payload encryption and
RFC 8292 VAPID) on the server, or FCM/APNs on mobile. That is a real
service dependency and a lot of hand-rolled crypto for a project with a
zero-dependency server.

This cut does the part that covers the common case and costs nothing:
while the app is open but not focused - another tab, another window -
the title and favicon carry the turn, and the Notification API raises a
system notification. Anything beyond that is a separate decision with a
real price, recorded rather than smuggled in.

## Files Likely To Change

`shared/analysis.ts` (new), `web/src/features/replay/Replay.tsx`,
`web/src/features/game/status/Status.tsx`,
`web/src/features/daily/*` (new), `web/src/state/turn-alerts.ts` (new),
`web/src/features/leaderboard/LeaderboardPage.tsx`,
`mobile/src/screens/{GameScreen,ReplayScreen,LobbyScreen}.tsx`,
`mobile/src/analysis.ts` (shim), `web/src/app/App.tsx`.

## Recovery Hints

Each of the five is independent; check the scope boxes to see where it
stopped. #2 is the one with a shared module - if `shared/analysis.ts`
exists and has tests, the server-side half is done and only the two
replay screens remain.

## Checkpoints

- 2026-08-07 22:58 IST - Opened after a feature discussion. Verified
  first that rematch and notifications genuinely do not exist anywhere,
  and that the corpus is still only 95 games (so anything that raises
  games played also feeds the playground).
- 2026-08-07 23:23 IST - All five shipped, on web and (where they make
  sense) on mobile. 18 new tests: the analyser is checked against
  hand-built positions and swept over the whole corpus; the daily
  generator is proved over 365 consecutive dates to be legal,
  deterministic, and to have exactly one winning move.

  Verified in the browser rather than by inspection: played a game to a
  win, pressed rematch and landed in a fresh game with rando re-seated
  by name; opened the replay and the analysis said "rando left C3 open -
  and that is where the game was lost", flagging exactly that square,
  which was the square the game was in fact won on; the leaderboard's
  machines view showed only rando with the SDK/MCP note; the daily took
  a wrong guess, struck it through, persisted progress, then solved.

  **Found and fixed while verifying: per-player neon had been dead on
  every web board.** The flat colour reset on `.cell` sits later in the
  stylesheet than `.sym-0..9` at equal specificity, so it beat all of
  them and every mark rendered in the default green - live games,
  replays, everywhere. Measured rather than guessed: getComputedStyle
  returned the default foreground for a `.sym-1` cell. The reset is now
  scoped with `:not()` so it no longer depends on source order, and X is
  neon green with O cyan again.

  Scope honesty: turn alerts cover the backgrounded-tab case only. A
  notification arriving with the browser closed needs Web Push
  (RFC 8291/8292) server-side, and FCM/APNs on mobile - a service
  dependency and a pile of hand-rolled crypto. Recorded in the task
  rather than half-built.
- 2026-08-08 01:24 IST - Discoverability pass, prompted by the daily having shipped in
  the footer. The same failure applied to two of the other four: the
  analysis was reachable only from inside the replay viewer, and the
  humans/machines split only from the full standings. Both now surface
  where the moment actually happens - a finished game states what
  decided it and offers "see it", which opens the replay paused **on
  that move** (new `at=` link param), and the sidebar leaderboard
  carries the robot/agent line. Verified by playing: the verdict read
  "rando left C1 open on move 4 - that is where it turned", and the
  button landed on frame 4/5 paused with the square flagged.
