# Research: DEV-001 short-term security hardening

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: DEV-001 security follow-up
- Acceptance journey: an Owner can approve only a Server-classified action, login abuse remains
  throttled across Server restarts, control-plane errors/logs do not disclose secrets or local
  paths, and CI rejects known production dependency vulnerabilities and detected credentials.
- Security boundary: the Server remains the only policy, session, Run, audit, and Node identity
  authority. Direct peers are authoritative unless one exact trusted proxy is configured. Unknown
  policy actions, malformed forwarding metadata, unavailable durable throttle storage, untrusted
  Node error text, and scanner findings fail closed. Browser egress, proof of possession, Windows
  credential protection, and approval leases remain explicitly outside this short-term change.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: CEL releases/specification and issues; OPA releases, policy engine architecture,
  tests, and issues; Cerbos releases and deployment model; Pino and Winston releases, redaction,
  tests, and issues; TruffleHog, Gitleaks, and 2ms releases, licenses, actions, detectors, and open
  platform issues; CopilotKit/OpenBot `agent-computer` egress configuration and tests.
- Web component-test queries: jsdom and Happy DOM releases, engines, licenses, test suites,
  security advisories, DOM-compatibility issues, and Vitest browser-mode requirements.
- Standards and primary documentation queries: OWASP Authentication, Logging, and SSRF Prevention
  Cheat Sheets; NIST SP 800-63B-4 password and rate-limit requirements; RFC 7239 `Forwarded` trust
  model; Hono Node `getConnInfo`; PostgreSQL transaction advisory locks and `INSERT ... ON
  CONFLICT`; GitHub Actions immutable pinning; npm CLI `audit` data and exit behavior.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `AGENTS.md`, ADRs 0001, 0004, 0013,
  0021, 0022, 0025, 0026, and 0027; `docs/SECURITY.md`, `docs/API.md`,
  `docs/NODE_ENROLLMENT.md`, `docs/OPEN_SOURCE_REUSE.md`, and every DEV-001 candidate code/test
  path listed in `docs/reviews/DEV-001.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Local OpenBot static policy catalog using the existing evaluator | repository base `750bffde` | MIT | Existing Vitest coverage; owned with the protocol | Keeps the Server authoritative without another policy lifecycle; exact action/target/minimum-risk gap is small | Select now |
| Common Expression Language | specification `v0.25.2`, `cb51b4176013ad19bd00df94be273c322916a620` | Apache-2.0 | Active releases and conformance suite | Good future expression format, but does not supply OpenBot's policy distribution, signing, or capability-lease contract | Defer until editable policy exists |
| Open Policy Agent | `v1.16.2`, `85f6d990d19094da38e829561813e7da7fbae272` | Apache-2.0 | Active release, broad tests, active issues | Mature, but adds a sidecar/Wasm and policy-bundle lifecycle before OpenBot has editable policy | Do not add now |
| Cerbos | `v0.46.0` | Apache-2.0 | Active release and tests | Strong authorization service, but creates a second deployed authority and policy store | Do not add now |
| Local PostgreSQL throttle adapter | PostgreSQL 17, `ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1` | PostgreSQL License | Mature transaction and concurrency suite | Existing required datastore can atomically serialize a pseudonymous client bucket and fail closed | Select |
| `hono-rate-limiter` | `d593af1315184fdbd172eb9c90fe9021c134596c` | MIT | Maintained package with tests | Its storage still cannot decide whether forwarding metadata is trustworthy; duplicative after the local durable adapter | Do not add |
| `express-rate-limit` | `c8b3c7ff26cc285692f275f26624ad8bfa48f2d7` | MIT | Mature package with tests | Express-oriented and has the same client-identity trust prerequisite | Do not add |
| Pino | `10.3.1`, `6b344980eae3ebed904fc87caf4bba0ab9dbe946` | MIT | Current release, active repository, unit and integration tests | Small structured logger, child correlation fields, levels, and built-in path redaction; works on supported Node platforms | Select behind a narrow local API |
| Winston | `3.19.0` | MIT | Maintained and tested | Flexible transports are unnecessary here and broaden the configuration surface | Do not add |
| jsdom | `30.0.1`, `6584485f094d5b271553005b68804c93a455c002` | MIT | Current release; long-running Web Platform Tests and project unit tests | Matches the repository's exact Node engine floor and lets Vitest exercise React form/button semantics without a browser download or application network access | Select as a development-only DOM environment |
| Happy DOM | `20.14.0`, `eac5a38026b0569f2d52b609b2bb4cbaa94d9644` | MIT | Active releases and tests; recent VM/module-evaluation vulnerabilities are fixed in the selected line, while disabled-control and timer/observer differences remain documented | Faster/smaller candidate, but its open DOM behavior differences overlap the disabled-button and async-state assertions required by L1 | Do not add |
| Vitest browser mode with Playwright | package set `4.1.11` matching repository Vitest | MIT | Maintained in Vitest's browser suite | Best for rendered cross-browser integration, but introduces a Playwright peer plus browser binaries for two deterministic component state tests; retain for future e2e coverage | Defer; do not add |
| TruffleHog OSS | `3.97.1`, `20652fbbdefffcdaa493a5bf57ab2ac6b1db715b`; multi-arch image digest `sha256:deb2af10659a488a14d262a323addcde099d99827a1cf1dc4e93c17915c39f08` | AGPL-3.0 | Active releases, extensive detectors and tests; reviewed open Windows local-git issue | Run as a read-only CI tool, not linked or distributed; disable verification and updates so candidates and credentials are not sent to providers | Select for CI |
| Gitleaks | `v8.27.2`, `c7acf33` | MIT | Mature; project states feature-complete/security-fix maintenance | Good static alternative, but the official action has a separate organization license and the selected container path avoids that ambiguity | Reserve alternative |
| npm CLI audit | repository-pinned npm `10.9.8` | Artistic-2.0 | Mature package-manager tests and registry advisory service | Uses the committed lock tree, has severity exit codes, and is already available after `npm ci`; submits package/version metadata, not repository source | Select for production dependencies |
| OWASP SSRF guidance plus current `agent-computer` | OWASP `b8586414`; OpenBot `agent-computer` `257c1280` | CC BY-SA 4.0 docs; MIT | Maintained guidance; upstream adapter has tests | Guidance requires redirect/DNS enforcement at the requester or network layer. The current separate browser service cannot honor the Provider's prior DNS lookup | Defer M2 and keep trusted-test-only claim |

## Reuse decision

- Selected option: standard plus dependencies, with small OpenBot-specific adapters.
- Selected upstream or standard: RFC 7239 and Hono `getConnInfo` for peer attribution; OWASP/NIST
  authentication and logging requirements; PostgreSQL transaction locks/upserts; Pino 10.3.1;
  jsdom 30.0.1 for development-only component interaction tests; TruffleHog 3.97.1 by immutable
  container digest; repository-pinned npm audit.
- Why this is the first viable option: it reuses the existing authoritative Server and PostgreSQL
  boundary, adds one maintained runtime primitive for structured logs, and makes CI checks
  reproducible without sending repository content or candidate secrets to verification services.
- Exact OpenBot-specific gap: a static action catalog, risk-floor comparison, strict single-hop
  trusted-proxy parser, pseudonymous client digest, durable login bucket, allowlisted public error
  mapping, and correlated dispatch-failure audit records.
- Upgrade, replacement, or exit plan: replace the static catalog only when editable signed policy
  bundles are designed; replace the PostgreSQL throttle behind its interface if a distributed
  identity-aware store becomes necessary; Pino is isolated behind `@openbot/logging`; update scanner
  release/digest only through a new dependency review.
- Failure behavior when the upstream is missing, incompatible, or compromised: Server startup or
  type checks fail for runtime dependencies; login fails closed when the durable store fails;
  malformed/untrusted forwarding data is rejected or ignored according to the explicit proxy
  contract; CI fails on audit/scanner errors or findings; no fallback accepts Node-supplied policy or
  raw public errors.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: Pino is consumed as an npm dependency through a local allowlisted
  logging wrapper. jsdom is a development-only Vitest environment. TruffleHog runs as an external
  CI container. Standards informed local behavior.
- Required copyright or license notice location: package lock and this ledger for Pino and jsdom;
  CI source/image comments and this ledger for TruffleHog. No AGPL binary is shipped with OpenBot.

## Verification plan

- Automated tests: policy unknown-action and risk-downgrade rejection; durable throttle transition,
  reset, restart, and concurrent attempts; direct/trusted-proxy/malformed identity parsing; Node
  enrollment audit metadata; structured logging level/redaction; public error normalization;
  persisted dispatch failure; existing Provider conformance after declaration-only dependencies move.
- Web component tests: login input/submission/error recovery and approval approve/reject pending,
  duplicate-action suppression, error recovery, semantic labels, and alert announcements.
- Negative and fail-closed tests: missing peer, spoofed `Forwarded`, multiple proxy hops, database
  throttle failure, Node token/path in `run.failed`, logger secret keys, unknown actions, and a lower
  Node risk than the catalog floor.
- Platforms and devices: Linux CI plus local macOS; Windows remains Development until native
  credential protection has real-Windows evidence. The Docker browser Provider remains a trusted
  test adapter, not an SSRF boundary.
- User-visible documentation and translations: update English and Chinese security, architecture,
  setup/environment, Node enrollment, and reuse-ledger claims together.
- Support level that the evidence permits: hardened pre-alpha control plane; no production-ready,
  proof-of-possession, browser-isolation, Windows-secret-storage, or capability-lease claim.

## Unresolved questions

- A signed, TTL-bound, single-use capability lease needs its own protocol and cryptographic key
  lifecycle review before any real side-effecting Provider is enabled.
- Non-exportable Node keys, rotation, native macOS/Windows/Linux keyrings, recovery, and migration
  remain a separate identity project.
- Browser egress must be enforced in `agent-computer` or its network namespace, including redirects
  and DNS/connect binding; another application-layer preflight would remain security theater.
- A compromised-password blocklist for an environment-supplied deployment secret needs an offline,
  privacy-preserving source and lifecycle review; this slice raises the single-factor minimum to the
  NIST 15-character floor and keeps rate limiting/TLS independent.
