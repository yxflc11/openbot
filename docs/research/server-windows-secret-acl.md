# Research: Shared Windows secret ACL for Server model/plugin storage (DEV-005 / N2)

- Status: Accepted
- Date: 2026-09-11
- Owner: @yxflc11
- Related issue: DEV-005 / N2 (extends DEV-003 Windows Node credential ACL)
- Acceptance journey: on Windows, Server `model-settings` and `plugin-store` (including `.key`
  files) store secrets under Owner+SYSTEM-only directory/file DACLs using the same path-boundary
  and Allow-ACE rules as the Node file credential adapter; existing directories are verify-only;
  newly created dedicated directories are protected before secret bytes are written; retained files
  remain readable when ACLs are correct.
- Security boundary: file-adapter DACL hardening for Server-local encrypted settings and plugin
  state. Not Credential Manager/DPAPI, PoP/mTLS, or protection from a privileged local operator.

## Search evidence

- Search date: 2026-09-11
- Existing OpenBot reuse ledger / research:
  - [Windows Node credential ACL](windows-node-credential-acl.md) (PR #31 / DEV-003)
  - Desktop `apps/desktop/src/windows-native-security.ts` (original PowerShell/.NET pattern)
  - POSIX credential permission research (mode-bit fail-closed on non-Windows)
- Standards: Microsoft Learn `icacls`; .NET `DirectorySecurity` / `FileSecurity` /
  `SecurityIdentifier` (current user + `S-1-5-18`)

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Extract Node helpers into `@openbot/windows-secret-acl` | OpenBot Node ACL @ `4369f5327776` lineage | MIT | Keeps Node exports/tests; shared unit tests + Server mocked ACL tests | Same Owner+SYSTEM rules for Server secrets; no new npm ACL deps | **Select** |
| Copy ACL scripts into `apps/server` | same | MIT | Second copy drifts from Node | Forbidden duplication for N2 | Reject |
| New native/npm ACL package | various | mixed | package-lock churn | Banned for this slice | Reject |

## Reuse decision

- Selected option: thin shared workspace package `@openbot/windows-secret-acl` (inbox PowerShell +
  .NET only; no new external dependencies).
- Public API: `protectDirectory(created)`, `verifyDirectory`, `protectAndVerifyFile`, `verifyFile`,
  `assertWindowsSecretPathBoundary`, `ensureProtectedSecretDirectory`, `verifySecretFileAccess`,
  `protectSecretFile`, plus Node-compatible re-export aliases.
- OpenBot-specific gap: Server previously skipped Windows ACL checks after POSIX mode bits.
- Failure behavior: refuse load/save when verification fails; errors report fixed phases only.

## PowerShell startup cost mitigation

PowerShell process startup can add multi-second latency if invoked on every hot read (e.g. Agent
`agentSettings()` during ordinary model calls). The shared helper therefore:

1. **Verify on load/save paths only** — Server wiring calls `verifySecretFileAccess` before reading
   secret bytes and `protectSecretFile` after writes; POSIX mode bits remain for non-Windows.
2. **Cache process owner SID** after the first successful script identity probe
   (`OPENBOT_SECRET_OWNER_SID`) so later scripts skip `WindowsIdentity::GetCurrent()`.
3. **Fingerprint cache for verify*** (default on): skip spawning PowerShell when `lstat`
   `dev:ino:size:mtime` matches a prior successful verify/protect in this process. Protect/rewrite
   always spawns. Callers that need every-read ACL revalidation can set `cacheVerifiedState: false`.
4. Residual: ACL-only changes that leave size/mtime/ino unchanged are not re-detected until the next
   write or process restart — documented tradeoff for UI latency; checks are **not** weakened to
   pass temp-directory fixtures (tests use nested dedicated leaves + `trustRoot`).

## Source incorporation

- Source copied or substantially adapted: yes — moved/adapted from
  `apps/node/src/credential-store.ts` Windows helpers (themselves adapted from Desktop).
- Required notice: OpenBot MIT; Microsoft Learn cited (no redistributed binary).

## Verification plan

- Shared package unit tests (path boundary, create vs verify-only, fingerprint cache via injectable
  `scriptRunner`) run on all platforms.
- Node `credential-store` tests remain green via package import + re-exports.
- Server model-settings / plugin-store tests inject mock ACL on non-Windows; nested dedicated
  directories avoid relying on broad temp parents.
- Real Windows negative ACL coverage remains with Node’s existing `skipIf` native tests; prefer
  extending that pattern rather than adding workflow YAML that needs workflow-scope auth in this PR.

## Unresolved questions

- Whether Administrators should be explicitly Denied (current: absent from Allow set only).
- Whether plugin encryption keys should re-verify DACL on every read even when key bytes are
  process-cached (current: verify on first load into memory; store file verified every read).
