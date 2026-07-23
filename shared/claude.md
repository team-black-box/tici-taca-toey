# Shared Protocol Instructions

This file governs `shared/` - the single source of truth for the wire
protocol. The root [`claude.md`](../claude.md) applies.

- `model.ts` - game state, enums, summaries, responses. `ttn.ts` - the
  full TTN codec + replay helpers. `rules.ts` - win rules (sequence
  counting, teams) used by the engine *and* every client, so a board never
  reads differently than it scores. `copy.ts` - error copy in the terminal
  voice. Zero dependencies, no runtime imports beyond each other.
- Everything here is imported by server, web, mobile, sdk, mcp, and the
  playground. A change here IS a protocol change: run the full
  verification matrix (server tests, web tests+build, sdk typecheck,
  mobile typecheck+bundles).
- Message *envelopes* stay per-side on purpose: the server sees
  connection-enriched messages (`server/src/model.ts`), clients send bare
  payloads (`web/src/common/model.ts`, `mobile/src/model.ts`). Only the
  payload contents belong here.
- Nothing platform-specific ever lands here: no Bun APIs, no React, no
  React Native - this folder must load in every runtime the repo touches.
