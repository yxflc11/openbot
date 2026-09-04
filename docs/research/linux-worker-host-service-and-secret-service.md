# Research: Linux Worker Host service and Secret Service boundary

- Status: Accepted
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G3 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: an operator selects either a headless system service with an Owner-only
  credential file or a logged-in user service with Secret Service; the Node enrolls once, restarts
  with the same identity, and refuses to connect when its configured storage boundary is missing,
  locked, inaccessible, ambiguous, or incompatible.
- Security boundary: the Server remains the only authority for Node identity, revocation, routing,
  approvals, and audit. The Linux host stores only the currently issued bearer identity and cannot
  grant itself authority. Service units and keyring clients are untrusted deployment surfaces;
  they receive no inbound listener, no fallback credential store, and bounded inputs and outputs.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries:
  - `linux node keyring secret service npm maintained native addon`
  - `github node-keytar archived Secret Service Linux`
  - `keyring-node LinuxCredentialBuilder Secret Service fallback keyutils`
  - `systemd service Node.js hardening StateDirectory ProtectSystem`
- Standards and primary documentation queries:
  - `Secret Service API 0.2 session bus locked prompt attributes`
  - `libsecret 0.21.7 secret-tool lookup exit status source`
  - `systemd v255 systemd.exec StateDirectory security directives`
  - `Ubuntu 24.04 release notes systemd version`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0017, ADR-0023, the
  cross-platform Worker Host plan, the Node enrollment guide, the POSIX credential permission
  review, and the `Node bootstrap identity` / `POSIX credential permission drift` ledger rows.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Freedesktop Secret Service | API 0.2 draft, published 2026-04-08 | Specification, no linked runtime | Cross-desktop D-Bus contract implemented by GNOME Keyring and KWallet | Defines sessions on the user's D-Bus session bus, locked collections, prompts, and non-secret lookup attributes. It does not describe a machine-wide headless daemon keyring | Adopt the protocol and its user-session boundary |
| GNOME `libsecret` / `secret-tool` | `0.21.7` / `0936f740c02b60f02657729cd99f581db4517a41`; release archive SHA-256 `6b452e4750590a2b5617adc40026f28d2f4903de15f1250e1d1c40bfd68ed55e` | LGPL-2.1-or-later | Current 0.21 release with library/tool tests and official source archives | `secret-tool` sends stored bytes through stdin/stdout, updates an item with the same attributes, and surfaces D-Bus failures. Lookup returns 1 both for no match and errors, but the reviewed source writes an error only for the latter | Select as a thin external-process adapter; require exact bounded outcome handling |
| `@napi-rs/keyring` | `2.0.0` / `f3449416a1b4bf11b0570f0a49395aacc84c8608` | MIT | Active release, Rust tests, and published Linux x64/arm64 glibc/musl binaries | Its reviewed `LinuxCredentialBuilder` silently falls back from Secret Service to Linux kernel keyutils. That violates explicit backend selection and makes lifetime/session semantics different from the configured policy | Reject until upstream exposes fail-closed backend selection |
| `node-keytar` | `7.9.0` / `5adb540f8557801c52254e969a6c7ed9ef4d16f0` | MIT | Repository archived on 2022-12-15; native build and platform dependency surface is no longer maintained | Historically supports Secret Service but is not a viable new security dependency | Reject |
| systemd unit sandbox | `v255` / `db11bab38ccf1ed257f310d29070843d4c58ea01` | LGPL-2.1-or-later | Upstream test suite and maintained service manager; Ubuntu 24.04 ships the v255 line | `StateDirectory`, `UMask`, empty capability sets, `NoNewPrivileges`, read-only system paths, private devices/tmp, and kernel/control-group protections fit a Node process. `MemoryDenyWriteExecute` conflicts with V8 JIT and broad syscall filters need real-device evidence | Adopt compatible declarative hardening, then validate on real Linux hosts |

## Reuse decision

- Selected option: open standard plus thin, pinned adapter and declarative service configuration.
- Selected upstream or standard: Secret Service API 0.2, GNOME libsecret/`secret-tool` 0.21.7,
  and systemd v255 semantics.
- Why this is the first viable option: OpenBot can use the platform's maintained command-line
  client without introducing a native Node addon or copying D-Bus protocol code. Explicit process
  outcomes let OpenBot reject every unconfigured fallback.
- Exact OpenBot-specific gap: select the credential backend, bind attributes to one Node id, bound
  process lifetime and output, distinguish the reviewed no-match outcome from D-Bus errors, parse
  the existing strict identity schema, and provide separate system/user service profiles.
- Upgrade, replacement, or exit plan: package a reviewed `libsecret-tools` release and rerun the
  adapter contract tests when its source behavior changes. Prefer an upstream explicit-backend
  option in a maintained Node keyring package if one later meets the same failure contract.
- Failure behavior when the upstream is missing, incompatible, or compromised: startup fails with
  a generic diagnostic; no enrollment exchange, connection, store fallback, raw stderr, or secret
  value is emitted. Timeout or oversized output terminates the helper and fails closed.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: only the published `secret-tool` process contract and systemd unit
  directives are used. No libsecret, systemd, keyring-node, or keytar source is copied.
- Required copyright or license notice location: exact upstream and license lineage is recorded
  here and in `docs/OPEN_SOURCE_REUSE.md`; external system packages retain their own notices.

## Verification plan

- Automated tests: exact helper arguments and stdin, identity round trip, file-mode preservation,
  explicit store selection, system/user unit policy, and configuration conflicts.
- Negative and fail-closed tests: missing executable, timeout, signal, non-zero error, ambiguous
  non-zero output, stderr on apparent no-match, oversized stdout/stderr, invalid JSON, wrong Node
  id, and unsupported platform.
- Platforms and devices: hosted tests use a fake process boundary only. Ubuntu 24.04 x64 and arm64
  real-host evidence is required for systemd lifecycle; a real logged-in desktop session with an
  unlocked and locked Secret Service is required for the keyring claim.
- User-visible documentation and translations: explain the two service profiles, why a system
  service cannot use a login-session keyring, safe enrollment cleanup, and current bearer limit in
  English and Simplified Chinese.
- Support level that the evidence permits: contract-tested experimental Linux storage/service
  configuration only. It is not yet Linux support, device attestation, or a signed installer.

## Unresolved questions

- Signed archive layout, bundled Node runtime, checksums, SBOM, upgrade/rollback transaction, and
  deb/rpm ownership require a separate packaging review before installation artifacts are added.
- Proof-of-possession keys may need different Secret Service item content and access policy; G6
  will version rather than silently mutate this bearer identity format.
- Whether a distribution's default keyring can unlock non-interactively is deployment-specific.
  OpenBot will not create, unlock, or weaken a user's keyring automatically.
