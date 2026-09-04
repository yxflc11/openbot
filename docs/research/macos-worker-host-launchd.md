# Research: macOS Worker Host launchd boundary

- Status: Static LaunchAgent contract implemented locally; launcher, registration, signing, packaging,
  Keychain, and real-device evidence pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G5 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: An administrator installs the signed OpenBot Worker Host app for a dedicated
  standard macOS account. After enrollment, that user explicitly enables its background item. The
  registered LaunchAgent starts only the fixed bundled Node, launchd restarts unexpected failures,
  and logout, disable, or uninstall gives the Node a bounded graceful stop.
- Security boundary: The registration app and LaunchAgent are lifecycle adapters, not authorities.
  They cannot mint Node identity, accept an arbitrary executable, grant capabilities, bypass Server
  approval, or inherit an administrator or Owner desktop. Credentials never appear in the launchd
  property list, package arguments, process arguments, or logs. Missing configuration, enrollment,
  Keychain access, signature, registration approval, or shutdown certainty fails closed. Desktop
  observation and input remain disabled and require a separately reviewed Provider identity and TCC
  grant.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `macOS launchd Node service maintained`, `node-mac launchd releases`, `Swift
  LaunchAgent package`, `Homebrew services launchctl`, `SMAppService launch agent`, and `Swift
  service lifecycle SIGTERM`.
- Standards and primary documentation queries: Apple Service Management and `SMAppService`,
  `launchd.plist(5)`, `launchctl(1)`, LaunchAgent versus LaunchDaemon contexts, background-item
  visibility, `BundleProgram`, graceful shutdown and `ExitTimeOut`, Developer ID signing, hardened
  runtime, notarization, and macOS Keychain user-context and entitlement behavior.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `docs/EXECUTION_PLAN.md`,
  `docs/CROSS_PLATFORM.md`, `docs/SECURITY.md`, `docs/NODE_ENROLLMENT.md`, ADR-0023 and ADR-0032
  through ADR-0037, all current Node shutdown, credential-store, service, archive, and installer
  code, and every Worker Host row in `docs/OPEN_SOURCE_REUSE.md`. No macOS service implementation or
  completed reuse entry existed.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Apple `SMAppService` LaunchAgent and launchd | macOS 13+ Service Management API and the current macOS 27 `launchd.plist(5)` / `launchctl(1)` contracts | Apple platform/API terms | Supported operating-system API. Local manual pages document `BundleProgram`, conditional `KeepAlive`, `ExitTimeOut`, process-group cleanup, and domain-scoped lifecycle. Apple documents user approval and System Settings visibility. | A LaunchAgent runs in the dedicated logged-in user's context, which is required for the data-protection Keychain and later user-session Providers. `BundleProgram` keeps the executable app-relative. `SMAppService.status` avoids parsing diagnostic-only `launchctl print` output. | Select as the platform lifecycle and registration standard. Set the product floor to macOS 13 for this slice. |
| Direct legacy plist installation and `launchctl` mutation | Current `launchd.plist(5)` and `launchctl(1)` contracts | Apple platform/API terms | Stable platform mechanics, but Apple directs macOS 13+ apps to Service Management for app-bundled agents. | Writing `~/Library/LaunchAgents` or `/Library/LaunchAgents` from an installer needs scripts or a privileged helper, bypasses the current background-item registration path, and makes target-user selection ambiguous. | Reject for new installs. Retain `bootstrap`/`bootout` only as native test operations against disposable fixtures. |
| `node-mac` | npm `1.0.1`, repository [`2bf9e64f`](https://github.com/coreybutler/node-mac/tree/2bf9e64f637f3ab1f036bf69c1205d0f6c227e7b) | Declared MIT, but the reviewed repository license contains an unresolved merge marker and GitHub reports `NOASSERTION` | The reviewed core commit is dated 2020-07-09, the package declares Mocha but contains no test files, and open issues include unresolved path and executable-selection behavior. | Defaults to a root LaunchDaemon, accepts broad caller paths and environment, invokes shell commands, and inserts a second JavaScript restarter between launchd and the Node. That duplicates restart policy and complicates complete shutdown. | Reject. Do not ship, copy, or adapt it. |
| `emorydunn/LaunchAgent` | [`0.3.0` / `9f6d33ab`](https://github.com/emorydunn/LaunchAgent/tree/9f6d33abfa4a0a45a877e9b884391981c1f4152b) | MIT | Includes property-list and native lifecycle tests, but the release commit is dated 2022-04-06. Open issues include missing conditional `KeepAlive` support and global-agent permission confusion. | Its broad encoder is unnecessary for one fixed plist. Control methods use detached `Process.launchedProcess`, retain deprecated `load`/`unload`, and do not return authoritative command outcomes. It does not provide app-bundle registration or OpenBot policy. | Reject as a shipped dependency. Generate and validate one fixed plist locally. |
| Homebrew Services | [`Homebrew/brew 6.0.21` / `56014701`](https://github.com/Homebrew/brew/tree/560147012b9678b42ef5e83b690f0895552d1366) | BSD-2-Clause | Current release with extensive service tests. The earlier `homebrew-services` tap is archived and its implementation moved into `brew`. | Correctly distinguishes user and root domains, but adopting it would require a mutable package manager, Ruby runtime, formula state, trust store, and root/user conventions that OpenBot cannot make an install prerequisite. It is useful operational prior art, not a product lifecycle boundary. | Reject as a runtime or installer dependency. |
| Swift Service Lifecycle | [`2.11.0` / `9829955b`](https://github.com/swift-server/swift-service-lifecycle/tree/9829955b385e5bb88128b73f1b8389e9b9c3191a) | Apache-2.0 | Active Swift Server Work Group project with signal and graceful-shutdown tests; the reviewed package adds `swift-log` and `swift-async-algorithms`. | Useful when a Swift process owns several long-running services. The macOS slice can instead let launchd signal the existing Node directly after a launcher `exec`, so the package adds code without closing a boundary gap. | Reject for the first host. Reconsider only if a future native broker owns multiple services. |
| System LaunchDaemon | Current launchd system-domain contract | Apple platform/API terms | Stable and testable only with administrator privileges and a dedicated service account. | Appropriate for user-independent headless work, but it has no WindowServer session and Apple documents that the data-protection Keychain is available only in user context. It cannot satisfy the dedicated-user, locked-Keychain, or future desktop Provider journey. | Reject as the default macOS Node profile. A future separately scoped fleet daemon must not inherit desktop or user-Keychain claims. |

## Reuse decision

- Selected option: open platform standard plus a narrow OpenBot launcher and registration adapter.
- Selected upstream or standard: macOS 13+ `SMAppService`, LaunchAgent, `BundleProgram`, and launchd
  lifecycle semantics.
- Why this is the first viable option: launchd already supplies process start, crash restart,
  throttling, logout stop, process-group cleanup, and a bounded SIGTERM-to-SIGKILL transition.
  `SMAppService` registers the app-bundled job subject to user approval and exposes a stable status
  enum. No third-party supervisor or package manager is needed.
- Exact OpenBot-specific gap: build a minimal app that registers one fixed plist; add a signed
  app-relative launcher that derives only the dedicated user's fixed Application Support paths,
  constructs an allowlisted environment, and replaces itself with the hash-manifested Node runtime;
  validate the plist, app layout, configuration boundary, and lifecycle without parsing diagnostic
  prose.
- Upgrade, replacement, or exit plan: keep the plist schema and launcher contract local and small.
  Package versions replace the whole signed app, preserve only the separately validated per-user
  configuration and Keychain item, and reregister after a compatible upgrade. If Apple replaces
  Service Management, keep the immutable Node/config contract and swap only the registration
  adapter.
- Failure behavior when the upstream is missing, incompatible, or compromised: registration or
  startup fails before a Node connection or Provider starts. Never fall back to a legacy plist,
  arbitrary Node from `PATH`, plaintext credential, root daemon, or unverified app contents.

## Durable launch contract

- Install a signed app at the fixed `/Applications/OpenBot Worker Host.app` path. The package must
  place files only; it must not enroll, write credentials, select a user, or start the agent from a
  root installer script.
- The dedicated standard user completes enrollment and explicitly registers the background item.
  Registration is refused until the public configuration and Keychain identity pass their own
  validation. Disabled or approval-required state remains visible and fails closed.
- Store the single plist at
  `Contents/Library/LaunchAgents/com.openbot.worker-host.node.plist`. It uses one app-relative
  `BundleProgram`, no shell-selected command, no credential-bearing argument or environment value,
  and no mutable `PATH` lookup.
- The launcher performs only path/config preflight and then `exec`s the fixed bundled Node, so
  launchd directly owns the long-running PID. It does not restart, daemonize, fork into the
  background, open a control port, or accept caller-selected commands.
- Use conditional `KeepAlive` with `SuccessfulExit=false`: an unexpected non-zero exit is retried,
  while a graceful zero exit is not turned into a restart loop. Set `ThrottleInterval=30`,
  `ProcessType=Background`, `ExitTimeOut=25`, and a private `Umask=077`. Do not set
  `EnablePressuredExit`, `AbandonProcessGroup`, `Debug`, `RootDirectory`, `UserName`, `GroupName`,
  `StandardInPath`, or resource-limit guesses without separate evidence.
- Node already handles `SIGTERM` by aborting Runs, closing Providers and the Server socket, and
  waiting for those tasks. launchd supplies the final bound and kills remaining same-process-group
  children when required. Native tests must prove graceful exit and forced cleanup.
- The Node and browser-only Provider start with no Accessibility, Screen Recording, Automation,
  Input Monitoring, Full Disk Access, or administrator grant. A later desktop Provider must have a
  separately signed executable identity, narrow local protocol, Server-issued capability lease,
  and real TCC tests.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: the implementation will use public Apple framework and launchd
  contracts. The candidate repositories were inspected only; none of their source, tests, plist
  templates, or wrapper logic is copied or adapted.
- Required copyright or license notice location: no third-party runtime is selected for this slice.
  The packaged official Node runtime retains its Node.js notices under the later macOS archive and
  package review.

## Implementation verification

- The first checked-in plist contains only the exact label, app-relative `BundleProgram`,
  conditional unsuccessful-exit restart, 30-second throttle, background process class, 25-second
  stop bound, and `077` umask. It has no command arguments, environment, credential, stdin, user,
  group, root-directory, pressured-exit, or abandoned-process-group key.
- Four portable contract tests accept only the canonical regular file and reject lifecycle,
  executable, environment, symlink, size, and diagnostic drift. The local macOS 27 `plutil` parser
  also accepts the plist.
- The required portable macOS hosted lane now runs both the contract suite and native `plutil`. It
  uploads nothing and remains unobserved until this branch is pushed with separate authorization.
- This evidence validates a static service definition only. The referenced launcher does not yet
  exist, and no service was registered or started on the development Mac.

## Verification plan

- Automated tests: exact plist dictionary and forbidden keys, fixed bundle-relative executable,
  private umask, conditional restart, bounded exit timeout, registration state mapping, fixed config
  and runtime paths, allowlisted environment, no credentials in plist/argv, and app inventory.
- Negative and fail-closed tests: moved or unsigned payload, symlink/non-regular runtime or config,
  missing enrollment, registration approval required/disabled/not found, malformed config, locked or
  denied Keychain, child preflight failure, rapid failure throttle, hung graceful shutdown, and
  remaining child-process cleanup.
- Platforms and devices: pure plist/layout tests may run in hosted macOS arm64. Native lifecycle
  requires a dedicated macOS 13+ standard user and tests login, logout, disable, enable, restart,
  crash, sleep/wake, reboot, FileVault cold boot, and process-tree cleanup. Intel remains unclaimed
  until a matching package and real device run are observed.
- User-visible documentation and translations: explain the dedicated-user login requirement,
  background-item approval, FileVault cold-start tradeoff, configuration/Keychain separation,
  disable/uninstall journey, and the absence of desktop control in English and Simplified Chinese.
- Support level that the evidence permits: accepted design only. A local unsigned app or disposable
  LaunchAgent test is development evidence, not a signed package, notarization, Keychain support,
  desktop control, or production macOS support.

## Unresolved questions

- The macOS archive, universal versus split-architecture app, component package, upgrade/rollback,
  uninstall, Developer ID Application/Installer signing, notarization, stapling, and detached
  provenance need a separate packaging review before distributable artifacts are added.
- Keychain item class, data-protection selection, access group, provisioning profile, accessibility,
  migration, and non-exportable proof-of-possession key rules need a separate credential review.
- `SMAppService.register()` can require user approval. Native acceptance must test every documented
  status and cannot automate or bypass that consent.
