# Research: Desktop-guided macOS Worker Host onboarding

- Status: Implemented locally; hosted packaging and controlled-device evidence pending
- Date: 2026-09-05
- Owner: @yxflc11
- Related issue: phase 3 in `docs/ROADMAP.md`; stacked after pull request #10
- Acceptance journey: After choosing a composition with a local Worker and signing in through
  OpenBot Desktop, an Owner names this computer once and explicitly starts setup. The Desktop main
  process obtains a short-lived enrollment token without returning it to the renderer, sends one
  bounded request over private child stdin to the Worker companion shipped inside the same Desktop
  bundle, and reports whether the macOS LaunchAgent is enabled or still requires System Settings
  approval. Restarting Desktop reads actual companion state instead of a persisted success flag.
- Security boundary: The Server remains the only authority that issues and redeems Node identity.
  The renderer supplies only a bounded Node id and receives only allowlisted status/error codes.
  The token never enters renderer state, argv, environment, a file, or logs. The native companion
  alone exchanges it, keeps the resulting identity in the device-only data-protection Keychain,
  writes the existing strict public configuration, and registers the fixed app-bundled
  LaunchAgent. Missing authentication, local-Worker intent, signed entitlement, companion bytes,
  Keychain access, registration approval, or bounded protocol output fails closed.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: Electron Packager `20.3.0` source, hooks, extra-resource behavior, tests, issues,
  and license; XState `5.31.1` release/source/tests/issues; current OpenBot macOS Worker Host source,
  tests, and distribution scripts.
- Standards and primary documentation queries: Apple
  [`SMAppService`](https://developer.apple.com/documentation/servicemanagement/smappservice),
  [`agent(plistName:)`](https://developer.apple.com/documentation/servicemanagement/smappservice/agent%28plistname%3A%29),
  [app-bundled helper migration](https://developer.apple.com/documentation/servicemanagement/updating-helper-executables-from-earlier-versions-of-macos),
  and [package-installer sample](https://developer.apple.com/documentation/servicemanagement/updating-your-app-package-installer-to-use-the-new-service-management-api);
  Electron [process model](https://www.electronjs.org/docs/latest/tutorial/process-model) and
  [`utilityProcess`](https://www.electronjs.org/docs/latest/api/utility-process); Electron Packager
  [`extraResource` and hooks](https://electron.github.io/packager/main/interfaces/Options.html).
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0023, ADR-0038 through
  ADR-0043; the Server-connection, setup-intent, Node enrollment, macOS launchd, Keychain,
  registration/package research; `docs/NODE_ENROLLMENT.md`; `docs/TECHNOLOGY.md`; and every
  matching Desktop/macOS Worker row in both reuse ledgers.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Ship the existing Swift Worker Host app as a nested Desktop companion and control it through one bounded stdin/stdout protocol | OpenBot commit `8252ea4`; Apple macOS 13+ `SMAppService`; Electron Packager `20.3.0`; Node `22.22.2` | OpenBot MIT; Apple platform/API terms; MIT; Node.js license | The native core already has strict config, Keychain, enrollment, registration, child-supervision, bundle-manifest, staging, signing, and Swift tests. Apple documents helper executables and LaunchAgent property lists inside an app bundle. Packager has tested extra-resource and completion hooks. | Preserves the signed `com.openbot.worker-host` bundle, access group, fixed LaunchAgent, and existing Node runtime while letting one top-level Desktop installation guide setup. A separate nested signature keeps Worker authority out of Electron. | Select. Add a strict noninteractive control mode, a main-process adapter, and package inventory gates. |
| Run the Worker as an Electron `utilityProcess` | Electron `44.2.0` | MIT | Current Electron API with process-lifecycle tests and documented MessagePort integration | Useful for work that lives only while Desktop runs. It cannot provide the existing login/reboot LaunchAgent lifecycle, separate Keychain entitlement, or independent crash recovery. It would also make the broad Electron runtime the service supervisor. | Reject for the durable Worker. Retain utility processes for future bounded foreground work only. |
| Let the renderer request the token and invoke setup | Existing React renderer and `/api/v1/nodes/enrollment-tokens` | OpenBot MIT | Existing Web management flow is tested | It would place a bearer enrollment value in renderer memory and require a broader bridge carrying secrets. It also lets UI state drift from native service state. | Reject. The main process uses its dedicated authenticated Session and returns only status. |
| Keep the separately installed Worker Host controller as the primary Desktop path | Current macOS Worker Host package candidate | OpenBot MIT plus Apple/Node terms | Source-complete candidate with local arm64 evidence | It remains a valid advanced/manual deployment path, but requiring a second visible installation does not satisfy the accepted single-Desktop onboarding journey. | Retain as recovery and modular self-hosting path; do not use as the primary guided path. |
| Add XState for the orchestration | XState `5.31.1` | MIT | Active actor/state-machine project with current v5 releases and extensive tests | The Server already makes token issuance replaceable and single-use; the native helper owns one ordered fail-closed transaction; Desktop persists no success claim. There is no concurrent or restart-resumable mutation in this slice. | Reject for this slice. Reconsider when Desktop coordinates cross-platform install, upgrade, rollback, and recovery transactions. |

## Reuse decision

- Selected option: existing released platform/runtime components, then a thin adapter around the
  already reviewed OpenBot Worker Host.
- Selected upstream or standard: Apple macOS 13+ `SMAppService` and Security contracts; Electron
  `44.2.0`; Electron Packager `20.3.0`; Node.js `22.22.2`; existing OpenBot typed Server proxy and
  native Worker Host.
- Why this is the first viable option: the current Swift companion already closes the platform
  gaps that TypeScript and Electron cannot safely close—device-only Keychain access, signed access
  groups, app-bundled LaunchAgent registration, and a fixed background process tree. Bundling that
  reviewed component preserves one user installation without duplicating identity or service code.
- Exact OpenBot-specific gap: add a strict Desktop-to-companion control envelope; request one token
  through the authenticated main-process Server session; convert the confirmed HTTP(S) Server
  origin to the exact WS(S) Node endpoint; stage and validate the companion as one allowlisted
  Desktop resource; project native status without persisting a success boolean; and guide macOS
  approval from the shared UI.
- Upgrade, replacement, or exit plan: the companion keeps its independent bundle id, schema,
  manifest, runtime, and signature so it can remain a manual recovery tool or move back to a
  separately installed package. Windows and Linux adapters implement the same Desktop status/setup
  contract behind their native service boundaries. A later effectful installer state machine may
  replace the narrow controller without changing Server enrollment or renderer types.
- Failure behavior when the upstream is missing, incompatible, or compromised: the Desktop reports
  `unavailable` or `invalid`, issues no token when prerequisites fail, never runs a discovered or
  user-selected executable, never falls back to renderer credentials or an Electron background
  process, and never persists `enabled` independently of native evidence.

## Source incorporation

- Source copied or substantially adapted: no upstream source. Existing OpenBot Swift and Node code
  is refactored and extended in place.
- Files and upstream locations: public Apple Service Management/Security APIs, public Electron
  `Session.fetch`/process paths, and Electron Packager hooks are called directly. No Apple sample,
  Electron example, or XState source/test/template is copied.
- Required copyright or license notice location: existing Electron, Packager, Node, React, and
  runtime dependency notices remain in `THIRD_PARTY_NOTICES.md` and the companion bundle. No new
  distributed dependency or notice is introduced.

## Protocol and lifecycle contract

- The fixed companion executable accepts one `--desktop-control` argument and exactly one
  newline-terminated JSON request on stdin. Inputs and outputs are versioned, exact-key, size
  bounded, and contain one action. Stderr and internal errors are never reflected to the renderer.
- `status` reads the existing configuration, Keychain envelope, and `SMAppService` status. It
  returns only `not-configured`, `disabled`, `requires-approval`, `enabled`, or `invalid`.
- `enroll` receives `nodeId`, the derived exact Node WebSocket URL, and one enrollment token. It
  performs the existing order: bounded exchange, Server-bound Keychain write and reread, public
  config write and reread, then fixed LaunchAgent registration. The token buffer is discarded after
  the request and never written.
- `enable` registers an already valid local identity without rotating it. `open-settings` calls the
  first-party Login Items settings API. Disable and credential deletion remain explicit management
  actions and are not silently added to first-run onboarding.
- Desktop may issue a token only while the canonical setup plan selects a local Worker, one Server
  origin is configured, and the dedicated Desktop Session is authenticated. It uses the existing
  same-origin proxy policy, timeout, redirect refusal, mutation Origin, cookie isolation, and
  response bounds.
- The packaged executable path is derived only from `process.resourcesPath` and the fixed nested
  bundle inventory. No IPC input, environment variable, PATH lookup, shell, URL, or config file can
  select it.
- The unsigned development package may prove layout and command behavior but must report that
  enrollment needs a distribution-authorized Keychain entitlement. Only a signed/notarized build
  plus controlled-device evidence may be called installable or supported.

## Verification plan

- Automated tests: strict native request/output schemas and byte limits; status projection;
  enrollment ordering; token clearing; enable and approval actions; exact Server-origin-to-Node URL
  conversion; authenticated token issuance; plan/connection gating; fixed helper path/argv/env;
  stdin/output/timeout bounds; renderer bridge shape; first-run screen; restart state; and exact
  nested package inventory.
- Negative and fail-closed tests: unauthenticated Session, no local-Worker intent, malformed Node
  id, redirect/large/invalid token response, missing/linked/tampered companion, extra JSON fields,
  output overflow, timeout, nonzero exit, missing/extra entitlement, Keychain denial, config drift,
  registration failure, and approval not granted.
- Platforms and devices: pure TypeScript and Swift tests locally and on hosted macOS arm64; Desktop
  package/test/build remains green on hosted Linux x64 and Windows x64 without inventing their
  service adapter. A signed controlled macOS 13+ standard-user fixture must still prove actual
  Keychain, registration, approval, login/reboot, disable, upgrade, rollback, and uninstall.
- User-visible documentation and translations: update technology, roadmap, execution checkpoint,
  Node enrollment, and both reuse/research indexes in English and Simplified Chinese where paired.
- Support level that the current evidence permits: experimental, locally source-complete
  Desktop-guided macOS onboarding. Hosted nested-package evidence is still required. No signed
  distribution or macOS/Windows/Linux support claim is permitted until the corresponding
  real-device gates pass.

## Evidence observed locally

- Desktop and shared Web suites pass with 120 and 54 tests, including authentication, preflight,
  private token delivery, fixed path/argv/environment, concurrency, output bounds, restart state,
  and the approval journey.
- The unsigned macOS arm64 Desktop package completes its fuse and inventory gates both without a
  companion and with the fixed locally built companion nested under `Contents/Resources`. The
  integrated package launches successfully after the browser V8-snapshot fuse regression fix.
  This is local layout and launch evidence only, not distribution evidence.
- The extended Swift product compiles and links against the compatible macOS SDK available on this
  development machine. The installed beta Command Line Tools cannot load a matching
  `TestingMacros` plugin for the native tests, so hosted native test execution remains required.
- The security workflow validator requires the macOS companion candidate to be built before the
  Desktop package and passed only through the fixed packaging environment variable. The hosted
  workflow itself has not yet been observed for this change.

## Unresolved questions

- The Owner must still supply the Developer ID identities, provisioning profile, access group, and
  notary profile already listed by the macOS Worker package decision before real onboarding can
  succeed outside an authorized development fixture.
- Windows and Linux need separate Desktop companion/package adapters that preserve their accepted
  SCM/MSI and systemd/recoverable-bootstrap boundaries; macOS success cannot be generalized.
- Server bootstrap and PostgreSQL lifecycle remain separate from Worker enrollment even when one
  Desktop plan requests both.
