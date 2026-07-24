## What this changes

<!-- A short description of the change and why. -->

## Protocol impact

<!-- Does this touch shared/ (the wire protocol)? If so, it must change
     server, web, and mobile together. If not, say "none". -->

- [ ] No change to `shared/` (the wire protocol)
- [ ] Changes the protocol - server, web, and mobile updated together

## Verification

<!-- Tick what you ran; paste anything surprising. -->

- [ ] `cd server && bun run typecheck && bun test`
- [ ] `cd web && bun run typecheck && bun test && bun run build`
- [ ] `cd sdk && bun run typecheck`
- [ ] `cd mobile && bun run typecheck && bun run bundle:android && bun run bundle:ios`
- [ ] Added a test for every new validation rule / engine transition
- [ ] Ran `bun run bench` (only if the winner calculation changed)

## Notes

<!-- Screenshots for UI changes, follow-ups, anything a reviewer should know. -->
