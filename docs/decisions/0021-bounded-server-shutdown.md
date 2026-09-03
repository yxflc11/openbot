# ADR-0021: Drain authoritative work before Server shutdown

- Status: Accepted
- Date: 2026-09-04

## Context

`RunDispatcher.stop()` previously unsubscribed listeners and immediately deleted its Promise tails.
The asynchronous handlers continued running, so the signal handler could close PostgreSQL while a
Node result was still writing an artifact or committing Run state. The HTTP server also called
`closeAllConnections()` immediately, dropping in-flight requests instead of allowing a bounded
grace period. Repeated signals could start overlapping cleanup.

OpenBot needs to stop accepting work, close upgraded Node sockets explicitly, wait for already
accepted authoritative work, and only then close the database. Long-lived SSE and faulty handlers
also mean shutdown cannot wait forever.

## Upstream review

- [Node.js 22.22.2 `2645dc73` HTTP documentation](https://github.com/nodejs/node/blob/2645dc73720b1b4f27c49f395d3c66025ce126cc/doc/api/http.md)
  (MIT) defines `server.close()` as the stop-accepting and in-flight drain boundary,
  `closeIdleConnections()` for idle keep-alive sockets, and `closeAllConnections()` as a forceful
  fallback that does not close upgraded protocols such as WebSocket.
- [`@hono/node-server` 2.1.1 `73c03adf`](https://github.com/honojs/node-server/tree/73c03adfb01928fcd5f5b20faebd5d692f83fc93)
  (MIT) is already OpenBot's HTTP adapter and returns the underlying Node server. It does not own
  OpenBot's dispatcher, database, Node registry, or SSE lifecycle.
- [Fastify shutdown lifecycle `af079bd4`](https://github.com/fastify/fastify/blob/af079bd4c60c3cbebedc7640517d7288468fb5eb/docs/Reference/Server.md)
  (MIT) was reviewed as lifecycle prior art: mark closing, drain idle connections, stop accepting,
  wait for in-flight requests, close upgraded connections explicitly, then run final cleanup.
- [`@godaddy/terminus` 4.12.1 `aea2f6de`](https://github.com/godaddy/terminus/tree/aea2f6de06dbc9f631dd4ac8a21b91c052add3ce)
  (MIT) provides signal hooks, health checks, and timeouts for generic HTTP services.

## Reuse decision

Reuse the Node HTTP lifecycle already exposed by the Hono adapter. Do not add Terminus: OpenBot
already has health and signal wiring, while its essential gap is waiting for per-Run protocol tails
and Server-owned commits that a generic HTTP shutdown package cannot observe.

Implement only that gap as a small dispatcher drain contract and a tested wrapper around Node's
native close methods. Follow the Fastify ordering without adopting its server framework.

## Source incorporation

No upstream source or documentation was copied or substantially adapted. The lifecycle ordering is
cited as prior art; OpenBot's drain bookkeeping is specific to its Run dispatcher.

## Verification plan

- Unit tests delay a Node progress commit and prove `stop()` remains pending until it settles.
- Unit tests prove messages arriving after stop are ignored and repeated stop calls share one drain.
- HTTP shutdown tests cover normal close, timeout-driven force close, and close errors without a
  real network listener.
- The complete repository check must pass after the Server signal handler awaits dispatcher, HTTP,
  Node-registry, and database cleanup in order.

## Decision

1. Dispatcher listener work, per-Run message tails, and the active dispatch loop remain referenced
   until they settle. `stop()` is asynchronous and idempotent.
2. Stopping rejects new background dispatch and Node messages but finishes work already accepted by
   the dispatcher.
3. Signal handling is idempotent. It starts HTTP close, closes upgraded Node sockets, drains the
   dispatcher and HTTP requests, then closes PostgreSQL.
4. Idle HTTP connections close immediately. Remaining HTTP connections receive a 10-second grace
   period before `closeAllConnections()` is used; a forced close is logged.
5. A failed cleanup sets a failing process exit code. PostgreSQL is not closed before dispatcher
   work has settled.

## Consequences

- Results already accepted from a Worker Host are not abandoned merely because a signal arrived.
- New channel commands may finish persistence but remain queued once dispatch has stopped; startup
  recovery can offer them later.
- Long-lived SSE connections no longer block shutdown indefinitely.
- Force-closing an HTTP connection after the deadline can still interrupt a slow client response;
  the bounded grace period is an explicit availability tradeoff.
- Worker Host execution shutdown and resumable task handoff remain a separate future design.
