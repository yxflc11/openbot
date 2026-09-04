# Research: Desktop local content protocol

- Status: Accepted for the Desktop secure-shell slice
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: Desktop secure-shell phase in `docs/ROADMAP.md`
- Acceptance journey: The packaged Desktop application opens its bundled React Client without
  granting the renderer ambient filesystem access or loading executable UI from the network.
- Security boundary: The main process maps one secure application origin to read-only files below
  `dist/renderer`. The renderer, URL input, query text, and fragments are untrusted. Unknown hosts,
  path traversal, encoded separators, non-GET requests, missing assets, and handler failures fail
  closed.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `electron GrantFileProtocolExtraPrivileges ERR_FILE_NOT_FOUND asar` and Electron's
  current ASAR URL-loader source.
- Standards and primary documentation queries: Electron 44 protocol handling, session-specific
  protocol registration, custom-scheme privileges, security checklist item 18, ASAR archives,
  ASAR integrity, and fuse behavior.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `AGENTS.md`, ADR-0039, ADR-0041,
  `docs/research/desktop-application-foundation.md`, `docs/SECURITY.md`, both open-source reuse
  ledgers, and the Desktop main-process and package-policy implementation.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Privileged `file://` | Electron 44.2.0 built-in behavior | Electron MIT | Maintained with Electron | Makes startup simple, but Electron documents extra filesystem, frame, fetch, and service-worker privileges and recommends avoiding it. | Reject. Keep `GrantFileProtocolExtraPrivileges` disabled. |
| `protocol.handle` plus a bounded adapter | Electron 44.2.0 API | Electron MIT; OpenBot adapter MIT | Current non-deprecated API; contract-testable path mapping | Creates a normal secure origin, works with a dedicated session, preserves CSP, and permits an exact bundle-root allowlist. | Select. |
| Local HTTP server | Node.js 24.20.0 built-in HTTP APIs | Node.js MIT | Maintained with Node.js | Adds a listening socket, port lifecycle, origin variance, and another attack surface solely to read immutable bundled assets. | Reject. |

Primary documentation reviewed:

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security) recommends
  a custom protocol instead of `file://` and explains the local-file exposure being avoided.
- [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol) defines
  `registerSchemesAsPrivileged`, `protocol.handle`, and the requirement to register a handler on the
  same custom session used by a window.
- [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses) states that applications
  not serving renderer pages from `file://` should disable its extra privileges.
- [Electron ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity) documents
  Packager's integrity metadata and the paired embedded-integrity and ASAR-only fuses.

## Reuse decision

- Selected option: released dependency followed by a narrow adapter.
- Selected upstream or standard: Electron 44.2.0 `protocol.handle` and WHATWG `URL` parsing.
- Why this is the first viable option: it is Electron's supported security path, introduces no
  dependency or listening service, and keeps the allowed file set visible in a small pure function.
- Exact OpenBot-specific gap: accept only `openbot://app/<bundle-path>` and map it to the immutable
  renderer root without permitting encoded separators or traversal.
- Upgrade, replacement, or exit plan: keep the resolver independent of Electron; re-run its negative
  contract tests and a packaged launch smoke test with every Electron upgrade.
- Failure behavior when the upstream is missing, incompatible, or compromised: do not enable
  privileged `file://`, do not fall back to remote UI, and exit startup without showing a partially
  privileged window.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: the implementation calls public Electron APIs and uses an
  OpenBot-specific URL resolver; no Electron source is copied.
- Required copyright or license notice location: Electron remains recorded in
  `THIRD_PARTY_NOTICES.md` and the open-source reuse ledgers.

## Verification plan

- Automated tests: valid asset mapping, query/fragment handling, malformed URLs, wrong origin,
  root requests, plain and percent-encoded traversal, encoded separators, and NUL bytes.
- Negative and fail-closed tests: unknown host or scheme, path escape, non-read methods, missing
  files, and protocol-handler failure.
- Platforms and devices: portable resolver tests on CI; unsigned packaged launch smoke on macOS
  arm64 during development; signed real-device checks remain required before support claims.
- User-visible documentation and translations: no onboarding claim changes in this narrow slice;
  update both technology documents when the packaging baseline is corrected.
- Support level that the evidence permits: development packaging only; no operating-system support
  claim.

## Unresolved questions

- Release signing, update delivery, and real-device matrices remain Owner checkpoints in later
  phases.
