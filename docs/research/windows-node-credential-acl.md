# Research: Windows Node credential ACL enforcement

- Status: Accepted
- Date: 2026-09-11
- Owner: @yxflc11
- Related issue: DEV-003 / DEV-002 M5
- Acceptance journey: on Windows, a file-backed Node identity is stored under an Owner+SYSTEM-only
  directory and file DACL; load refuses unexpected Allow ACEs, inherited grants, reparse points, or
  non-regular paths before any credential bytes are trusted.
- Security boundary: protects the baseline Windows file adapter for a copyable bearer credential.
  It is not Credential Manager/DPAPI, proof of possession, or protection from a privileged local
  operator. Linux Secret Service and macOS Host adapters are unchanged.

## Search evidence

- Search date: 2026-09-11
- Standards and primary documentation queries:
  - Microsoft Learn `icacls` inheritance and grant semantics
    (`https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls`)
  - .NET `DirectorySecurity` / `FileSecurity` `SetAccessRuleProtection`, `FileSystemAccessRule`,
    `SecurityIdentifier` for current user and `S-1-5-18` (SYSTEM)
- GitHub / OpenBot reuse:
  - Existing Desktop helper `apps/desktop/src/windows-native-security.ts` (Owner-only private
    directory via encoded PowerShell; path passed only through environment variables)
  - POSIX Node credential research `docs/research/posix-node-credential-permissions.md`
  - `write-file-atomic@8.0.0` for atomic rename/fsync (already depended)

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Adapt Desktop PowerShell ACL pattern | OpenBot `apps/desktop/src/windows-native-security.ts` @ `729c16431057` | MIT (OpenBot) | Already contract-tested for Desktop private dirs | Same threat model for sensitive local files; Node must not import Desktop | Adapt the pattern locally into `apps/node` (file + directory; Owner+SYSTEM) |
| Native addon / new npm ACL package | various | mixed | Would require `package-lock` changes banned in this slice | Extra supply-chain surface for a small boundary | Reject for this slice |
| `icacls` argv with user names | Windows inbox | Microsoft | Localized account names are brittle | Prefer SID-based .NET ACL APIs | Reject as primary mechanism |
| Windows Credential Manager | Win32 Cred* APIs | platform | Better long-term store | Separate adapter / H3 scope; not this M5 file-store fix | Defer |

## Reuse decision

- Selected option: thin local adapter using inbox Windows PowerShell + .NET ACL types, modeled on the
  existing Desktop private-directory helper, without adding dependencies.
- Why first viable: no lockfile change; path never interpolated into the script; fail-closed errors
  report only fixed phases; aligns with Owner+SYSTEM requirement for service-friendly hosts.
- Exact gap: `FileNodeCredentialStore` skipped permission checks on `win32` after POSIX mode bits.
- Upgrade plan: keep `NodeCredentialStore` so Credential Manager/DPAPI can replace the file store.
- Failure behavior: refuse load/save when ACL verification fails; never print credential bytes.

## Source incorporation

- Source copied or substantially adapted: yes (pattern adapted from OpenBot Desktop helper; no
  Microsoft sample source copied).
- Required notice: OpenBot MIT; Microsoft Learn documentation cited (no redistributed binary).

## Verification plan

- Automated: POSIX tests unchanged; injectable Windows ACL helper tests on all platforms; native
  Windows workflow runs real ACL save/load and broad-ACL rejection.
- Negative: symlink/reparse, unexpected Allow ACE, missing owner FullControl, oversized/invalid JSON.
- Docs: NODE_ENROLLMENT EN/ZH note that Windows file store now enforces Owner+SYSTEM DACLs.

## Unresolved questions

- Whether Administrators should be explicitly denied vs simply absent from Allow set (current
  choice: only Owner+SYSTEM Allow ACEs; no explicit Deny entries).
- Ancestor reparse/junction refusal reduces writable-parent substitution risk; it does **not** claim
  all Windows path-attack classes are closed. Load also verify-only checks the immediate parent
  directory DACL (Owner+SYSTEM) so unexpected Write/DeleteChild Allow ACEs fail closed — separate
  from junction detection.
- Existing operator-owned credential directories are verified only (no automatic ACL rewrite).
- `allowMissingLeaf` permits multiple missing trailing segments for first-install nested paths;
  tests bound reparse walks with a realpath-normalized trust root and use `mklink /J` for junctions.
