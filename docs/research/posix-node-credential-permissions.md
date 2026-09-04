# Research: POSIX Node credential permission drift

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pending
- Acceptance journey: a Worker Host refuses to authenticate from an existing file-backed Node
  identity after that file becomes readable by its POSIX group or other local users.
- Security boundary: the file contains a copyable bearer credential. This check protects the
  baseline POSIX file adapter; it is not Windows ACL validation, host ownership proof, a native
  keyring, or protection from a privileged local operator.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/openssh/openssh-portable authfile.c bad permissions 077 private key`
  - `site:github.com/openclaw/openclaw credential file permissions 0600 security audit`
  - `site:github.com/openclaw/openclaw issue config permissions 0664 save`
  - `site:github.com/docker/cli credentials store native keychain login docs`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `FileNodeCredentialStore` atomically creates the identity with mode `0600`;
  - ADR-0023 defines the bearer-secret limit and future native keyring work;
  - the existing test checked the creation mode but not later permission drift.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| OpenSSH portable | [`1bf5871a`](https://github.com/openssh/openssh-portable/blob/1bf5871aead6d73177d727add15ab0f14c258fdf/authfile.c) | BSD-style collection | Long-lived security-sensitive implementation; current source validates the opened handle with `fstat` | Rejects a current-user private key when any group/other permission bit is set; directly fits the local bearer-secret risk on POSIX | Adapt the invariant and opened-handle validation, not the C source |
| OpenClaw | security fix [`095d5220`](https://github.com/openclaw/openclaw/commit/095d522099653367e1b76fa5bb09d4ddf7c8a57c) and [GHSA-vr7j-g7jv-h5mp](https://github.com/openclaw/openclaw/security/advisories/GHSA-vr7j-g7jv-h5mp) | MIT | The advisory added explicit `0600` creation, repair, and a regression test for exposed transcripts | Confirms that creation mode and later drift both need evidence, but silently repairing an authentication secret would hide operator misconfiguration | Reuse the `0600` creation rule; fail closed instead of repairing on load |
| `write-file-atomic` | [`8.0.0`](https://github.com/npm/write-file-atomic/tree/v8.0.0) | ISC | Existing runtime mechanism with fsync, rename, mode, and cleanup coverage | Correctly handles creation but cannot prevent a later `chmod`, volume-policy change, or manual exposure | Keep for save; add a narrow load-time check |
| Native OS credential stores | [Docker CLI credential-store guidance](https://github.com/docker/cli/blob/master/docs/reference/commandline/login.md#credential-stores) | Documentation reference; helper implementations are MIT | Established use of Keychain, Secret Service, and Windows Credential Manager | Better production destination, but requires separate per-platform adapters and migration semantics | Defer behind `NodeCredentialStore`; do not imply file-mode checks cover Windows |

## Reuse decision

- Selected option: adapt the OpenSSH fail-closed POSIX invariant around the existing
  `write-file-atomic` adapter.
- Why this is the first viable option: no additional package is needed to inspect `Stats.mode`, and
  a keyring dependency would not safely solve all three target operating systems in this slice.
- Exact OpenBot-specific gap: after opening the non-symlink path, validate the opened regular-file
  handle, reject `(mode & 0o077) !== 0` on POSIX, and read through that same handle.
- Upgrade, replacement, or exit plan: preserve `NodeCredentialStore` so Windows DPAPI/Credential
  Manager, macOS Keychain, Linux Secret Service, and injected-secret adapters can replace the file
  implementation without changing enrollment.
- Failure behavior: permission drift stops Node authentication with an actionable error. OpenBot
  does not silently relax or repair the credential file.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: the permission invariant follows the cited OpenSSH behavior; the
  TypeScript implementation uses Node.js filesystem APIs and does not copy upstream code or tests.
- Required copyright or license notice location: exact upstream and license lineage is recorded
  here and in `docs/OPEN_SOURCE_REUSE.md`; no redistributed upstream source requires a NOTICE.

## Verification plan

- Automated tests: preserve atomic `0600` creation; change a saved POSIX file to `0644` and require
  load failure; reject symlinks, directories, oversized content, malformed content, and the wrong
  Node id.
- Negative and fail-closed tests: no credential bytes are parsed after the opened handle fails its
  type, permission, or size boundary.
- Platforms and devices: the new mode rule is POSIX-only. Windows retains regular-file, size,
  schema, and Node-id checks but has no ACL security claim.
- User-visible documentation and translations: document the refusal and `chmod 600` recovery in
  English and Simplified Chinese, with the Windows native-store gap explicit.
- Support level that the evidence permits: contract-tested POSIX file permission enforcement, not
  production device identity.

## Unresolved questions

- Native keyrings, Windows ACL review, credential ownership policy, non-exportable keys,
  proof-of-possession, rotation, mTLS, and replay protection require separate research and tests.
- The configured credential directory remains an operator-controlled boundary. Protecting against
  a malicious writer that can replace entries inside that directory needs a different storage
  adapter and threat model.
