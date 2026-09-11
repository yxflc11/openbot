# Research: Linux installer filesystem identity

- Status: Accepted for implementation
- Date: 2026-09-11
- Owner: OpenBot maintainers
- Related issue: G3 in `docs/EXECUTION_PLAN.md`; lease/import `release:check` failures on overlayfs
- Acceptance journey: replacing a held install lock directory, or overwriting an import source
  in place at the same size, is detected and fails closed on Linux filesystems whose `st_ino`
  and `mtime`/`ctime` are not unique or not updated, including Docker overlayfs used by Builder
  and hosted CI.
- Security boundary: the installer remains a local privileged deployment tool. A lock that was
  replaced must never be `rmdir`'d by the previous holder. An untrusted archive source that
  changes after the reviewed-size `lstat` must never be retained. Server identity and policy are
  unchanged.

## Search evidence

- Search date: 2026-09-11.
- GitHub queries:
  - `overlayfs inode reuse rmdir mkdir st_ino xino`
  - `overlayfs write does not update mtime ctime`
  - `nodejs fs.Stats mtimeMs ctimeMs bigint mtimeNs precision`
  - `proper-lockfile mkdir stale lock race issue` (already rejected in the bootstrap review)
- Standards and primary documentation queries:
  - Node.js `v22.22.2` `doc/api/fs.md` class `fs.Stats` / "Stat time values"
  - Linux kernel Overlay Filesystem documentation (`xino`, non-persistent directory `st_ino`)
  - POSIX.1-2024 `mkdir` / `open` `O_EXCL` / `O_NOFOLLOW`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  `docs/research/linux-worker-host-privileged-bootstrap.md`,
  `docs/research/linux-worker-host-install-transaction.md`,
  `docs/OPEN_SOURCE_REUSE.md` Linux Worker Host privileged bootstrap row, and the current
  `scripts/node-linux-install-lease.mjs` / `scripts/node-linux-archive-import.mjs` identity checks.

## Builder-box reproduction

- Node `v22.22.2` (`process.versions.node` 22.22.2, `modules` 127) on Linux 6.12.94+ x86_64.
- `/tmp` is overlayfs (`stat -f -c %T` → `overlayfs`; `df -T /tmp` → `overlay`).
- Baseline SHA `0ff279895697061ac47701bfdda935f444c4549c`.

### Lock directory replace (`node-linux-install-lease.test.mjs:56`)

`rmdir` + `mkdir` of the same `transaction.lock` path reused overlay `st_ino` **300/300** times
(always `dev=39`, `ino=666838` in the probe). Node default `ctimeMs` matched **287/300** times.
Kernel `stat -c` confirmed the reused inode; when timestamps did move, they moved by ~4 ms
buckets. The production check compared `dev`/`ino`/`mode`/`ctimeMs` only, so a replaced empty
directory looked identical and `releaseLinuxInstallLease` removed it.

Actual test fail rate on this box: **33/40** (`Missing expected rejection.`).

### Same-size source overwrite (`node-linux-archive-import.test.mjs:47`)

A 1-byte in-place overwrite of a 20 MiB sparse source often left `mtimeMs`/`ctimeMs`/`mtimeNs`/
`ctimeNs` and size unchanged. A 50-trial Node probe missed the change **47/50** times. GNU
`stat -c` showed the same nanosecond mtime/ctime before and after `dd conv=notrunc`. Node
documents that `mtimeMs`/`ctimeMs` precision is platform-specific and that `mtimeNs`/`ctimeNs`
exist only with `{ bigint: true }` and remain filesystem-specific
(`nodejs/node` `v22.22.2` `doc/api/fs.md`). Overlayfs documentation states `st_ino` is not
guaranteed unique or persistent without `xino`.

Isolated import-test fail rate on this box: **2/20** (higher when the write lands in the same
timestamp quantum as create; the full file failed on the first combined run).

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Node `fs.Stats` `dev`/`ino`/`mode`/`ctimeMs` | Node.js `v22.22.2` / `2645dc73720b1b4f27c49f395d3c66025ce126cc` | Node.js license | Pinned runtime | Insufficient on overlayfs: directory `st_ino` is reused after `rmdir`+`mkdir`, and `ctimeMs` often matches in the same millisecond/4 ms bucket | Reject as the sole lock identity |
| Node bigint `ctimeNs`/`mtimeNs` | Same pin; `lstat(path, { bigint: true })` | Node.js license | Documented in `fs.md`; fields are absent unless `bigint: true` | Still filesystem-specific. Overlayfs in-place writes observed here did not bump nanosecond mtime/ctime at all | Reject as the sole content-change detector |
| Overlayfs `xino=on` | Linux overlayfs documentation, kernel 6.12 line | GPL-2.0 kernel | Kernel-maintained | Would improve inode uniqueness for this Builder mount, but the installer cannot require a host mount option and ext4 can still reuse a freed inode | Reject as a production dependency |
| `proper-lockfile` / `fs-ext` flock | Already reviewed `4.1.2` / `2.1.1` | MIT | See privileged-bootstrap record | Still rejected: age-based takeover and a native addon do not close this identity gap | Keep rejected |
| Process-private `O_EXCL` token file inside the `mkdir` lock | Node.js `v22.22.2` `crypto.randomBytes`, `open(O_CREAT\|O_EXCL\|O_NOFOLLOW)`, POSIX exclusive create | Node.js license; POSIX | Pinned runtime | Empty `rmdir`+`mkdir` cannot reproduce a 32-byte secret stored only in the in-process `WeakMap`. `O_NOFOLLOW` refuses a replaced symlink. Release unlinks the token then `rmdir`s only after the token matches | Select for lock identity |
| Bounded regular-file SHA-256 before the injectable opener | `sha256BoundedRegularFile` in `scripts/node-linux-release.mjs`; `O_RDONLY\|O_NOFOLLOW\|O_NONBLOCK`, fstat regular-file + size bounds, cumulative byte limit; Node `crypto.createHash` | Node.js license | Import pre-digest + import-path digest binding | Detects same-size in-place mutation without mtime/ctime. Refuses symlink/FIFO/oversize/growing reads; does not use unbounded `createReadStream`. Two-pass contract binds attestation / source trustworthiness | Select for import TOCTOU |

## Reuse decision

- Selected option: open standard and released Node core primitives, then a narrow local gap.
- Selected upstream or standard: POSIX exclusive file create and `O_NOFOLLOW`; Node.js `v22.22.2`
  `crypto.randomBytes` / `timingSafeEqual` / `createHash("sha256")`.
- Why this is the first viable option: the lock is already an atomic `mkdir`. Adding one exclusive
  private token file inside it does not add a dependency or automatic stale takeover. Failure
  cleanup unlinks that token only after an `O_NOFOLLOW` open and `timingSafeEqual` prove this
  attempt still owns it; otherwise artifacts stay and the error is reported. Source-byte digest
  already exists for the imported copy; the bounded pre-digest before `openFile` closes the
  metadata-only hole without sleeping, unbounded reads, or dropping the negative tests.
- Exact OpenBot-specific gap: treat overlayfs inode reuse and frozen timestamps as a production
  identity failure, not a flaky test. Keep `dev`/`ino`/`mode`/`ctimeMs` as extra defense, but do
  not trust them alone.
- Upgrade, replacement, or exit plan: a future `openat2` helper or kernel change-cookie (`statx`)
  adapter may replace the token/digest checks after its own native review. Do not revert to
  timestamp-only identity.
- Failure behavior when the upstream is missing, incompatible, or compromised: a missing or
  mismatched token fails closed and does not `rmdir` the replacement lock. A source digest
  mismatch deletes the exclusive import and does not return a path.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: only public Node filesystem/crypto contracts and kernel overlayfs
  documentation are used. No kernel, Docker, or lock-library source is copied.
- Required copyright or license notice location: Node version pin remains in
  `docs/OPEN_SOURCE_REUSE.md` and the privileged-bootstrap record.

## Verification plan

- Automated tests: existing lease nested/standalone/forged/concurrent tests; replacement must
  reject and leave the replacement directory; import symlink/undersized/changed-source tests must
  reject without retaining bytes. Repeat the two formerly failing tests on overlayfs `/tmp`.
- Negative and fail-closed tests: same-length token rewrite and token symlink must refuse release
  without removing the replacement; `discardIncompleteLock` must retain foreign tokens; bounded
  pre-digest must reject symlink, FIFO, and oversize/growing sources. Do not delete the
  replacement-lock or changed-source assertions; do not add `sleep` or mark the tests flaky.
- Platforms and devices: overlayfs `/tmp` on this Builder box. Native ext4/xfs hosts still benefit
  because inode reuse after `rmdir`+`mkdir` is also possible there.
- User-visible documentation and translations: not user-visible; installer support claims are
  unchanged.
- Support level that the evidence permits: rootless temporary-filesystem identity only. Not a
  privileged native-host installer claim.

## Unresolved questions

- Native Ubuntu 24.04 ext4/xfs still needs privileged-host evidence for the broader bootstrap.
  The token and digest checks are independent of that gate.
