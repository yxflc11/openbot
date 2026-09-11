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

PowerShell process startup can add multi-second latency if invoked on every secret load/save. The
shared helper therefore:

1. **Verify on load/save paths only** — Server wiring calls `verifySecretFileAccess` before reading
   secret bytes and `protectSecretFile` after writes; POSIX mode bits remain for non-Windows.
2. **Cache process owner SID** after the first successful script identity probe
   (`OPENBOT_SECRET_OWNER_SID`) so later scripts skip `WindowsIdentity::GetCurrent()`. Server
   `ModelSettingsService` / `FilePluginStore` / bootstrap keep one long-lived ACL helper instance
   for this SID reuse; every load/save still re-runs verify/protect.
3. **ACL-result fingerprint cache is off by default** (`cacheVerifiedState` defaults to `false`).
   Every `verify*` re-checks DACLs so ACL-only grants (for example Everyone) cannot bypass the next
   read. Opt-in `cacheVerifiedState: true` exists only for explicit performance experiments and must
   not be claimed to detect ACL-only changes via mtime.
4. Checks are **not** weakened for temp-directory fixtures (tests use nested dedicated leaves +
   `trustRoot`).

## Source incorporation

- Source copied or substantially adapted: yes — moved/adapted from
  `apps/node/src/credential-store.ts` Windows helpers (themselves adapted from Desktop).
- Required notice: OpenBot MIT; Microsoft Learn cited (no redistributed binary).

## Verification plan

- Shared package unit tests (path boundary, create vs verify-only, optional fingerprint cache via
  injectable `scriptRunner`) run on all platforms.
- Node `credential-store` tests remain green via package import + re-exports.
- Server model-settings / plugin-store tests inject mock ACL on non-Windows; nested dedicated
  directories avoid relying on broad temp parents.
- Real Windows Server negatives (`skipIf(process.platform !== "win32")`) cover model settings,
  bootstrap key, and plugin store/key: ACL-only DACL change after a successful read must fail the
  next read; retained reads after a new process/service instance still work when ACLs remain OK.
  No workflow YAML changes in this PR.

## Unresolved questions

- Whether Administrators should be explicitly Denied (current: absent from Allow set only).
- Whether plugin encryption keys should re-verify DACL on every read even when key bytes are
  process-cached (current: verify on first load into memory; store file verified every read).
