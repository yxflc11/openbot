# ADR-0034: Linux Worker Host installation is a recoverable version switch

- Status: Accepted
- Date: 2026-09-04

## Context

ADR-0033 produces a bounded, verifiable Linux archive but deliberately does not install it. A
privileged installer can leave the machine on mixed bytes, overwrite local configuration, or stop
the last working Worker Host if it treats extraction and service restart as unrelated commands.

The acceptance journey and exact upstream comparison are recorded in the
[Linux Worker Host recoverable install transaction research](../research/linux-worker-host-install-transaction.md).

## Upstream review

- FHS 3.0 assigns add-on application software to `/opt` and private package state to `/var/lib`.
- POSIX.1-2024 requires same-filesystem `rename()` replacement to be atomic, including when the
  final path is a symbolic link.
- systemd `v255` / `db11bab38ccf1ed257f310d29070843d4c58ea01` supplies the service lifecycle and
  versioned-update prior art, but its generic updater cannot judge OpenBot provenance or Node health.
- GitHub CLI `v2.93.0` supplies machine-readable attestation verification and policy flags. Its
  source shows that `--signer-workflow` is a prefix match, so OpenBot instead requires the exact
  certificate SAN with `--cert-identity`.
- GNU tar `1.35` and xz `5.4.5` are already pinned by the archive workflow. `node-tar 7.5.22` was
  rejected after reviewing its dense 2026 path/link advisory history, and `tar-stream 3.2.1` was
  rejected because it would leave privileged filesystem extraction policy to OpenBot.
- Debian Policy `4.7.4.1` requires idempotent noninteractive lifecycle scripts and explicitly
  documents partial package states; OSTree `v2026.1` provides wider host deployment than G3 needs.

## Reuse decision

Adopt the FHS layout, POSIX atomic rename, exact GitHub attestation-verification contract, and
systemd service commands. Implement only OpenBot's missing version selection, health-bound rollback,
and crash-recovery journal. Do not add an OS updater, content-addressed host repository, daemon, or
package-manager abstraction to the first archive installer.

## Source incorporation

No upstream source or tests are copied or substantially adapted. Exact releases, licenses, known
limitations, and replacement plans are recorded in the research note and reuse ledgers.

## Verification plan

- Model and test the transaction before exposing any privileged CLI.
- Cover first install, no-op reinstall, upgrade, explicit rollback, interruption at every durable
  boundary, failed new-service activation, successful old-service recovery, and failed recovery.
- Prove the real system and user service lifecycles on native Ubuntu 24.04 x64 and arm64, including
  reboot recovery and locked/unlocked Secret Service behavior.
- Keep English and Simplified Chinese operator documentation aligned and keep the Linux support
  level experimental until every required artifact is observed.

## Decision

1. Installed immutable versions live below `/opt/openbot-node/versions/`. The active service path
   remains `/opt/openbot-node/current`, which is a relative symlink replaced atomically on the same
   filesystem. Version directory identity binds version, Linux architecture, and source commit.
2. The installer accepts only the absolute GNU tar `1.35` and xz `5.4.5` tools, preflights a bounded
   verbose archive inventory, and rejects links, special files, duplicate or escaping paths,
   unexpected roots, unsafe modes/owners, and excessive members or expanded bytes. It extracts with
   no owner/permission preservation into an empty private staging root and uses `--keep-old-files`
   to refuse races or overwrites. GNU tar's incompatible `--no-overwrite-dir` flag is not combined
   with it. The installer then checks the archive digest again and fully rebuilds the candidate
   manifest and checksums before placing it in `versions/`. Existing version paths are never
   overwritten. Identical reinstall is a no-op; conflicting bytes fail.
3. The public install path must verify the outer archive's GitHub attestation before extraction,
   binding `yxflc11/openbot`, the exact certificate SAN for
   `.github/workflows/node-linux-release.yml@refs/tags/node-v<SemVer>`, the matching tag source ref
   and source commit, the SLSA provenance predicate, the GitHub Actions OIDC issuer, and hosted
   runners. A checksum or `signed: false` inner manifest is not provenance, and the prefix-matching
   `--signer-workflow` flag is insufficient for this boundary.
4. Configuration and credentials remain outside every version directory. Install, upgrade,
   rollback, remove, and prune never read, copy, overwrite, migrate, or delete them. Purge is a
   separate explicit future command.
5. Root-owned transaction state lives below `/var/lib/openbot-node-installer/`, separate from the
   runtime-writable Node state. A single exclusive transaction and a durable journal identify the
   staged version, previous selection, phase, and required recovery action.
6. Upgrade stages the new version while the old service may continue running, atomically switches
   `current`, then restarts and verifies the selected service. Any timeout, non-zero result, inactive
   state, malformed response, or interruption after switching triggers recovery to the prior target.
   The system-profile adapter uses only `/usr/bin/systemctl`, a literal `openbot-node.service`, the
   machine-readable `show` command with `LoadState`/`ActiveState`, and `restart`. It accepts only
   loaded plus exactly active/inactive state, bounds every process, and never enables, implicitly
   starts an inactive service, resets failures, reloads units, or accepts an arbitrary unit name.
7. Recovery restores the prior pointer before attempting to start the old service. If that service
   also fails, the installer preserves both versions and the journal, reports a bounded generic
   failure, and performs no destructive cleanup.
8. First installation does not silently enroll, enable, or start a service. Profile selection,
   configuration, enrollment, activation, and removal are explicit operations. Upgrades restart
   only a service that was active before the transaction.
9. Successful activation retains at least the active and immediately previous versions. Pruning is
   explicit and may remove only a manifest-verified, root-owned version not referenced by `current`,
   the recovery journal, or the retained rollback set.
10. This ADR authorizes a rootless transaction model and tests first. It does not authorize a public
    installer, release, tag, support claim, or provenance claim before the trusted bootstrap and
    real-host gates pass.

## Consequences

- A broken upgrade cannot silently destroy the last known selection, and recovery evidence survives
  the same failures it is meant to diagnose.
- Credentials and local configuration have an independent lifecycle, so binary rollback does not
  roll identity backward or leak it into release artifacts.
- Version directories consume more disk space and the coordinator needs careful interruption tests.
- `.deb`, `.rpm`, Windows MSI/service, and macOS pkg/launchd can reuse the transaction states and
  rollback semantics while implementing their own ownership, signing, and platform service rules.
- Linux remains experimental until trusted publication plus native x64/arm64 lifecycle and keyring
  evidence exist.
