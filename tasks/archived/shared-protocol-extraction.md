# Shared protocol extraction: one model, one TTN codec

**Status:** Completed
**Owner:** claude
**Estimated effort:** Medium-large (touches every module, all mechanical)
**Created:** 2026-07-20 13:02 IST
**Completed:** 2026-07-20 13:18 IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

The protocol model was defined three times (server/web/mobile) and the TTN
decoder three times, by an early decision that now just means extra lines
and drift risk. Extract a root `shared/` folder holding the protocol
types, the full TTN codec, and the error copy - every module imports the
one copy. Fewer lines, beginner-friendly, impossible to desync.

## Scope

- [x] `shared/model.ts` (from server's copy, the most complete) and
      `shared/ttn.ts` (server codec + web's boardAtFrame + decodeTtn
      alias), `shared/copy.ts` (ERROR_COPY).
- [x] server: `src/model.ts` + `src/notation.ts` become one-line
      re-exports; engine untouched.
- [x] web: `src/common/model.ts` + `src/common/ttn.ts` become re-exports;
      ERROR_COPY imported from shared.
- [x] mobile: same re-exports + metro `watchFolders` for `../shared` +
      tsconfig include; ERROR_COPY from shared.
- [x] sdk `GameView` and mcp `GameState` become the shared `Game` type.
- [x] Docs: root claude.md protocol rule rewritten (defined once in
      shared/), module claude.mds updated, shared/claude.md + agents.md.
- [x] Verify everything: server tests, web tests+build, sdk typecheck,
      mobile tsc + both bundles.

## Open Questions

None - the user explicitly asked to deduplicate (2026-07-20), overriding
the earlier defined-independently decision.

## Files Likely To Change

`shared/*` (new), `server/src/{model,notation}.ts`,
`web/src/common/{model,ttn}.ts`, `mobile/src/{model,ttn}.ts`,
`mobile/metro.config.js`, `mobile/tsconfig.json`, `sdk/src/index.ts`,
`mcp/server.ts`, claude.mds.

## Recovery Hints

If found half-done: typecheck each module; re-export shims mean import
sites never change, so failures localize to the shims or metro config.

## Checkpoints

- 2026-07-20 13:02 IST - Plan written.
- 2026-07-20 13:18 IST - Completed. shared/{model,ttn,copy}.ts; six
  duplicated files became thin shims (1,482 -> 884 lines, one protocol).
  sdk GameView + mcp GameState are now the shared Game. Mobile reaches
  shared/ via metro watchFolders + nodeModulesPaths. Verified: server
  87/87, web 9/9 + build, sdk tsc, mobile tsc + both bundles, mcp e2e
  3/3 (out-of-tree copy), playground trains and beats random.
