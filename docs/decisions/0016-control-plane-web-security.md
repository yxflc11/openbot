# ADR-0016: Fail-closed browser sessions and bounded realtime delivery

- Status: Accepted
- Date: 2026-09-04

## Context

OpenBot's browser client can observe and approve computer work, so ordinary dashboard defaults are
not sufficient. A previous implementation already used an HttpOnly, SameSite=Strict session cookie,
an exact Origin allowlist, and authenticated SSE. The retrospective open-source review found three
remaining gaps:

1. a remote origin could be configured with insecure HTTP or without a Secure cookie;
2. the API omitted a consistent set of defensive response headers; and
3. each SSE subscriber used an unbounded pending array when a client could not consume events.

The in-memory login limiter is intentionally deployment-scoped. Its current browser-Origin key is
not a trustworthy per-device identity and can cause a shared temporary lockout. That limitation is
recorded rather than hidden behind forwarded headers that OpenBot cannot authenticate yet.

## Upstream review

- [Hono `e2740d5a`](https://github.com/honojs/hono/tree/e2740d5a1bd0b4254e517e3af8b60789284bc7bd)
  (MIT) already ships the `secureHeaders` middleware and a streaming writer that awaits the
  underlying `WritableStream`. OpenBot reuses the published middleware rather than recreating the
  header set. Hono does not bound application-owned subscriber queues.
- [OWASP Cheat Sheet Series `b8586414`](https://github.com/OWASP/CheatSheetSeries/tree/b8586414a5c47ae68911edb97d4e7b7bc6301035)
  (CC BY-SA 4.0 for documentation) recommends Secure, HttpOnly, SameSite cookies, exact Origin
  verification, TLS for the complete session, security headers, and the `__Host-` cookie prefix.
  OpenBot applies these controls without copying OWASP text or source.
- [hono-rate-limiter `d593af13`](https://github.com/rhinobase/hono-rate-limiter/tree/d593af1315184fdbd172eb9c90fe9021c134596c)
  (MIT) and
  [express-rate-limit `c8b3c7ff`](https://github.com/express-rate-limit/express-rate-limit/tree/c8b3c7ff26cc285692f275f26624ad8bfa48f2d7)
  (MIT) were reviewed for login throttling. Neither can infer a real client identity through an
  untrusted reverse proxy. OpenBot therefore defers a dependency until Node enrollment or a trusted
  proxy contract supplies an authenticated key.

No upstream source was copied or substantially adapted.

## Decision

1. Reuse Hono's pinned `secureHeaders` middleware. API responses deny framing, disable unneeded
   browser capabilities, use `nosniff` and a no-referrer policy, and apply HSTS only to deployments
   configured for Secure cookies.
2. Configuration parsing rejects non-HTTP(S) origins. Every non-loopback origin must use HTTPS and
   also requires `OPENBOT_SECURE_COOKIES=true`; invalid combinations stop the Server before it opens
   a listener.
3. HTTPS deployments use the host-only `__Host-openbot_session` cookie. Loopback development keeps
   `openbot_session` because browsers cannot require Secure transport for a plain HTTP workflow.
4. The direct-development bind default is loopback. Docker Compose may listen on all interfaces
   inside its container because the published host port remains explicitly bound to `127.0.0.1`.
5. Each SSE subscriber may retain at most 128 pending projections. Overflow clears the pending
   references and aborts the connection; it never silently drops one event while continuing the
   same stream.
6. Reconnection is recovery, not proof of continuity. Channel clients reload authoritative messages
   and Runs after `channel.ready`; workspace clients reload the authoritative workspace after
   `workspace.ready`.
7. Login throttling remains a small deployment-local safeguard, not a distributed or per-device
   guarantee. A future implementation must define trusted-proxy handling, IPv4/IPv6 normalization,
   shared storage, and fail-closed store behavior before adopting a rate-limit package.

## Consequences

- Unsafe remote session configuration is rejected at startup instead of producing a warning.
- The browser receives a maintained, tested security-header baseline without adding a new package.
- A stalled browser has a fixed memory ceiling and recovers from the database rather than receiving
  a partial event history.
- An overloaded stream can briefly show a reconnecting state, but cannot grow Server memory without
  bound.
- OpenBot still requires a private network and HTTPS; these controls do not make the Server safe for
  arbitrary public-Internet exposure.
