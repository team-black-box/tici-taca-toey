# Personal game history and replays

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium (WS message + web panel + mobile screen)
**Created:** 2026-07-23 13:26 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

Players can see their finished games and replay them. Served over the
websocket (LIST_MY_GAMES -> MY_GAMES) so no player id ever appears in a
URL; the archive (sqlite) already stores everything needed. Replays open
the existing TTN replay viewer (web) and a new replay screen (mobile).

## Scope

- [x] shared/model.ts: LIST_MY_GAMES / MY_GAMES message + ArchivedGameSummary.
- [x] Engine: handle LIST_MY_GAMES (db-backed, requester-only reply).
- [x] Web: "your games" panel with result-from-my-perspective + replay links.
- [x] Mobile: history list + replay screen with frame stepper.
- [x] Tests: WS round trip against a real archive.

## Checkpoints

- 2026-07-23 13:26 IST - Task created.
