# ADR-0038: The macOS Worker Host is a user-approved LaunchAgent

- Status: Accepted; immediate-`exec` process model superseded by ADR-0039
- Date: 2026-09-04

## Context

OpenBot needs a macOS Worker Host that survives app restarts, stops cleanly, can later use macOS
Keychain, and does not imply desktop-control support. The documented deployment uses a dedicated
standard user because a system daemon cannot access that user's WindowServer or data-protection
Keychain context. The Server remains the only authority for identity, routing, approval, and audit.

The full evidence and candidate comparison are recorded in
[macOS Worker Host launchd research](../research/macos-worker-host-launchd.md).

## Upstream review

Apple's macOS 13+ `SMAppService`, LaunchAgent, `BundleProgram`, Keychain, code-signing, and launchd
contracts were reviewed. Exact candidates included `node-mac` `1.0.1` / `2bf9e64f`,
`emorydunn/LaunchAgent` `0.3.0` / `9f6d33ab`, Homebrew `6.0.21` / `56014701`, and Swift Service
Lifecycle `2.11.0` / `9829955b`. Their maintenance, tests, licenses, open issues, process models,
privilege boundaries, and platform fit are recorded in the research file.

## Reuse decision

Use the operating-system service standard directly. `SMAppService` registers one app-bundled
LaunchAgent subject to user approval, while launchd supplies process restart, throttling, logout
cleanup, SIGTERM, and a final SIGKILL bound. Implement only the missing OpenBot registration,
immutable bundle path, configuration preflight, and fixed Node adapter. ADR-0039 supersedes the
initial immediate-`exec` process model after the Keychain handoff review.

Third-party service wrappers are rejected because they add mutable command, environment, package
manager, restart, or process-observation surfaces without closing an OpenBot boundary gap. A system
LaunchDaemon is rejected for the default profile because it cannot satisfy the user-Keychain and
future user-session Provider journey.

## Source incorporation

No candidate source, tests, templates, or wrapper logic is copied or substantially adapted. The
implementation uses public Apple platform contracts. The separately packaged official Node runtime
will retain its notices under the later packaging review.

## Verification plan

Pure tests validate the exact plist and app inventory, every forbidden key, fixed bundle-relative
paths, conditional restart, private umask, bounded stop, registration-state mapping, configuration
preflight, environment allowlist, and absence of credentials in plist and argv. Native macOS 13+
tests must cover a dedicated standard user, background-item approval/denial, login/logout,
crash/restart, disable/enable, sleep/wake, reboot, FileVault cold boot, and graceful/forced
process-tree shutdown. Separate gates cover Keychain, package signing, notarization, upgrade,
rollback, uninstall, and TCC.

## Decision

- The default macOS Node runs as a LaunchAgent in a dedicated logged-in standard account.
- A fixed app in `/Applications` registers the agent through `SMAppService`; installers do not
  select a user, enroll, store credentials, or start the service from a privileged script.
- The plist uses `BundleProgram`, `KeepAlive.SuccessfulExit=false`, `ThrottleInterval=30`,
  `ProcessType=Background`, `ExitTimeOut=25`, and `Umask=077`. It passes one fixed
  `--worker-host` mode argument to the app's main executable.
- A narrow native Host validates fixed per-user configuration and signed bundle paths, then starts
  only the fixed packaged Node. ADR-0039 keeps the Host alive as the Keychain gate and bounded child
  supervisor; it accepts no arbitrary command and adds no restart loop or public control endpoint.
- Credentials remain outside plist, package, arguments, environment, and logs. Keychain failure
  never falls back to a file.
- The Node and first browser-only profile receive no desktop privacy permission. A later Provider
  needs its own signed identity, Server lease, local protocol, and native TCC evidence.

## Consequences

The background item is visible and controllable by the user, the service runs in the only context
compatible with the planned user Keychain, and launchd owns the actual long-running Node PID. This
removes a third-party supervisor and avoids giving a headless root daemon desktop authority.

The cost is a macOS 13 floor, a login requirement, explicit user approval, an app-bundle registration
shell, and separate distribution credentials. FileVault means cold boot cannot become unattended
until the dedicated user logs in. The native source and arm64 candidate now exist, but this is not
yet a Developer-ID signing, notarization, validated Keychain, real-device, or desktop-control claim.
