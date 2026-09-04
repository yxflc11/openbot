# Research: macOS Worker Host configuration and Keychain handoff

- Status: Native Host, registration UI, Security queries, and private handoff implemented locally;
  distribution-signed Keychain and real-device evidence pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G5 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: A dedicated standard macOS user registers an already-enrolled Worker Host.
  launchd starts one signed native Host, which validates one fixed public configuration and one
  device-only Keychain identity, starts only the bundled Node, passes the identity through a private
  inherited pipe, and stops the entire child process group within the launchd deadline.
- Security boundary: The Server remains the only identity, authorization, routing, approval, and
  audit authority. The native Host may retrieve exactly one already-enrolled Node identity and
  supervise exactly one fixed child; it cannot mint identity, accept a caller-selected executable,
  enroll, grant a capability, or expose a general credential endpoint. Configuration, Keychain,
  entitlement, bundle, child-control, or shutdown uncertainty fails before a Node or Provider side
  effect. Credentials never enter a file, plist, argument, environment value, or log.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `macOS Swift Keychain wrapper maintained releases tests`, `SwiftSecurity
  Keychain`, `KeychainSwift macOS data protection keychain`, `Node macOS keyring native addon`,
  `cosmiconfig fixed config load`, and `node-convict strict config`.
- Standards and primary documentation queries: Apple Security `SecItemCopyMatching`,
  `kSecUseDataProtectionKeychain`, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, Keychain access
  groups and restricted-entitlement signing; Apple Service Management app-bundled helpers; Node.js
  `fs.open`, `O_NOFOLLOW`, opened-handle `stat`, and file-descriptor behavior.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0023, ADR-0032 through
  ADR-0038, `docs/EXECUTION_PLAN.md`, `docs/SECURITY.md`, `docs/CROSS_PLATFORM.md`, the current Node
  environment, enrollment, credential-store, `stdio-v2`, Linux Secret Service, Windows supervisor,
  and macOS launchd code, plus every matching row in `docs/OPEN_SOURCE_REUSE.md`. Zod 4.5.4,
  official Node.js 22.22.2, `@napi-rs/keyring` 2.0.0, and archived `node-keytar` 7.9.0 were already
  fully reviewed; the missing macOS Keychain and private handoff entry was partial.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Apple Security framework and data-protection Keychain | macOS 13+ public Security API | Apple platform/API terms | Operating-system API. Apple documents access-group isolation, `SecItemCopyMatching`, the macOS data-protection selector, accessibility classes, and entitlement failures. | Directly expresses the required generic-password class, exact service/account/access group, non-synchronizing query, and locked-device behavior. A signed native Host can retrieve the item without creating a callable password-printing tool. | Select as the credential API. Query `kSecUseDataProtectionKeychain=true`, one explicit shared access group, exact service/account, and verify returned attributes and bounded value. |
| SwiftSecurity | [`2.0.0` / `c26f18ad`](https://github.com/dm-zharov/swift-security/tree/c26f18adbb20f9e4e810d3ba7553e095a74ea2c0) | MIT | Released package with unit and app-host tests, no runtime dependencies, Swift 5.9, macOS 11+. Reviewed release commit is dated 2024-05-23. | Correctly forces the data-protection Keychain and exposes access groups and accessibility, but its broad certificate, identity, key, import, SwiftUI, and shared-web-credential surface is unnecessary for one bounded query. Its documented default accessibility is not the required device-only value. | Reject as a dependency. Use its typed-query shape only as prior art; copy no source. |
| KeychainSwift | [`24.0.0` / `5e1b02b6`](https://github.com/evgenyneu/keychain-swift/tree/5e1b02b6a9dac2a759a1d5dbc175c86bd192a608) | MIT | Released Swift package with macOS, access-group, synchronization, and concurrency tests. Reviewed release commit is dated 2024-04-26. | Supports the desired accessibility enum and access group, but the reviewed macOS query does not force `kSecUseDataProtectionKeychain`; its convenience API also covers set/delete/list operations the runtime Host must not expose. | Reject as a dependency. Do not copy or adapt source. |
| `@napi-rs/keyring` native Node module | [`2.0.0` / `f3449416`](https://github.com/Brooooooklyn/keyring-node/tree/f3449416a1b4bf11b0570f0a49395aacc84c8608) | MIT | Maintained cross-platform native package reviewed for the Linux service slice. | Makes a generic Node runtime the Keychain caller and adds a nested native artifact. Any same-account script able to invoke that signed runtime/addon expands the credential surface; the API does not enforce OpenBot's fixed config, item attributes, or parent-child handoff. | Reject for the macOS Host. Reconsider only for an independently signed, invocation-bound runtime design. |
| `/usr/bin/security` subprocess | Current macOS 27 command and local manual/help contract | Apple platform/API terms | Inbox tool, but intended as a general interactive/administrative CLI rather than a narrow service API. Its password output and input flags can place values in process I/O, and its operation surface is much broader than one query. | A separately invokable helper becomes a credential oracle and makes exit text/CLI behavior part of the trust boundary. | Reject. The runtime never shells out or prints a Keychain value. |
| Immediate launcher `exec` into Node | Superseded clause in ADR-0038 | OpenBot MIT | Minimal process model and direct launchd PID ownership. | Once the process becomes generic Node, Keychain access needs a native addon, a credential-bearing environment/argument/file, or a separately callable helper. Environment/argv violate the prior contract, while a plaintext file silently defeats the Keychain milestone. | Reject. Keep a small native Host alive as credential gate and bounded child supervisor. |
| Cosmiconfig | [`10.0.1` / `219805f4`](https://github.com/cosmiconfig/cosmiconfig/tree/219805f445a26a6190d3a46ad43c8b5c3f0a172e) | MIT | Current 2026 release with Vitest coverage; depends on `env-paths` and `js-yaml`. | Designed to search package, rc, YAML, JavaScript, TypeScript, and global config locations and can dynamically import executable config. Even direct `load` leaves unnecessary loaders and dependencies. | Reject. A service must read one non-executable JSON file at one fixed path. |
| Convict | [`6.2.5` / `517840e1`](https://github.com/mozilla/node-convict/tree/517840e19681be3ddc1c8f5d47d0e6c781795cf2) | Apache-2.0 | Current 2026 maintenance release with a broad test suite; depends on `lodash.clonedeep` and `yargs-parser`. | Provides strict schema validation, but deliberately merges environment and command-line values over files and supports pluggable parsers. Those precedence paths are inappropriate for an immutable service boundary. | Reject. Reuse the already-pinned Zod schema and Node core opened-handle reads. |
| Node core file API plus existing Zod | Node.js [`22.22.2` / `2645dc73`](https://github.com/nodejs/node/tree/2645dc73720b1b4f27c49f395d3c66025ce126cc) and [Zod `4.5.4` / `e8e206fa`](https://github.com/colinhacks/zod/tree/e8e206fa33ac5fe7ce20a2beb12d57b1cb3df653) | Node.js license; MIT | Already pinned, shipped, tested, and present in the reuse ledger. Node documents `O_NOFOLLOW` and opened-handle metadata; Zod already validates strict bounded protocol input. | Closes the exact gap without a new parser or search path. Open one fixed file with `O_NOFOLLOW`, validate owner/mode/type/link count/size on the handle, read at most 16 KiB, reject drift, decode UTF-8 strictly, and apply an exact Zod object. | Select for public configuration. |

## Reuse decision

- Selected option: operating-system standards plus narrow adapters over already-pinned Node core and
  Zod.
- Selected upstream or standard: Apple Security/data-protection Keychain, app-bundle code-signing
  entitlements, launchd/Service Management, Node.js opened-handle file APIs, and Zod 4.5.4.
- Why this is the first viable option: it keeps credential access inside one signed native process,
  uses the OS store directly, and adds only OpenBot's missing fixed-item, fixed-child, and private
  handoff policy. General Keychain and configuration libraries expose more operations or precedence
  sources without closing those boundaries.
- Exact OpenBot-specific gap: validate a fixed public config; identify exactly one code-signed shared
  access group; retrieve and validate one device-only, non-synchronizing Keychain item; frame that
  identity over the Host-created child stdin before `START`; keep the Node inert until containment
  succeeds; and forward a bounded graceful/forced stop to the entire child group.
- Upgrade, replacement, or exit plan: keep the Keychain query, config schema, and child protocol
  versioned and small. A later proof-of-possession key can add sign-only operations without exporting
  the private key. If Apple changes Keychain or Service Management, replace only the native adapter;
  Server and Node authority contracts remain unchanged.
- Failure behavior when the upstream is missing, incompatible, or compromised: return a generic
  non-zero Host result before `START`; launchd may throttle and retry, but no file-store, classic
  Keychain, different access group, inherited environment, arbitrary helper, or enrollment-token
  fallback is permitted.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: implementation calls public Apple Security/POSIX APIs and reuses
  existing OpenBot schemas and lifecycle frames. Candidate packages were inspected only.
- Required copyright or license notice location: no new third-party runtime dependency or source is
  incorporated. The separately packaged official Node runtime retains its notices under the macOS
  packaging review.

## Verification plan

- Automated tests: exact public-config schema and fixed path, strict UTF-8/JSON, opened-handle
  type/owner/mode/link/size/drift checks, exact Keychain query and returned attributes, entitlement
  selection, bounded credential framing, inert-before-start child behavior, environment allowlist,
  one child process group, idempotent stop, and generic diagnostics.
- Negative and fail-closed tests: root or wrong user, moved/symlinked/writable bundle or config,
  malformed/oversized/changed config, unknown key, inherited `NODE_OPTIONS` or proxy variables,
  absent/duplicate access group, missing entitlement/profile, locked/denied/classic/synchronizing or
  wrong-account Keychain item, invalid identity, short/extra/oversized/replayed frame, child exit,
  timeout, signal race, and surviving descendant.
- Platforms and devices: portable Node parser/config tests run on every hosted OS; Swift build and
  pure query/supervision tests run on hosted macOS arm64. Keychain entitlement, locked/unlocked state,
  registration, process-group cleanup, login/logout, FileVault reboot, signing, and notarization
  require a dedicated real macOS 13+ account/device.
- User-visible documentation and translations: update the English and Simplified Chinese execution,
  cross-platform, enrollment, and installation journeys together when runtime or registration
  behavior lands.
- Support level that the evidence permits: source-complete arm64 candidate. Source compilation and
  pure tests are development evidence; they do not prove a Developer-ID-signed Host, valid profile, accessible Keychain,
  registered LaunchAgent, notarized package, or macOS support.

## Implementation verification

- The macOS service entry reads only
  `~/Library/Application Support/OpenBot/Node/config.json`. Its opened handle must remain one
  user-owned `0600` regular file with one link, unchanged metadata, strict UTF-8/JSON, and at most
  16 KiB. The strict schema contains only format, Node id, Server URL, concurrency, and log level;
  work state is derived and credentials, enrollment, providers, executable paths, and unknown keys
  are rejected.
- The resulting Node environment fixes `macos-host`, `stdio-v3`, and the derived work directory. It
  contains no identity, enrollment token, credential path, or Provider secret.
- The versioned private parser accepts one 4 KiB-bounded exact Node identity followed by `START`,
  keeps the client inert before both validate, consumes the Host identity once, and then accepts
  only one `SHUTDOWN`. Four focused control tests cover fragmentation, ordering, replay, wrong Node,
  invalid UTF-8/schema, truncation, excess bytes, EOF, handler failure, and detach. Config and
  credential-store suites cover the corresponding fixed-file and one-shot invariants.
- The Node/config focused suite passes 39 tests. The dependency-free Swift package builds and its
  eight tests cover strict configuration, Server-bound identity envelopes, exact data-protection
  Keychain dictionaries, access-group selection, launch policy, private config files, and manifest
  tamper rejection. Direct Security calls and child supervision are compiled into the arm64 Host;
  a distribution-authorized Keychain access remains a controlled-device gate.

## Unresolved questions

- The registration app now performs bounded one-time enrollment, stores and rereads the exact
  Server-bound Keychain envelope, writes one public config, and then registers. Disable and exact
  local identity removal remain separate user actions. Native UI and recovery behavior still need
  controlled-user observation.
- One main app executable now owns both controller and fixed `--worker-host` modes, so the restricted
  entitlement has one app-like bundle. The package gate validates exact Developer ID classes, Team
  ID, application identifier, access group, profile authorization/expiry, hardened runtime, signing
  order, notarization, and staple checks; the required credentials must be supplied externally.
- Process-group and Keychain outcomes need real-device evidence before replacing the current pending
  support label.
