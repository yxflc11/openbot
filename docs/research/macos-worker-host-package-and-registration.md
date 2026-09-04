# Research: macOS Worker Host registration and distribution package

- Status: Implemented locally; Developer ID, notarization, and controlled-device evidence pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G5 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: A dedicated standard user opens one fixed app in `/Applications`, exchanges a
  one-time enrollment token, verifies a device-only Keychain record bound to the configured Server,
  and explicitly enables the bundled LaunchAgent. A reviewed package can be installed, upgraded,
  rolled back with an explicitly rebuilt prior payload, disabled, and removed without an installer
  script selecting a user or handling a credential.
- Security boundary: The app may exchange one bounded token, store or remove one exact Keychain
  record, write one fixed public config, and register or unregister one fixed LaunchAgent. It cannot
  mint identity, select an executable or service label, bypass background-item approval, grant a
  capability, or publish a package. Package, code-signing, notarization, registration, Keychain, or
  cleanup uncertainty fails closed. The Server remains the identity and authorization authority.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `macOS pkgbuild packaging`, `munkipkg`, `macOS installer package builder`, and the
  release, source, tests, license, and open issues for `codecarton/swiftpkg`, `munki/munki-pkg`, and
  `tactcomplabs/mackage`.
- Standards and primary documentation queries: Apple `SMAppService.agent(plistName:)`, registration
  status and user approval; data-protection Keychain access groups and
  `WhenUnlockedThisDeviceOnly`; Developer ID Application versus Installer identities; hardened
  runtime, nested-code signing, `productbuild`, `pkgutil`, `notarytool`, stapling, and Gatekeeper.
- Follow-up primary sources: Apple [TN3137](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains)
  and [TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles)
  require restricted Keychain entitlements to be authorized by a provisioning profile embedded in
  an app-like bundle. Apple's
  [Keychain sharing guidance](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps)
  defines the application identifier and access-group relationship. Apple's
  [QA1940](https://developer.apple.com/library/archive/qa/qa1940/_index.html) documents the
  resource-fork/Finder-info signing hazard and `xattr` inspection/removal workflow.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0038 and ADR-0039,
  `docs/EXECUTION_PLAN.md`, `docs/CROSS_PLATFORM.md`, `docs/NODE_ENROLLMENT.md`, the existing macOS
  plist/config/private-pipe code, Linux release transaction, Windows installer decision, and both
  macOS entries in `docs/OPEN_SOURCE_REUSE.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Apple Service Management, Security, code-signing, Installer, and notary tools | macOS 13+ public APIs and the macOS 27 SDK/toolchain observed 2026-09-04; `notarytool 1.1.3 (42)` | Apple platform/API and developer-program terms | First-party platform contract. Apple documents background-item approval, exact Keychain access groups, Developer ID identity classes, hardened runtime, package signature inspection, notarization, and stapling. | Expresses every required side effect without a runtime package manager. `productbuild --component` creates an app-only package; direct Security calls keep credentials out of scripts and package metadata. | Select. Use a dependency-free SwiftPM package and narrow local staging/signing/package scripts. |
| SwiftPkg | [`0.4.1` / `ad0007e7`](https://github.com/codecarton/swiftpkg/tree/ad0007e7263360950c17cca6d0c4b0d3084a9b13) | Apache-2.0 | Immutable release published 2026-09-03 with a current Swift test suite and signed/notarized release automation. It depends on `swift-argument-parser` and Yams and has an active early-stage issue backlog. | A maintained general package-project format, CLI, YAML parser, environment loader, keychain lookup, release publisher, and notarization service are much broader than one fixed app component. | Reject as a dependency. Inspect as operational prior art only; copy no source or template. |
| MunkiPkg | [`7d57d075`](https://github.com/munki/munki-pkg/tree/7d57d0750bd6787838322b7abf02693da033d584) | BSD-style project license; GitHub reports `NOASSERTION` | Archived on 2026-09-01; its final change explicitly retires the Python implementation in favor of SwiftPkg. | Requires a separately maintained Python and a general project/script surface. An archived tool is not a viable new release boundary. | Reject. |
| Mackage | [`1.0.0` / `766db3a8`](https://github.com/tactcomplabs/mackage/tree/766db3a83276d0cc5cd2260471b334295960171a) | Apache-2.0 | Small 2026 Python wrapper with no repository test suite and one open packaging PR. It wraps `pkgbuild`/`productbuild` and optionally executes package scripts. | Its arbitrary JSON, payload, ownership, scripts, Homebrew, and Python surfaces add no protection around OpenBot's single fixed component. | Reject. Call the same Apple tools through bounded arguments instead. |
| Xcode project and automatic archive export | Current Xcode 27 | Apple tool terms | First-party and distribution-capable. | Viable, but the repository is package-first and needs two executables plus pure tests. An otherwise empty generated project would duplicate target, version, file, entitlement, and signing state. | Reject for this slice. Reconsider if the controller gains substantial AppKit resources or provisioning automation. |

## Reuse decision

- Selected option: open platform standards followed by a narrow OpenBot-specific adapter.
- Selected upstream or standard: SwiftPM, `SMAppService`, Apple Security, code-signing entitlements,
  `codesign`, `productbuild`, `pkgutil`, `notarytool`, `stapler`, and `spctl`.
- Why this is the first viable option: the operating system already owns registration, user
  approval, access-group enforcement, component installation, trust evaluation, and notarization.
  OpenBot needs only fixed schemas, paths, status mapping, staging order, and failure gates.
- Exact OpenBot-specific gap: build a no-dependency Swift core, native Host, and controller UI;
  bind the stored Node identity to the exact configured WebSocket URL; stage an allowlisted app
  inventory and manifest; sign nested code inside-out with explicit identities and entitlements;
  build an app-only package; and validate every artifact before it can be called distributable.
- Upgrade, replacement, or exit plan: Swift source remains independent of a project generator or
  package wrapper. A later Xcode project may consume the same core. Each Apple tool or entitlement
  change repeats the signing and real-device matrix. Package versions replace the whole app while
  preserving only the user-owned config and Keychain record.
- Failure behavior when the upstream is missing, incompatible, or compromised: no registration,
  child `START`, package, notarization, or support claim. Never fall back to a legacy LaunchAgent,
  classic Keychain, plaintext secret, ad hoc distribution signature, or arbitrary installer script.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: implementation calls public Apple and POSIX APIs and existing
  OpenBot Node/protocol code. Candidate source, tests, package templates, and scripts are not copied
  or adapted.
- Required copyright or license notice location: no new third-party runtime is selected. The app
  carries the OpenBot license, official Node license, and ncc-generated third-party notices.

## Distribution and lifecycle contract

- One app main executable has two exact modes: no arguments opens the controller and the fixed
  `--worker-host` argument runs the background Host. The LaunchAgent selects that mode through its
  fixed `BundleProgram` and `ProgramArguments`. This lets both paths use the same app-like bundle,
  explicit application identifier, Team identifier, provisioning profile, and signed Keychain
  access group. Runtime code derives the complete Team-ID-prefixed group from its signed entitlement
  and rejects zero, duplicate, malformed, or additional matching groups.
- The Keychain value is a strict `openbot.macos-keychain-node/v1` envelope containing the exact
  public Server WebSocket URL and the strict `openbot.node-identity/v1` response. This prevents a
  modified public config from redirecting a valid bearer credential to a different Server.
- Enrollment converts only the configured `ws`/`wss` origin to `http`/`https`, replaces the path
  with `/api/v1/nodes/enroll`, sends one bounded JSON request, accepts one bounded response, stores
  and rereads the exact Keychain envelope, atomically writes the public `0600` config, and only then
  asks `SMAppService` to register the fixed plist. No token is persisted.
- The app maps `notRegistered`, `enabled`, `requiresApproval`, and `notFound` without parsing
  diagnostic prose. Disable unregisters first. Credential/config removal is a separate explicit
  action so an accidental disable does not destroy recovery state.
- A component package installs only `/Applications/OpenBot Worker Host.app`; it has no preinstall or
  postinstall script and cannot enroll, choose a user, write a home directory, or start a service.
  Upgrade requires the user to disable the background item before package replacement and then
  re-enable it. Rollback uses a separately reviewed prior payload rebuilt with a monotonically newer
  package build number; silently installing an older unreviewed package is forbidden.
- Uninstall is two phase: the dedicated user unregisters and may remove the exact Keychain/config
  data in the app, then an administrator moves the fixed app to Trash and forgets its receipt.
  OpenBot does not ship a root deletion helper for one fixed bundle.
- Distribution signing uses Developer ID Application for every Mach-O and app, Developer ID
  Installer for the flat package, hardened runtime plus timestamp, inside-out nested signing, strict
  verification, notarization, stapling, and Gatekeeper/package verification. The Node runtime runs
  with the fixed `--jitless` argument so it does not need JIT or unsigned-executable-memory
  entitlements. Signing the nested Node changes its Mach-O bytes, so the packager recomputes the
  runtime manifest after nested signing and before the outer app signature seals that manifest.
  The package gate also rejects AppleDouble payload files and any installer `Scripts` entry.

## Verification plan

- Automated tests: strict config/identity envelope, Server URL binding, access-group selection,
  exact Keychain query/add/update/delete dictionaries, bounded enrollment exchange, atomic config
  plan, registration-state mapping, fixed child arguments/environment/process group, graceful then
  forced shutdown, exact app/package inventory, manifest hashes, nested signing order, and tool
  argument bounds, Developer ID/Team binding, provisioning authorization, post-signature manifest
  refresh, unexpected extended attributes, AppleDouble payloads, and installer scripts.
- Negative and fail-closed tests: root/wrong user, malformed or extra config/envelope fields,
  different Server/Node, locked/denied/classic/synchronizing Keychain, missing/duplicate entitlement,
  redirected enrollment, large or invalid response, partial write, approval required, moved or
  modified bundle, unexpected Mach-O, missing identity, ad hoc distribution, absent timestamp,
  unsigned package, failed notarization/staple, active-service upgrade, and incomplete cleanup.
- Platforms and devices: Swift build/pure tests and ad hoc layout checks on hosted/local macOS arm64.
  A controlled macOS 13+ standard account must prove restricted access groups, lock/unlock,
  `SMAppService`, login/logout/reboot, install/upgrade/rollback/uninstall, process-tree cleanup,
  Developer ID, notarization, stapling, and Gatekeeper. Intel remains unclaimed until a matching
  build and real device pass.
- User-visible documentation and translations: update execution, cross-platform, enrollment,
  install/upgrade/uninstall, background approval, Keychain recovery, and evidence labels in English
  and Simplified Chinese together.
- Support level that the evidence permits: source-complete macOS candidate after local gates;
  production macOS support remains pending external Developer ID/notary inputs and controlled-device
  evidence.

## Local evidence

- The dependency-free Swift package builds on local arm64 macOS with the reviewed SDK workaround;
  eight native tests pass, including strict config, Server-bound Keychain envelopes, fixed queries,
  launch policy, private files, and runtime-manifest tamper rejection.
- The candidate builder produced a real arm64 app from a clean commit with official Node `22.22.2`,
  npm `10.9.8`, the exact ncc inventory, two arm64 Mach-O programs, valid property lists, and matching
  SHA-256 runtime records. The repository-wide `npm run check` also passes.
- Ad hoc nested and outer code signing validates locally, but is deliberately not distribution
  evidence. The machine has no Developer ID Application/Installer identity, matching profiles, or
  notary credentials, so a signed/notarized package and a working restricted Keychain claim cannot
  be produced or claimed here.

## Unresolved questions

- The repository owner must supply the exact Team ID, Developer ID Application identity, Developer
  ID Installer identity, provisioning profile authorizing the shared access group, and a notarytool
  Keychain profile. This development Mac currently reports zero valid signing identities.
- A dedicated standard-user real-device fixture and Intel builder are external infrastructure; the
  repository must not turn their absence into a passing support label.
- G6 will replace the bearer envelope with proof-of-possession material. The Keychain schema is
  versioned so that migration can be explicit rather than silently changing this boundary.
