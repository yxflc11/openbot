# ADR-0039: A native macOS Host gates Keychain identity and supervises Node

- Status: Accepted
- Date: 2026-09-04

## Context

ADR-0038 selected a user-approved `SMAppService` LaunchAgent and proposed that a small launcher
immediately replace itself with Node. Keychain analysis exposed a conflict: after `exec`, a generic
Node process would need a native addon, a credential-bearing environment/argument/file, or a
separately invokable helper. None preserves the required fixed invocation and non-export boundary.

The full evidence is in
[macOS Worker Host configuration and Keychain research](../research/macos-worker-host-config-and-keychain.md).
The Server remains the only identity and capability authority.

## Upstream review

Apple Security, data-protection Keychain, Keychain access-group, restricted-entitlement signing,
Service Management, launchd, and POSIX child-process contracts were reviewed. Exact released
candidates include SwiftSecurity `2.0.0` / `c26f18ad`, KeychainSwift `24.0.0` / `5e1b02b6`,
`@napi-rs/keyring` `2.0.0` / `f3449416`, Cosmiconfig `10.0.1` / `219805f4`, Convict `6.2.5` /
`517840e1`, Node.js `22.22.2` / `2645dc73`, and Zod `4.5.4` / `e8e206fa`. Their licenses,
maintenance, tests, defaults, and security fit are recorded in the research file.

## Reuse decision

Use Apple Security directly and reuse pinned Node core and Zod. Keep a narrow native Host alive to
query one item, pass it over the private child pipe, and supervise one fixed Node process group.
General wrappers, config search/merge libraries, shell/CLI helpers, and a generic Node native addon
add callable or mutable surfaces without enforcing OpenBot's invocation policy.

This decision supersedes only ADR-0038's immediate-`exec` process-model clause. Its LaunchAgent,
dedicated-user, fixed-bundle, user-approval, retry, shutdown deadline, and no-desktop-authority
decisions remain accepted.

## Source incorporation

No candidate source or tests are copied or substantially adapted. The implementation uses public
Apple/POSIX APIs and existing OpenBot code. No new third-party runtime dependency is selected.

## Verification plan

Portable tests cover strict config and child frames. Hosted macOS tests compile the Swift package
and exercise pure query, parsing, and supervision state. A dedicated signed real-device fixture must
then prove Keychain access groups, locked/denied behavior, one-time identity handoff, no inherited
environment, process-group cleanup, login/logout/reboot, and background-item states. Distribution
tests separately inspect entitlements, profiles, nested signatures, hardened runtime, notarization,
and stapling.

## Decision

- launchd starts the fixed app's main executable with the sole `--worker-host` argument. With no
  arguments the same executable opens the controller. Both paths therefore share one app-like bundle,
  application identifier, provisioning profile, and Keychain access-group entitlement.
- The Host runs as the dedicated non-root user, validates one fixed public configuration, derives
  one expected shared Keychain access group from its signed entitlement, and queries one exact
  generic-password item from the data-protection Keychain.
- The Keychain item must be non-synchronizing, `WhenUnlockedThisDeviceOnly`, at most 4 KiB, and a
  strict versioned envelope containing the exact OpenBot Node identity, configured Node id, and
  configured Server URL. Any mismatch fails before child `START`; ADR-0040 records the registration
  and Server-binding transaction.
- The Host starts only the bundled Node and entry point with a cleared, allowlisted environment. It
  contains the inert child in one process group, sends the identity only through inherited stdin,
  then sends `START`; shutdown is cooperative first and kills the entire group on timeout.
- The service does not accept an enrollment token or save/rotate an identity. The later registration
  app owns one-time enrollment and verified Keychain insertion. The Server still decides whether the
  resulting Node identity is valid or revoked.
- Public config lives only at the dedicated user's fixed Application Support path. It contains no
  credential, executable, provider token, writable path, access group, or entitlement value.

## Consequences

The credential is never exposed in a process list, plist, inherited environment, ordinary file, or
general helper output. A fixed native process becomes the only local bridge between code-signing
identity, Keychain policy, and the bundled Node, while launchd retains restart and final shutdown
bounds.

The cost is a small supervisor, a versioned private pipe protocol, a dual-mode signed main
executable, an embedded provisioning profile, and additional native lifecycle tests. launchd owns
the Host PID rather than the Node PID. No Developer ID identity, entitlement success, notarization,
real Keychain behavior, or macOS support is claimed until those artifacts are observed.
