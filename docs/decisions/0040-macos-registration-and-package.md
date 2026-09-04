# ADR-0040: macOS registration is user-scoped and distribution uses an app-only package

- Status: Accepted
- Date: 2026-09-04

## Context

The accepted macOS Host boundary still needs enrollment, Keychain insertion, LaunchAgent
registration, staging, signing, packaging, upgrade, rollback, and removal behavior. Those operations
cross different authorities: the dedicated user owns identity and background approval, an
administrator owns `/Applications`, Apple Developer credentials own distribution trust, and the
Server owns whether a Node credential is valid.

The evidence and candidate comparison are recorded in
[macOS registration and package research](../research/macos-worker-host-package-and-registration.md).

## Upstream review

Apple's Service Management, Security, Developer ID, hardened-runtime, Installer, notarization,
stapling, and Gatekeeper contracts were reviewed. Exact third-party candidates included SwiftPkg
`0.4.1` / `ad0007e7`, retired MunkiPkg `7d57d075`, and Mackage `1.0.0` / `766db3a8`; their source,
releases, tests, issues, dependencies, license, and authority fit are recorded in the research file.

## Reuse decision

Use the operating-system standards directly through a narrow dependency-free Swift adapter and
bounded staging scripts. General package-project frameworks add parsers, scripts, environment
loading, package-manager state, or publication behavior that is unnecessary for one fixed app.

## Source incorporation

No candidate source, tests, package templates, or scripts are copied or substantially adapted. The
implementation calls public Apple/POSIX APIs and reuses existing OpenBot Node and protocol code.

## Verification plan

Pure and native tests cover strict envelopes and config, exact access groups and Keychain queries,
bounded enrollment, registration states, fixed child containment, app inventory, hash manifests,
package scripts, signing order, and missing-input failures. Local macOS can prove Swift compilation
and ad hoc mechanics. Developer ID, notarization, Keychain access groups, background approval, and
install lifecycle require the controlled real-device gate described in the research file.

## Decision

- Build a dependency-free SwiftPM core, native Host, and controller UI. The controller exchanges one
  enrollment token, stores and verifies one strict Keychain envelope, writes one fixed public config,
  and explicitly registers one fixed `SMAppService` agent.
- Bind the Keychain identity to the exact configured Server URL as well as the Node id. A public
  config change therefore cannot redirect the bearer credential to another Server.
- Use one shared, Team-ID-prefixed Keychain access group derived from each executable's signed
  entitlement. Missing, malformed, or ambiguous groups fail closed.
- Stage one allowlisted app bundle with a hash manifest and separately signed controller, Host, and
  fixed `--jitless` Node runtime. No executable path, Provider, token, or credential is configurable.
- Build an app-only flat package with Apple `productbuild`. It contains no installer script and does
  not enroll, register, choose a user, or mutate a home directory.
- Disable before replacement and re-enable afterward. Rollback is an explicitly rebuilt and reviewed
  prior payload with a monotonically newer package build number. Uninstall unregisters and optionally
  deletes user state before an administrator moves the fixed app to Trash and forgets the receipt.
- Distribution scripts require explicit Developer ID Application/Installer identities, access group,
  provisioning profile, and notarytool profile. They sign inside-out, require hardened runtime and
  timestamps, verify nested code and package signatures, notarize, staple, and evaluate Gatekeeper.
  Missing external inputs do not fall back to ad hoc distribution.

## Consequences

The installer never handles a bearer token or guesses which user owns the service, while the user
can inspect and revoke the background item. Server binding closes a config-redirection credential
leak, and the package has a small auditable authority surface.

The cost is a visible two-phase install/uninstall journey, explicit disable/re-enable during
replacement, and external Developer ID, provisioning, notary, and real-device evidence. Local ad hoc
signing can prove bundle mechanics only and must remain labelled non-distributable.
