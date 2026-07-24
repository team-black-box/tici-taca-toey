# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, not as a public issue.

Use GitHub's private vulnerability reporting for this repository
(*Security -> Report a vulnerability*), or open a private security advisory.
We will acknowledge as soon as we can and keep you posted on a fix.

## Scope

The things most worth a careful look:

- The `playerKey` is the only credential in the system. It is a secret: it
  is never logged, never rendered, and never placed in a URL the server can
  see. The server stores only its SHA-256 hash.
- Every websocket payload is parse-guarded and every engine transition is
  wrapped, so a single bad message must never take down the server.
- Input limits (board size, player count, name length, payload size,
  connection and game caps) protect the box from abuse.

If you find a way around any of these, we want to hear about it.

## Not in scope

Denial-of-service through sheer volume against a single small box is a known
trade-off of the deployment, not a vulnerability - see
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for the capacity stance.
