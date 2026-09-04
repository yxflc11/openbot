# ADR-0042: Desktop proxies one confirmed Server through its dedicated Session

- Status: Accepted
- Date: 2026-09-04

## Context

The packaged Desktop Client currently loads only local React/Vite assets at `openbot://app`, while
the shared Web Client calls relative REST and EventSource endpoints. Desktop needs to connect that
same interface to an existing local or remote OpenBot Server without executing remote UI, exposing
session credentials to preload, opening a loopback listener, or weakening the Server's Origin
checks.

The Server origin is public configuration, but changing it redirects the destination that receives
an Owner password. It therefore requires strict persistence, explicit user confirmation, and
fail-closed replacement even though it is not itself a secret. The Server remains the only source
of identity, authorization, routing, approvals, audit, and durable product state.

Full evidence is recorded in the
[Desktop Server connection research](../research/desktop-server-connection.md).

## Upstream review

Electron `44.2.0` custom protocols, dedicated Sessions, Chromium-backed fetch/cookies, context
bridge and sender validation; WHATWG Fetch/URL; Node.js `24.20.0`; the existing
`write-file-atomic` `8.0.0`; build-only `@electron/asar` `4.3.0`; rejected `electron-store`
`11.0.2`; direct renderer networking; a local HTTP proxy; remote UI loading; and a generic IPC
request bridge were reviewed. Exact versions, maintenance, tests, issues, fit, licenses, and
rejection reasons are in the research record.

A process-level Electron 44.2.0 experiment proved that `Session.fetch()` retains an HttpOnly cookie
when the request Origin equals the target origin. A custom `openbot://app` Origin became opaque
`null` and failed. The implementation must not trust `null`; the main process rewrites mutations to
the exact already-validated Server origin, and the Server accepts its own request origin as the
ordinary same-origin case in addition to configured Web origins.

## Reuse decision

Use the pinned Electron Session and protocol APIs for the streaming data plane, the existing typed
context bridge pattern for two configuration operations, and the already-reviewed
`write-file-atomic` dependency for the fixed public configuration file. Use the official
`@electron/asar` package only at build time to fail if the reviewed runtime closure is missing or
widened. Do not add a general preference framework, another HTTP listener, or a generic IPC request
bridge. OpenBot implements only the destination validation, health proof, confirmation, proxy
policy, package allowlist, and Server same-origin gap that none of those upstream APIs owns.

## Decision

- Keep the renderer at `openbot://app` with `connect-src 'self'`; do not add arbitrary HTTP(S) to its
  CSP and do not load Server-hosted executable UI.
- Route only same-origin `/api/v1/*` and approved health requests through the custom protocol handler
  to one main-process Server origin.
- Use the window's dedicated persistent Electron Session for outbound fetch and cookies. Credentials
  use `credentials: "include"`, redirects are manual and rejected, and no cookie or authentication
  token crosses preload.
- Permit remote `https:` Server origins and loopback `http:` origins. Reject credentials, subpaths,
  query, fragment, non-loopback cleartext, malformed values, and values longer than 2,048 bytes.
- Verify a bounded `200` `/health` response identifying `openbot-server` before native confirmation
  and persistence. A failed check changes no configuration.
- Persist only `{ format, serverUrl }` below an application-specific `userData` child directory with
  a 4 KiB load limit, no-follow regular-file validation, restrictive POSIX mode, strict versioned
  parsing, and `write-file-atomic`.
- Expose only typed `getConnectionState()` and `configureServer(url)` operations through preload.
  Validate the exact top-frame sender and every input/result. Do not expose raw IPC, fetch, Session,
  filesystem, environment, or paths.
- Require native confirmation of the normalized origin. When the confirmed destination changes,
  clear the dedicated Session's cookies and cache before using the new origin.
- Allowlist the current REST methods and headers, cap forwarded request bodies, preserve streaming
  responses for SSE, and reject redirects or destinations outside the configured origin.
- Extend Server CSRF validation with its own exact request origin as the normal same-origin case.
  Do not accept absent, wildcard, or opaque `null` origins for browser-style mutations.
- When configuration is absent or invalid, show packaged setup UI and return a bounded `503` from
  API proxy requests. Never fall back to remote UI or unrestricted renderer networking.

## Source incorporation

No Electron, `write-file-atomic`, `electron-store`, WHATWG, Node.js, or OWASP source, tests, or
templates are copied or substantially adapted. Public APIs and specifications are used directly.
Existing dependency notices remain mandatory, and the Desktop package inventory must include only
the exact new runtime closure.

## Verification plan

Pure and integration tests must cover configuration parsing/storage, strict IPC sender and input
validation, native confirmation, health proof, target construction, method/header/body bounds,
same-origin mutation rewriting, HttpOnly cookie reuse, REST and SSE forwarding, redirect rejection,
destination replacement, and every fail-closed state. Hosted runners may prove only portable
build/test compatibility. A packaged development launch can prove this slice opens and connects on
the named machine; signed real-device evidence remains required before any support label.

## Consequences

Desktop can reuse the full Web interface and SSE flow while its executable code remains local and
its login cookie remains outside preload. The same Server API continues to serve Web and Desktop,
and changing a connection cannot silently redirect credentials.

The main process now has a narrow network and public-configuration responsibility that requires
request-policy, IPC, storage, cookie, timeout, and redirect tests. Private CA trust, proxy login,
insecure LAN opt-in, role onboarding, signing, updates, and real-device support remain separate
Owner checkpoints.
