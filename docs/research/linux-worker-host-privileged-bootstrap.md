# Research: Linux Worker Host privileged bootstrap boundary

- Status: Accepted for staged implementation; native root/systemd evidence pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G3 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: a root-run bootstrap imports one untrusted release archive into private
  installer state, verifies and extracts that exact imported file, installs it under one exclusive
  lease, and either activates it or preserves a recoverable prior selection.
- Security boundary: the bootstrap is a local privileged deployment tool, not an identity or policy
  authority. Input paths and bytes are untrusted. Destination paths, ownership policy, service unit,
  and provenance policy are fixed by OpenBot. A malformed layout, concurrent/stale lease, changed
  input, unverifiable archive, or recovery journal fails closed before package code executes.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries:
  - `node proper-lockfile 4.1.2 mkdir stale lock race issue`
  - `node-fs-ext 2.1.1 flock release native addon tests`
  - `nodejs node v22.22.2 fs copyFile COPYFILE_EXCL open O_EXCL`
  - `openat2 RESOLVE_BENEATH RESOLVE_NO_SYMLINKS Node.js binding`
- Standards and primary documentation queries:
  - `POSIX.1-2024 mkdir atomic directory operation EEXIST`
  - `Linux openat2 RESOLVE_BENEATH RESOLVE_NO_SYMLINKS path resolution`
  - `Node.js v22.22.2 fs open exclusive copyFile symbolic links`
  - `FHS 3.0 /opt /var/lib private package state`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0032, ADR-0033, ADR-0034,
  `docs/research/linux-worker-host-install-transaction.md`, both open-source reuse ledgers, the
  current provenance/extraction/transaction/systemd adapters, and G3 in the execution plan.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Node core exclusive file import plus POSIX directory lease | Node.js `v22.22.2` / `2645dc73720b1b4f27c49f395d3c66025ce126cc`; POSIX.1-2024 | Node.js license; published standard | Pinned project runtime with upstream filesystem tests; stable standard | `open(..., "wx")` refuses an existing final path and file handles let OpenBot compare the opened source with `lstat`; atomic `mkdir` supplies one local lease. Copying first into a fixed private root removes the user-writable archive pathname from later verification and extraction. Node warns that `copyFile` follows source symlinks and is not atomic, so the bootstrap must use opened handles, explicit bounds, an exclusive destination, and cleanup | Select the primitive set; implement only bounded import, ownership validation, and shared lease composition |
| Linux `openat2` confined resolution | Linux ABI since 5.6; Linux man-pages `6.19` | Linux ABI; man-pages collection licenses | Kernel-maintained interface with explicit escape and symlink tests | `RESOLVE_BENEATH` and `RESOLVE_NO_SYMLINKS` are the strongest way to confine untrusted relative paths, but Node 22 core exposes no `openat2` API. A new native helper would add a separately shipped privileged binary and ABI/build surface | Defer; use no caller-controlled destination paths and require every mutable ancestor to be root-owned and non-writable by group/other |
| `proper-lockfile` | `4.1.2` / `9f8c303c91998e8404a911dc11c54029812bca69` | MIT | Extensive tests, but no release after 2020 and an open 2025 stale-lock race question | Uses atomic `mkdir` and heartbeat-based stale detection. Its own documentation says manual removal/reacquisition is not detected. Time-based automatic stale takeover is unsafe for a paused root installer because two privileged writers may then overlap | Reject the dependency and automatic stale takeover; retain an unexplained lock until explicit inspection/recovery |
| `fs-ext` flock adapter | `2.1.1` / `aded976099c2b06c944f0897a9b004dbf266e234` | MIT | Maintained native addon with tests and a 2.1.1 release | Kernel `flock` releases on process exit, but the native addon adds compilation and platform ABI work, while the installer must retain an explicit crash journal independently. It does not validate ownership or protect the archive path by itself | Reject for the first bootstrap; reconsider if native package installation already requires an addon toolchain |
| Existing OpenBot transaction lock only | Current repository at `d5f48ec` | MIT | Thirteen filesystem state-machine tests | Correctly rejects overlapping activation and retained recovery state, but extraction currently happens before that lock and therefore is not serialized with activation | Expand narrowly into one opaque lease shared across import, verification, extraction, install, and recovery |

## Reuse decision

- Selected option: open standard and released Node core primitives, then a narrow local composition
  gap.
- Selected upstream or standard: Node.js `v22.22.2` opened-handle and exclusive-create APIs,
  POSIX.1-2024 atomic directory operations, FHS 3.0 fixed layout, and the already selected GNU tar,
  GitHub CLI, and systemd adapters.
- Why this is the first viable option: no new dependency can make a user-writable archive pathname
  stable across several external commands. Importing bytes once into a fixed private root removes
  that authority boundary. The existing atomic directory lock already has the desired fail-closed
  behavior when a process dies; automatic age-based reclamation would weaken it.
- Exact OpenBot-specific gap: validate a fixed root-owned/non-group-writable layout; exclusively copy
  a bounded ordinary source through an opened handle into private installer state; bind later
  provenance and extraction to that imported path; and carry one unforgeable in-process lease
  through import, extraction, activation, and explicit recovery.
- Upgrade, replacement, or exit plan: a future `.deb` bootstrap may replace directory creation and
  ownership setup, but it must call the same byte import and transaction policy or prove equivalent
  behavior. A future small `openat2` helper requires its own signed-build and native-architecture
  review before replacing ancestor validation.
- Failure behavior when the upstream is missing, incompatible, or compromised: do not execute
  archive code, do not change `current`, do not automatically reclaim an existing lease, and retain
  recovery state. A partially imported private archive may be removed only while the same lease is
  held and before it becomes transaction evidence.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: only public Node filesystem, POSIX directory, Linux path-resolution,
  GNU tar, GitHub CLI, and systemd contracts are used. No Node, proper-lockfile, fs-ext, kernel, or
  man-pages source or tests are copied.
- Required copyright or license notice location: exact versions, commits, and licenses are recorded
  here and in both reuse ledgers. No new runtime dependency is redistributed.

## Verification plan

- Automated tests: exact fixed destinations, root owner/mode matrix, source/open-handle identity,
  exclusive bounded import, final imported digest, single shared lease, successful cleanup, and
  composition with the existing provenance/extraction/transaction adapters.
- Negative and fail-closed tests: non-root execution, symbolic/writable ancestors, symlink or special
  input, source replacement/truncation/growth, existing destination, stale/concurrent lease,
  unfinished journal, cleanup failure, and forged/released/cross-root lease.
- Platforms and devices: unit tests may use an injected owner id and temporary POSIX filesystem.
  Native Ubuntu 24.04 x64 and arm64 must separately prove real uid 0, ownership, power-loss/stale-lock
  handling, systemd activation/rollback, and reboot recovery.
- User-visible documentation and translations: explain the private byte import, explicit stale-lock
  handling, fixed paths, retained rollback versions, and why this is not yet a public installer.
- Support level that the evidence permits: accepted local bootstrap-boundary design only. It does
  not establish a distributable trusted bootstrap, privileged installer, or Linux support claim.

## Unresolved questions

- The trusted bootstrap still cannot be distributed inside the archive it verifies. Its signed
  package/source channel and update path require Owner authorization and separate release evidence.
- The first native trial must define an operator-visible, authenticated procedure for inspecting and
  removing a stale lease without discarding an unfinished recovery journal.
