# Research: Linux Worker Host recoverable install transaction

- Status: Accepted for implementation; trusted-bootstrap and real-host evidence pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G3 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: after an operator verifies an attested Linux Worker Host archive, an install
  transaction stages one immutable version, switches the service to it, and either proves the
  service is active or restores the last known version. A failed or interrupted upgrade preserves
  enough root-owned state for explicit recovery and never modifies the Node credential.
- Security boundary: the installer is a privileged local deployment tool, not a Server authority.
  Archive bytes, extracted paths, service output, and existing filesystem state are untrusted.
  The Server remains the only authority for Node identity, revocation, routing, approvals, and
  audit. Installation must fail closed before executing package code when provenance, digest,
  manifest, architecture, ownership, lock, or recovery state is invalid.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries:
  - `systemd-sysupdate v255 tests A/B current symlink rollback service health`
  - `systemd-sysupdate downgrade current symlink issue`
  - `ostree atomic upgrade rollback application deployment release tests license`
  - `github cli attestation verify cert identity source ref issues`
  - `node-tar 7.5.22 security advisories hardlink symlink path traversal`
  - `tar-stream 3.2.1 extraction filesystem security`
- Standards and primary documentation queries:
  - `FHS 3.0 /opt add-on application /var/lib package state`
  - `POSIX.1-2024 rename atomic symbolic link`
  - `Debian Policy 4.7.4.1 maintainer scripts idempotent half-configured upgrade`
  - `systemd v255 systemctl restart is-active daemon-reload`
  - `GitHub artifact attestation verification signer workflow source digest ref`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0018, ADR-0020, ADR-0032,
  ADR-0033, the Linux service/keyring and archive research records, the Node enrollment guide,
  both open-source reuse ledgers, and G3 in the execution plan.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| FHS paths plus POSIX atomic rename | Filesystem Hierarchy Standard 3.0; POSIX.1-2024 `rename()` | Published standards; no source incorporated | Stable primary specifications | FHS assigns add-on software to `/opt` and private package state to `/var/lib`; POSIX requires same-filesystem rename replacement to be atomic and to operate on a final symlink itself | Adopt the layout and atomic switch primitives |
| `systemd-sysupdate` | systemd `v255` / `db11bab38ccf1ed257f310d29070843d4c58ea01` | LGPL-2.1-or-later | Maintained upstream with unit/integration tests; Ubuntu 24.04 ships the v255 line | Provides versioned whole-resource acquisition and current-symlink switching. It does not know OpenBot's attestation policy, separate credentials/configuration, or whether the Worker Host successfully reconnected; open issue `systemd/systemd#24082` records a downgrade/current-selection edge case | Reject as the first application installer; retain as update-system prior art |
| Debian package lifecycle | Debian Policy `4.7.4.1`, released 2026-03-31; Ubuntu 24.04 `debhelper 13.14.1ubuntu4` | Policy GPL-2.0-or-later; debhelper GPL-2.0-or-later | Mature distribution process and extensive package tooling | Establishes idempotent, noninteractive maintainer scripts, preserved configuration, explicit failure exits, and install/upgrade/remove/purge tests. It also documents half-installed and half-configured error states and does not supply application-health rollback | Adopt its lifecycle rules later for `.deb`; do not make it the archive transaction engine |
| GitHub CLI attestation verifier | `gh` `v2.93.0` | MIT | Current immutable release with source tests and official artifact-attestation documentation | Verifies an artifact digest and SLSA provenance and can bind repository, certificate identity, source ref/digest, OIDC issuer, and hosted-runner policy. Source inspection found that `--signer-workflow` is compiled as a start-anchored prefix regular expression in this release, while `--cert-identity` compares the certificate SAN exactly | Select the exact certificate identity form for the online bootstrap path, pin the executable version, and parse only bounded JSON output |
| GNU tar extraction | GNU tar `1.35`; Ubuntu package revision first exercised as `1.35+dfsg-3ubuntu0.4`; xz `5.4.5` first exercised as `5.6.1+really5.4.5-1ubuntu0.3` | GPL-3.0-or-later; public-domain/LGPL/GPL mix | Mature upstream and Ubuntu security maintenance; already used by the deterministic archive path | Rejects `..` extraction by default and supplies keep-existing plus ownership/permission controls. GNU tar rejects combining `--keep-old-files` with `--no-overwrite-dir`; the private empty staging invariant makes keep-existing the useful race/overwrite guard. These controls are not enough alone: OpenBot must preflight types/paths/counts/sizes and post-verify extracted bytes | Select the absolute binaries with exact upstream version checks, a strict inventory, an empty private staging root, compatible conservative extraction flags, and post-extraction manifest verification |
| `node-tar` | `7.5.22` / `2a22bfc5d3a432a606d9da0e2d87ba634aa3b1cb` | BlueOak-1.0.0 | Active project with extensive tests and rapid fixes | Provides path/link safeguards and extraction limits, but 2026 advisories repeatedly affected hardlink, symlink, PAX, and parser boundaries through versions in the 7.5 line. Adding it would create a second privileged archive implementation beside the already-pinned GNU tar path | Reject for the first installer; reconsider only after a quiet security window and a separate adversarial corpus review |
| `tar-stream` | `3.2.1` / `246572f479d92b0748b21c873e58c64a84a0b826` | MIT | Maintained streaming parser with tests and PAX support | Exposes entry streams but deliberately provides no filesystem extraction policy. OpenBot would have to implement safe creation, ancestry, modes, interruption cleanup, and race handling itself | Reject because it moves the most security-sensitive filesystem behavior into local code |
| OSTree | `v2026.1` | LGPL-2.0-or-later, with separately licensed documentation | Active releases, package/VM integration tests, and security advisories | Strong content-addressed system and application tree deployment with transactional rollback, but introduces a repository, daemon/library/tooling, policy, and host-integration model far wider than one Worker Host | Reject for the first host; reconsider only for managed immutable fleets |
| Focused OpenBot transaction coordinator | Current repository after ADR-0033 | MIT | Must be covered by deterministic state-machine, filesystem, command-contract, crash-recovery, and real-host tests | Can bind the already-reviewed manifest and service contract, preserve configuration and credentials, use version directories, and roll back specifically when OpenBot service activation fails | Implement only the missing coordinator and validation gap |

### GitHub CLI policy-source finding

- The `cli/cli` `v2.93.0` `internal/attestation/policy.go` implementation turns
  `--signer-workflow` into a regular expression anchored only at the start. A longer workflow
  identity can therefore satisfy that flag. OpenBot must not describe it as an exact match.
- The same implementation applies `--cert-identity` as an exact certificate SAN value. For release
  `1.2.3`, OpenBot will require
  `https://github.com/yxflc11/openbot/.github/workflows/node-linux-release.yml@refs/tags/node-v1.2.3`.
- The verifier contract also supplies the exact repository, tag source ref, 40-character source
  commit, SLSA provenance predicate, GitHub Actions OIDC issuer, and
  `--deny-self-hosted-runners`. It invokes `/usr/bin/gh` without a shell, requires exactly
  `gh 2.93.0`, bounds time and output, and rejects empty or ambiguous JSON results.
- `verificationResult.statement.predicate` is workflow-controlled data. The bootstrap derives its
  accepted repository, workflow, ref, commit, and runner policy only from its own expected inputs
  after `gh` succeeds; it does not grant authority to predicate fields.

## Reuse decision

- Selected option: open standards, a released external verifier, existing systemd commands, and a
  narrow OpenBot-specific transaction coordinator.
- Selected upstream or standard: FHS 3.0, POSIX.1-2024 `rename()`, systemd v255 service-manager
  semantics, GitHub CLI v2.93.0 attestation verification with exact certificate SAN matching, and
  Debian Policy 4.7.4.1 lifecycle rules.
- Why this is the first viable option: the standards supply the durable layout and atomic pointer
  change, `gh` supplies the already-selected provenance verification, and systemd supplies service
  lifecycle. A general OS updater or content-addressed host deployment adds authority and state
  without knowing whether this Node actually starts safely.
- System-service adapter contract: use only `/usr/bin/systemctl` from the reviewed systemd v255
  line. `systemctl show` is the upstream machine-readable interface, so the adapter requests only
  `LoadState` and `ActiveState`, requires `LoadState=loaded`, maps exactly `ActiveState=active` to
  active and `ActiveState=inactive` to inactive, and fails closed for `failed`, transitional,
  missing, masked, duplicated, or extra output. Restart targets only the literal
  `openbot-node.service`; the adapter never enables, starts, stops, reloads unit files, resets a
  failure counter, or accepts a caller-supplied unit name.
- The first adapter is intentionally system-profile only. A user-profile adapter must separately
  preserve the dedicated login session's D-Bus and Secret Service boundary and cannot be driven by
  a root installer's environment.
- Exact OpenBot-specific gap: bind a verified archive to its canonical manifest, enforce matching
  architecture and root-owned paths, preflight and safely extract only regular files/directories,
  serialize transactions, preserve a recovery journal, switch `current`, verify service health, and
  restore the prior selection if activation fails.
- Upgrade, replacement, or exit plan: keep the coordinator independent from archive download and
  package-manager metadata. Future `.deb`/`.rpm` packages invoke the same tested state machine or
  replace it only when their native transaction proves equivalent install, upgrade, rollback,
  uninstall, and recovery behavior. Managed immutable fleets may replace it with OSTree or
  `systemd-sysupdate` after a separate integration review.
- Failure behavior when the upstream is missing, incompatible, or compromised: no archive code is
  executed and no service pointer changes. After a pointer change, any command timeout, non-zero
  result, inactive service, malformed output, or journal mismatch restores the prior pointer and
  rechecks the old service. If recovery also fails, both versions and the root-owned journal remain
  intact and the service stays failed for explicit operator recovery.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: only public filesystem, process, and service-manager contracts are
  used. No systemd, GitHub CLI, Debian, debhelper, or OSTree source or tests are copied.
- Required copyright or license notice location: exact upstream versions and licenses are recorded
  here and in both reuse ledgers. External tools retain their own notices; no new runtime source is
  redistributed by this decision.

## Verification plan

- Automated tests: canonical release identity, architecture match, same-filesystem layout,
  immutable destination, archive type/path/count/size inventory, empty-root extraction, final digest
  and manifest binding, relative symlink target, atomic pointer replacement, root-owned journal,
  exact systemctl command sequence, successful first install, successful upgrade, no-op reinstall,
  explicit rollback, and safe pruning of only unreferenced versions.
- Negative and fail-closed tests: unsigned/unverified input, source/digest/ref/workflow mismatch,
  path or symlink escape, non-root ownership, permission drift, version collision, concurrent or
  stale transaction, malformed journal, interrupted staging/switch/restart, restart timeout,
  inactive new service, failed old-service recovery, and attempts to read or replace configuration
  or credential files.
- Platforms and devices: rootless temporary-filesystem tests may validate the state machine. Native
  Ubuntu 24.04 x64 and arm64 hosts must separately prove root ownership, system and user unit
  installation, boot/start/stop/restart, failed-upgrade rollback, reboot recovery, and uninstall.
- User-visible documentation and translations: document verification-before-install, directory
  ownership, service-profile choice, explicit activation, upgrade/rollback/recovery, retained
  versions, and the fact that configuration and credentials survive uninstall unless purged.
- Support level that the evidence permits: accepted transaction design only. No installer, Linux
  support, or production provenance claim exists until implementation, remote attestation, and both
  native architectures pass the stated evidence.

## Implementation verification

- The first rootless coordinator now validates the exact provenance policy, stages immutable
  version directories, replaces only a relative in-root `current` symlink, and keeps credentials and
  configuration outside its API.
- Thirteen transaction tests exercise first install without implicit service start, active upgrade,
  byte-identical no-op reinstall, source-policy rejection, escaping-current rejection, unfinished
  journal/stale-lock rejection, architecture mismatch, successful old-version restoration, and
  failed recovery with both versions and a bounded journal retained. The explicit rootless recovery
  operation also accepts only a canonical private journal, revalidates both release directories,
  compares the recorded pointer and service state, restores only the recorded previous target,
  rechecks a previously active service, never starts a previously inactive service, and preserves
  untrusted or failed-retry evidence.
- A separate provenance adapter now invokes only an absolute executable without a shell, requires
  the reviewed `gh 2.93.0` version line, supplies the exact repository/certificate/ref/commit/
  predicate/issuer/runner/host policy, bounds execution to 30 seconds and 2 MiB per output stream,
  and emits the transaction record only after one matching JSON statement succeeds.
- Seven provenance tests cover the exact argument vector, hostile predicate data, wrong verifier
  release, non-zero execution, malformed/empty/duplicate output, predicate and digest mismatch,
  pre/post archive replacement, symlink/size rejection, process timeout, and output overflow.
- A rootless safe-extraction adapter now requires an empty `0700` staging root, verifies the
  provenance digest, exact GNU tar/xz version lines and compressed stream, accepts only a sorted
  root-owned inventory of safe-mode directories and regular files, rejects links/special files/
  duplicates/escapes and excessive counts or expanded bytes, and uses compatible keep-existing,
  no-owner, no-permission, no-ACL/xattr/SELinux extraction flags. It then compares the actual tree to
  the preflight inventory, rechecks the archive digest, and rebuilds the manifest and checksums.
- Six extraction tests cover the exact commands, unsafe inventory forms, complete extraction,
  partial cleanup, mid-extraction archive replacement, private-root enforcement, and digest
  mismatch. The first real Ubuntu trial caught GNU tar's incompatible `--keep-old-files` plus
  `--no-overwrite-dir` combination; the latter was removed before acceptance.
- The corrected command then extracted the existing 29,155,296-byte x64 archive in the pinned
  Ubuntu 24.04 `linux/amd64` container. The resulting candidate revalidated as version
  `0.1.0-dev.1`, source commit `9644451b6014620a6b7e6b2568d056046ae2c1c2`, and x64. This remains
  container-emulated command evidence, not native-host or privileged-install evidence.
- A system-profile adapter now pins `/usr/bin/systemctl` to the Ubuntu 24.04 systemd 255 version
  line, caches that check for one adapter lifetime, forwards transaction cancellation to the child
  process, and uses only fixed `show` and `restart openbot-node.service` requests. Three contract
  tests cover exact commands, version caching, active/inactive parsing, missing/masked/failed/
  transitional/duplicated/extra state, non-zero results, and redacted diagnostics. The shared
  bounded process test also proves that an external abort terminates an in-flight child.
- These tests use real temporary directories, manifests, checksums, renames, symlinks, durable state
  writes, real bounded child processes, and injected verifier/service outcomes. They do not accept a
  live remote attestation or exercise root ownership, serialized privileged extraction, a native
  systemd manager, reboot recovery through a privileged command, or a native Linux host.

## Unresolved questions

- The trusted bootstrap cannot be distributed only inside the archive it is supposed to verify.
  The first public installer must therefore be delivered through a separately reviewed source or
  native package channel and must validate the exact signer workflow, tag ref, source commit, and
  hosted-runner policy before extraction.
- The current tag workflow uploads temporary review artifacts rather than durable releases. A
  public installer remains disabled until an Owner authorizes and observes provenance and separately
  approves a release/publication channel.
- `.rpm` scriptlet and SELinux integration requires its own distribution review before an RPM is
  emitted. Debian lifecycle rules do not establish RPM correctness.
