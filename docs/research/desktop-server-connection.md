# Research: Desktop Server connection and local proxy

- Status: Implemented and locally verified; remote and signed-release evidence pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: Desktop Client phase in `docs/ROADMAP.md`
- Acceptance journey: On first launch, a user enters an existing OpenBot Server origin, reviews the
  normalized destination, and connects. Desktop verifies the Server, persists only that public
  origin, then the packaged local Client can sign in, load channels, and receive SSE updates without
  exposing its HttpOnly session cookie or loading executable UI from the Server.
- Security boundary: The Server remains authoritative. The renderer, persisted bytes, Server
  responses, request paths, and IPC input are untrusted. The main process may proxy only bounded
  OpenBot API requests to one explicitly confirmed origin. Credentials remain in request memory and
  the dedicated Chromium Session; they are never written to the connection file or returned through
  preload. Invalid configuration, failed health proof, redirects, excess bodies, unsupported
  methods or headers, missing cookies, and unavailable Servers fail closed.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `electron v44.2.0 protocol.handle session.fetch`, Electron issue `45869`,
  `electron-store v11.0.2`, `@electron/asar 4.3.0`, and each candidate's source, releases, tests,
  issues, and license.
- Standards and primary documentation queries: Electron protocol handlers on custom Sessions,
  `Session.fetch`, cookie persistence, custom-scheme security, context isolation, typed IPC and
  sender validation; WHATWG Fetch request/redirect behavior; Node.js `app.getPath('userData')`
  integration and filesystem writes; OWASP CSRF Origin validation and custom request headers.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `AGENTS.md`, ADR-0029, ADR-0041,
  `docs/TECHNOLOGY.md`, `docs/ROADMAP.md`, `docs/research/desktop-application-foundation.md`,
  `docs/research/desktop-local-content-protocol.md`, both reuse ledgers, the Server Origin/session
  middleware, the Web REST/SSE transport, the Desktop main/preload boundary, and the existing
  `write-file-atomic` uses and review.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Session-specific `protocol.handle` plus `Session.fetch` | Electron [`v44.2.0`](https://github.com/electron/electron/releases/tag/v44.2.0) APIs and WHATWG Fetch | MIT; WHATWG terms | Current Electron API, upstream tests and documentation; already pinned and packaged by OpenBot | Electron documents the exact custom-protocol API-to-HTTPS forwarding composition. It retains proxy and cookie behavior in the dedicated Chromium Session, can stream SSE, and keeps the renderer same-origin with packaged code. OpenBot can bound the destination, methods, headers, bodies, and redirects in one main-process adapter. | Select for the data plane. |
| Typed IPC for connection configuration | Electron `v44.2.0` IPC/context bridge | MIT | Current API with explicit security guidance and existing OpenBot preload contract tests | A pair of narrow get/configure operations can validate the sender and return only public state. It is inappropriate for mirroring every REST call or streaming SSE. | Select only for configuration, never as a raw IPC or generic network bridge. |
| Direct renderer HTTP(S) and EventSource | WHATWG Fetch and HTML Living Standards | WHATWG terms | Widely implemented and already used by the Web Client | Cross-origin Desktop requests would need special CORS and SameSite behavior, expose the Server origin to renderer networking, and either expose credentials or make local HTTP self-hosting unreliable. A custom-scheme Origin becomes opaque rather than a trustworthy Server origin. | Reject for Desktop; retain unchanged for normal Web deployments. |
| Load the Server-hosted Client | Electron `v44.2.0` `BrowserWindow.loadURL` | MIT | Supported API | Simplifies relative APIs but executes remotely supplied UI inside the Desktop window, contradicting the accepted local-code boundary. | Reject. |
| Local loopback reverse proxy | Node.js `24.20.0` HTTP APIs | Node.js license | Maintained runtime APIs | Preserves browser-style URLs but adds an inbound listener, port selection, shutdown, origin, firewall, and collision surface solely for an internal transport. | Reject. |
| Persist with existing `write-file-atomic` | [`write-file-atomic` `8.0.0`](https://github.com/npm/write-file-atomic/tree/v8.0.0), existing reviewed dependency | ISC | Maintained released package with fsync, rename, serialization, cleanup, and existing OpenBot tests | Adds only its exact `signal-exit` runtime closure. Combined with a fixed file, 4 KiB read limit, strict versioned parser, no-follow checks, and `0600` creation, it closes partial writes without storing secrets. | Select. |
| Validate the final ASAR inventory | [`@electron/asar` `4.3.0`](https://github.com/electron/asar/tree/v4.3.0), official Electron package | MIT | Current released package with typed `listPackage`; already present in Packager's reviewed development graph | Declaring the build-only package directly avoids relying on a transitive import and lets packaging fail if either required runtime file is missing or an unreviewed dependency enters the ASAR. It is not included in the application archive. | Select only for build-time inventory validation. |
| `electron-store` | [`v11.0.2`](https://github.com/sindresorhus/electron-store/tree/v11.0.2), commit `e1470fd` | MIT | Maintained release, tests and issues; supports Electron 30+ | Useful for broad preferences, schemas, migrations and watchers, but widens the packaged runtime and configuration API for one public origin. Its encryption is not a substitute for platform secret storage. | Reject for this narrow file. |
| Direct `fs.writeFile` | Node.js `24.20.0` | Node.js license | Maintained core API | Can flush a file but does not by itself provide failed-temporary cleanup or per-destination write serialization already supplied by the reviewed dependency. | Reject. |

## Runtime experiment

The selected Electron `44.2.0` binary was run against a loopback HTTP server on 2026-09-04. A
dedicated `Session.fetch()` POST with `credentials: "include"` and an Origin equal to the target
origin succeeded; the next request carried the HttpOnly cookie set by the first response. Sending
`Origin: openbot://app` was serialized as `Origin: null` and failed with `net::ERR_FAILED`. This
evidence selects a main-process rewrite to the already-verified target origin and explicitly rejects
allowing `null`. It is development evidence for this Electron version, not a platform-support claim.

## Reuse decision

- Selected option: released dependency plus narrow adapter.
- Selected upstream or standard: Electron 44.2.0 session-specific `protocol.handle`,
  `Session.fetch`, typed IPC/context bridge, WHATWG URL/Fetch semantics, and the already reviewed
  `write-file-atomic` 8.0.0 dependency; `@electron/asar` 4.3.0 validates the final build inventory.
- Why this is the first viable option: it reuses the pinned runtime's documented streaming and
  cookie-aware network stack, does not add a listener, does not execute remote UI, and avoids a
  second generic request API in preload.
- Exact OpenBot-specific gap: validate and persist one versioned Server origin; prove `/health` with
  a bounded response; require explicit native confirmation; expose only public connection state;
  route the existing `/api/v1/*` and SSE requests through one bounded proxy; accept the Server's own
  request origin for mutations; and clear the dedicated Session when the destination changes.
- Upgrade, replacement, or exit plan: keep URL parsing, request policy, configuration parsing, and
  response validation as pure tests; run the cookie/Origin integration and packaged Client journey
  after every Electron major or network-stack change. A future authenticated local transport can
  replace the proxy without changing Web REST endpoints.
- Failure behavior when the upstream is missing, incompatible, or compromised: show the local setup
  or connection-failure screen; do not load remote UI, bypass TLS, follow redirects, allow opaque
  origins, send cookies to a different origin, widen IPC, or silently fall back to renderer network
  access.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: implementation will call public Electron and `write-file-atomic`
  APIs plus `@electron/asar`'s public package-list API. The URL/config/request/package policy is
  OpenBot-specific; no candidate source or tests are copied.
- Required copyright or license notice location: Electron is already listed in
  `THIRD_PARTY_NOTICES.md`; implementation adds the exact ISC notices for `write-file-atomic` and
  its only runtime dependency, `signal-exit`, before packaging either dependency.

## Verification plan

- Automated tests: canonical URL parsing; loopback HTTP versus remote HTTPS; credentials, path,
  query and fragment rejection; strict configuration format and size; atomic save/load; IPC sender
  validation; explicit confirmation outcomes; exact method/header/path allowlists; request-body
  bounds; target construction; same-origin rewrite; redirect rejection; health response bounds;
  cookie/session clearing on destination change; REST errors; and SSE streaming.
- Negative and fail-closed tests: symlinked, exposed POSIX, malformed, oversized or unknown-version
  configuration; `http` on non-loopback; opaque Origin; unsupported scheme or method; traversal;
  credential-bearing URL; hostile headers; missing or forged health shape; TLS/network timeout;
  response redirect; oversized upload; untrusted frame; and Server disappearance.
- Platforms and devices: portable pure/integration tests on Linux x64, Windows x64, and macOS arm64
  hosted runners; packaged macOS development launch against a local test Server. Signed installation
  and real-device matrices remain later gates.
- User-visible documentation and translations: update the Desktop section in both technology and
  roadmap documents when implemented; keep Web self-hosting behavior unchanged.
- Support level that the evidence permits: integrated Desktop connection development slice only;
  no operating system is Supported or Certified.

## Unresolved questions

- Public certificate trust, private certificate enrollment, proxy authentication, and explicit
  insecure-LAN exceptions need separate product and security review. This slice accepts remote
  HTTPS and loopback HTTP only.
- Signed installer identity, platform ACL evidence, updates, backup/recovery, and Server/Worker role
  onboarding remain later checkpoints.

## Verification evidence

- Desktop configuration, health proof, IPC sender, request proxy, archive policy, Web setup, and
  recovery tests pass locally: 81 Desktop tests and 49 Web tests on 2026-09-04. The Server suite
  passes all 142 tests, including 34 application tests, when the test environment permits its
  loopback WebSocket listener. The complete `npm run check` passes in that environment.
- A macOS arm64 unsigned development artifact built with Electron 44.2.0. Its post-package
  allowlist verified both required runtime packages and rejected any other `node_modules` subtree.
- The packaged application launched at `openbot://app/index.html` without the previous `SIGTRAP`,
  displayed the first-run setup, verified a loopback `/health`, presented the normalized origin in
  a native confirmation, and reached the shared login and workspace UI.
- The process-level journey observed the main-process mutation Origin equal to the confirmed target
  and an `HttpOnly; SameSite=Strict` session cookie on the subsequent workspace request. This is
  local development evidence, not signed distribution or general macOS support.
