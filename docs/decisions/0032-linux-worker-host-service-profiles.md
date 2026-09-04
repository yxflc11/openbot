# ADR-0032: Linux system and user Worker Hosts use explicit credential profiles

- Status: Accepted
- Date: 2026-09-04

## Context

The existing Linux unit is a deployment sketch and the Node's production credential abstraction
has only a file adapter. G3 requires a service lifecycle and Linux Secret Service without implying
that a machine-wide daemon can access a desktop user's keyring.

Secret Service sessions are bound to the caller's D-Bus session bus. Collections may lock at any
time and operations may require a user prompt. A system unit running as a dedicated `openbot` user
normally has no logged-in desktop session. Injecting another user's session-bus address would mix
security principals and make service startup depend on an unrelated login.

The upstream comparison and exact pins are recorded in
[Linux Worker Host service and Secret Service research](../research/linux-worker-host-service-and-secret-service.md).

## Upstream review

- Secret Service API 0.2 binds secrets to a D-Bus login session and defines locked collections and
  prompts; it is not a machine-wide headless credential service.
- GNOME libsecret/`secret-tool` `0.21.7` (`0936f740`) is maintained and exposes the selected narrow
  process contract without adding a Node native addon.
- systemd `v255` (`db11bab3`) provides the state-directory and service sandbox directives used by
  the Ubuntu 24.04 baseline.
- `@napi-rs/keyring` `2.0.0` is maintained but silently falls back from Secret Service to kernel
  keyutils on Linux. `node-keytar` `7.9.0` is archived. Neither meets the explicit-backend rule.

## Reuse decision

Adopt the Secret Service standard, the released external `secret-tool`, and systemd's declarative
service sandbox. Implement only OpenBot's bounded process adapter, credential-backend selection,
identity validation, and separate system/user profiles. A generic cross-platform dependency cannot
be selected while it changes Linux storage semantics after a runtime failure.

## Source incorporation

No upstream source or tests are copied or substantially adapted. The units use public systemd
directives and the adapter uses the public `secret-tool` command contract; licenses and exact pins
are recorded in the research note and reuse ledger.

## Verification plan

- Contract-test every process outcome without requiring a real keyring in hosted CI.
- Check both service units for explicit storage mode, dedicated state, no inbound listener, and the
  accepted sandbox directives.
- Require real Ubuntu 24.04 x64/arm64 systemd evidence and unlocked/locked login-session keyring
  evidence before changing the Linux support level.
- Keep English and Simplified Chinese enrollment/deployment guidance aligned.

## Decision

1. Linux exposes two explicit, non-fallback profiles:
   - a machine-wide system unit runs as the dedicated `openbot` account and uses the existing
     Owner-only file adapter under its systemd-managed state directory;
   - a user unit runs inside one dedicated logged-in user's service manager and may explicitly use
     Secret Service from that same login session.
2. `OPENBOT_NODE_CREDENTIAL_STORE` selects `file` or `secret-service`. File is the compatibility
   default. Selecting Secret Service on another OS, setting a file path with that backend, or
   losing the helper/session/keyring fails startup; it never falls back to the file adapter.
3. The Secret Service adapter invokes `secret-tool` directly without a shell. The identity is sent
   only on stdin and returned only on captured stdout. Lookup attributes are non-secret and bind
   application, kind, format, and Node id.
4. Helper execution has a hard deadline and 4 KiB stdout/stderr bounds. Timeout, signal, spawn
   failure, unexpected exit, or any ambiguous output becomes a generic local error. Raw helper
   stderr and secret bytes are not logged or copied into diagnostics.
5. The reviewed `secret-tool` source returns exit 1 with empty stdout and stderr for no match. Only
   that exact outcome means `undefined`; every other non-zero outcome fails closed.
6. Both units keep outbound-only networking and a dedicated writable state directory. The system
   unit drops capabilities and applies systemd v255-compatible filesystem, device, kernel,
   privilege, and personality protections. V8-incompatible executable-memory denial and broad
   syscall filtering are deferred until real-host tests justify them.
7. This slice does not grant a Linux support label. Real systemd x64/arm64 lifecycle evidence and
   real unlocked/locked keyring evidence remain mandatory.

## Consequences

- Operators can tell which principal owns a Node credential and which lifecycle it follows.
- A headless server remains predictable across boot without borrowing a human D-Bus session.
- A desktop Worker Host can keep the bearer identity outside an ordinary configuration file, while
  locked or unavailable keyrings stop the Node instead of weakening storage.
- The command-line adapter adds a trusted local executable boundary. Packaging must pin and install
  a reviewed libsecret-tools version, and tests must continue to pin its exit semantics.
- The stored value is still copyable. G6 proof of possession, mTLS, rotation, and replay protection
  remain required before an untrusted-network claim.
