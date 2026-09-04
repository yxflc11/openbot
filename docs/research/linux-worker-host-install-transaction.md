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
| GitHub CLI attestation verifier | `gh` `v2.93.0` | MIT | Current immutable release with source tests and official artifact-attestation documentation | Verifies an artifact digest and SLSA provenance and can bind repository, exact signer workflow, source ref/digest, OIDC issuer, and hosted-runner policy. Historical offline-bundle and signer-pattern issues make exact arguments and contract tests necessary | Select as the reviewed external provenance verifier for the online bootstrap path; do not parse human output |
| OSTree | `v2026.1` | LGPL-2.0-or-later, with separately licensed documentation | Active releases, package/VM integration tests, and security advisories | Strong content-addressed system and application tree deployment with transactional rollback, but introduces a repository, daemon/library/tooling, policy, and host-integration model far wider than one Worker Host | Reject for the first host; reconsider only for managed immutable fleets |
| Focused OpenBot transaction coordinator | Current repository after ADR-0033 | MIT | Must be covered by deterministic state-machine, filesystem, command-contract, crash-recovery, and real-host tests | Can bind the already-reviewed manifest and service contract, preserve configuration and credentials, use version directories, and roll back specifically when OpenBot service activation fails | Implement only the missing coordinator and validation gap |

## Reuse decision

- Selected option: open standards, a released external verifier, existing systemd commands, and a
  narrow OpenBot-specific transaction coordinator.
- Selected upstream or standard: FHS 3.0, POSIX.1-2024 `rename()`, systemd v255 service-manager
  semantics, GitHub CLI v2.93.0 attestation verification, and Debian Policy 4.7.4.1 lifecycle rules.
- Why this is the first viable option: the standards supply the durable layout and atomic pointer
  change, `gh` supplies the already-selected provenance verification, and systemd supplies service
  lifecycle. A general OS updater or content-addressed host deployment adds authority and state
  without knowing whether this Node actually starts safely.
- Exact OpenBot-specific gap: bind a verified archive to its canonical manifest, enforce matching
  architecture and root-owned paths, serialize transactions, preserve a recovery journal, switch
  `current`, verify service health, and restore the prior selection if activation fails.
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
  immutable destination, relative symlink target, atomic pointer replacement, root-owned journal,
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
