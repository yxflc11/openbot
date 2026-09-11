# Research: Windows native ACL test timeout budget

- Status: Accepted
- Date: 2026-09-11
- Owner: @yxflc11
- Related: DEV-005 / N2 native Windows Server ACL tests (follows [server-windows-secret-acl.md](server-windows-secret-acl.md))
- Acceptance journey: hosted Windows CI finishes the real native ACL suite without a 60s harness
  timeout, while every assertion still talks to live Owner+SYSTEM DACLs and every PowerShell spawn
  remains bounded.
- Security boundary: **test-only** Vitest deadline and the native-test `broadenAcl` `execFile`
  timeout. Production `@openbot/windows-secret-acl` `executeFile` stays at `timeout: 15_000`.
  ACL-result fingerprint cache stays off (`cacheVerifiedState` default `false`). No mock ACL in
  the native file.

## Search evidence

- Search date: 2026-09-11
- CI (failure): [PR #37](https://github.com/yxflc11/openbot/pull/37) alpha.7 head
  `956699aa3676d1852886c3814e38a7506cfcb110`,
  [run 34601031115](https://github.com/yxflc11/openbot/actions/runs/34601031115) /
  [Portable (Windows x64) job 103268086588](https://github.com/yxflc11/openbot/actions/runs/34601031115/job/103268086588).
  `server-windows-secret-acl.native.test.ts` first test
  "model settings: ACL-only file DACL change after read fails the next read" reported
  **60009ms** against the **60000ms** harness deadline (`Error: Test timed out in 60000ms`).
  The other 7 native tests passed (bootstrap key 27326ms, plugin file 28772ms, plugin `.key`
  25884ms, parent directory 25043ms).
- CI (green, already near the ceiling): [PR #36](https://github.com/yxflc11/openbot/pull/36)
  [run 34598489450](https://github.com/yxflc11/openbot/actions/runs/34598489450) /
  [Portable (Windows x64) job 103259793174](https://github.com/yxflc11/openbot/actions/runs/34598489450/job/103259793174).
  The same model ACL-only test took **55648ms**; the 8-test file totaled 174783ms.
- Production spawn cap: `packages/windows-secret-acl/src/index.ts` `runWindowsSecretAclScript` →
  `executeFile(..., { timeout: 15_000 })`.
- Vitest per-test timeout: [Vitest `test` API](https://vitest.dev/api/#test) (installed runner).
  Node `child_process.execFile` `timeout` option: Node.js 22 docs.

## Call-count math (`cacheVerifiedState` default OFF)

Each `protectDirectory` / `verifyDirectory` / `protectAndVerifyFile` / `verifyFile` is one
PowerShell spawn. Verify-result fingerprint cache is not used, so every verify* re-spawns.

### Model settings ACL-only (save + summary + broaden + failed summary)

| Step | PowerShell spawns |
| --- | ---: |
| `save()` `#read` while the file is missing | 0 |
| `ensureProtectedSecretDirectory` → `protectDirectory(created=true)` | 1 |
| `protectSecretFile` → `protectAndVerifyFile` | 1 |
| `save()` trailing `summary()` → `verifyDirectory` + `verifyFile` | 2 |
| explicit `summary()` | 2 |
| test `broadenAcl` (one `execFile`) | 1 |
| failed `summary()` → `verifyDirectory` + `verifyFile` (may fail early) | ≤2 |
| **Worst** | **≤9** |

Production budget: 9 × 15s = **135s**. Observed wall time already 55.6s–60.0s under hosted load
(`maxWorkers=2` can overlap native tests).

### Plugin `.key` ACL-only (persist + read + broaden + failed first read on a new store)

| Step | PowerShell spawns |
| --- | ---: |
| `transaction` `#load` while the store file is missing | 0 |
| `#encryptionKey` → `ensureProtectedSecretDirectory` (created) | 1 |
| `protectSecretFile` (`.key`) | 1 |
| `transaction` `ensureProtectedSecretDirectory` (exists; `protectDirectory` still spawns) | 1 |
| `protectSecretFile` (store file) | 1 |
| `first.read()` → `verifySecretFileAccess(store)` | 2 |
| test `broadenAcl` on `.key` | 1 |
| `restarted.read()` → `verifySecretFileAccess(store)` | 2 |
| `#encryptionKey` → `ensureProtectedSecretDirectory` (exists) | 1 |
| `verifySecretFileAccess(.key)` (fails on the file) | ≤2 |
| **Worst** | **≤12** |

Observed wall time on the same green run: **25888ms** (#36) / **25884ms** (#37). Typical hosted
spawn is ~3–6s, not the 15s production cap.

## Candidate comparison

| Candidate | Evidence and fit | Decision |
| --- | --- | --- |
| Raise **only** the native-test Vitest deadline to 9 × 15s + 45s margin (**180_000ms**), and give `broadenAcl` `execFile` the same 15s production spawn cap | Matches call-count math; keeps assertions real; production package untouched | **Select** |
| Re-enable ACL-result fingerprint cache so verify* skip PowerShell | Would hide ACL-only Everyone grants from the next read — the bug these tests exist to catch | Reject |
| Mock ACL in the native file | Drops the Windows DACL contract | Reject |
| Change production `timeout: 15_000` | Out of scope; not a production hang | Reject |
| Unbounded / multi-minute global `testTimeout` | Hides unrelated stalls | Reject |

## Reuse decision

- Selected option: local test-harness bound derived from N production spawns × 15s + overhead.
- Chosen timeout: **`NATIVE_TIMEOUT_MS = 180_000`** on every test in
  `apps/server/src/server-windows-secret-acl.native.test.ts`.
  - Model case: 9 × 15_000 + 45_000 runner/contention margin = 180_000.
  - Plugin `.key` theoretical 12 × 15s equals that harness deadline only if every spawn sat at the
    production cap; hosted evidence is ~26s, so 180s remains a bound rather than an infinite wait.
- `broadenAcl` `execFile` now sets `timeout: 15_000` (same constant as production `executeFile`).
- Failure behavior: a hung spawn still dies at 15s; a hung test still dies at 180s.

## Source incorporation

- Source copied or substantially adapted: no.
- No new dependencies.

## Verification plan

- Native assertions unchanged (ACL-only DACL change must fail the next read; retained reads still
  work when ACLs remain Owner+SYSTEM).
- Linux/macOS: `describe.skipIf(process.platform !== "win32")` — no new Windows-only workflow YAML.
- Do not merge onto PR #37; independent Draft PR against `main` for Codex to integrate.

## Unresolved questions

- Whether `maxWorkers=2` on the Server Vitest Windows job should drop to 1 for this file. Not
  required once the per-test bound covers contention; left unchanged in this slice.

## Follow-up (2026-09-11): `broadenAcl` spawn hang after 15s

- CI after integrating the 180s harness into #37 as `de9ae38`:
  [run 34602659437](https://github.com/yxflc11/openbot/actions/runs/34602659437) /
  [Portable (Windows x64) job 103273480290](https://github.com/yxflc11/openbot/actions/runs/34602659437/job/103273480290).
  All **5 ACL-only** cases failed on the test `broadenAcl` `powershell.exe` spawn after ~15s
  (`Command failed: powershell.exe ...`). The **3 retained-read** cases (no `broadenAcl`) passed.
  This is **not** the 180s Vitest deadline.
- Production `runWindowsSecretAclScript` already calls `operation.child.stdin?.end()` after
  `execFile` and uses inbox `SystemRoot\...\powershell.exe` with `shell: false`. The prior test
  harness used `promisify(execFile)` without closing stdin and invoked bare `powershell.exe` with
  `Get-Acl`/`Set-Acl` (Microsoft.PowerShell.Security module auto-load).
- Selected fix (still test-only): mirror production spawn hygiene — close stdin, pin inbox
  powershell path, `shell: false`, keep **15s** spawn cap — and rewrite `broadenAcl` to fixed
  inbox .NET `GetAccessControl`/`SetAccessControl` + `FileSystemAccessRule` (same family as
  production ACL scripts), not `Get-Acl`/`Set-Acl`. Real negative assertions unchanged. Do **not**
  raise the harness deadline again.

## Follow-up (2026-09-11): Node credential-store native suite (main `71b3d3b`)

- CI (failure): main tip `71b3d3b194165ca8510e72d05984b966d4a06b9f`,
  [run 34608257071](https://github.com/yxflc11/openbot/actions/runs/34608257071) /
  [Portable (Windows x64) job](https://github.com/yxflc11/openbot/actions/runs/34608257071/job/103291957599)
  (see failed log for `apps/node`).
  `credential-store.test.ts:149` "natively enforces Owner+SYSTEM ACLs for Windows credential files"
  reported **60020ms** against the **60000ms** harness (`Error: Test timed out in 60000ms`).
  Sibling "natively refuses load when the parent directory ACL is broadened" passed at **27136ms**.
  Server native ACL suite in the same job was already green (post-#39/#37 broadenAcl hygiene).
- Root cause class: Node native negatives still used bare `powershell.exe` + `Get-Acl`/`Set-Acl`
  via `promisify(execFile)` without `stdin.end()`, without `shell: false`, and without the
  production **15s** `execFile` cap — the same hang class fixed for Server in
  [windows-native-acl-test-budget.md](windows-native-acl-test-budget.md) follow-up above
  (`72990ed` / `cf6db68` into #37).
- Call-count math (`cacheVerifiedState` default OFF) for each Node native negative
  (save + positive load + broaden + failed load):

  | Step | PowerShell spawns |
  | --- | ---: |
  | `save()` → `protectDirectory(created=true)` | 1 |
  | `save()` → `protectAndVerifyFile` | 1 |
  | positive `load()` → `verifyDirectory` + `verifyFile` | 2 |
  | test `broadenAcl` | 1 |
  | failed `load()` → `verifyDirectory` + `verifyFile` (may fail early) | ≤2 |
  | **Worst** | **≤7** |

  Production budget: 7 × 15s = **105s**. Observed parent-directory negative already **27136ms**
  under hosted load when broaden completed.
- Selected fix (test-only, Node credential-store path only):
  1. Mirror Server/production `broadenAcl` spawn hygiene — inbox `SystemRoot\...\powershell.exe`,
     `shell: false`, `operation.child.stdin?.end()`, **15s** spawn cap, fixed
     `[IO.FileInfo]`/`[IO.DirectoryInfo]` + `GetAccessControl`/`SetAccessControl` (no
     `Get-Acl`/`Get-Item`/`Set-Acl`).
  2. Raise **only** the two native Vitest deadlines to **7 × 15_000 + 15_000 margin = 120_000ms**.
  3. Keep real ACL positive/negative assertions; keep production `timeout: 15_000`; keep ACL
     fingerprint cache off (`cacheVerifiedState` default `false`).
- Out of scope: PR #41 / linux-install-identity, H2, desktop attachment, production broaden timeout,
  re-enabling ACL fingerprint cache, deleting negative asserts, flaky/sleep marks.
