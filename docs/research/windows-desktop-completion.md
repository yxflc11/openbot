# Research: Windows Desktop local Server

- Status: Accepted for implementation; native Windows verification required
- Date: 2026-09-10
- Acceptance journey: On Windows x64, install the per-user Desktop, select this computer as the Server, create a local authenticated cluster without Docker, stop it, and reopen the retained database.
- Security boundary: Electron main owns paths and child lifetimes. Server remains authority. Loopback PostgreSQL uses SCRAM; bootstrap secrets use Electron DPAPI. Refuse unsafe ACLs and missing binaries. No privileged service, firewall rule, public listener, or policy bypass is introduced.

## Search evidence

Reviewed the integrated Desktop onboarding and Windows Worker Host entries in `docs/OPEN_SOURCE_REUSE.md`. The latter is a separate unattended service, not required for an app-owned PostgreSQL process. GitHub queries included `leinelissen embedded-postgres windows win32 x64 17.10`, upstream open issues, and Electron safeStorage Windows failures (including issue 33640). The upstream Windows package source, distribution inventory, download implementation and tests were inspected at the pin below. Upstream open issues 28, 32–35 and 38 document reused Windows clusters, plaintext temporary passwords and unsettled shutdown/start promises; binary-only reuse avoids adopting that lifecycle wrapper. The existing Darwin bootstrap incorrectly assumes POSIX modes, `/dev/stdin`, Unix signals and extensionless executables on every supported host.

## Candidate comparison

| Candidate | Exact release / commit | License | Maintenance / fit | Decision |
| --- | --- | --- | --- | --- |
| PostgreSQL native contracts | 17.10, `REL_17_10` source | PostgreSQL | initdb source opens a real password filename; `pg_ctl stop -m fast -w` supports Windows rather than Node signal emulation. | Reuse unchanged native tools. |
| `@embedded-postgres/windows-x64` | 17.10.0-beta.17, `c23ad8a026c711c8666c3c2596d0fde643cf378a` | MIT packager; native components retain separate terms | Same reviewed publisher/version as current Darwin packages; Windows x64 package has initdb.exe, postgres.exe and pg_ctl.exe, plus DLLs and data. npm integrity `sha512-q6xIETTkv67i1QlTWz1LAKb3Z+vG2V3qrp+BjLEWhCQ9jE4hbbsQ/J/3wiOPFLJbuwak7CfHC9EUJG7txAbGKw==`. | First viable released binary adapter; no runtime download or new database implementation. |
| Electron | 44.2.0 | MIT / Chromium notices | Existing pinned runtime: utilityProcess, safeStorage DPAPI and package fuses. DPAPI protects against other logins, not a malicious process running as the same user. | Reuse existing APIs and fail if encryption unavailable. |
| Windows ACL APIs through inbox PowerShell/.NET | Windows PowerShell 5.1 `DirectorySecurity` / `FileSystemAccessRule` | Microsoft platform terms | Set a protected owner-only inheritable DACL on new app data; inspect existing ACLs instead of assuming chmod works. Fixed script, literal environment path, bounded output and timeout. | Thin adapter; no downloaded ACL library or arbitrary command input. |
| Docker / external PostgreSQL | Existing remote path | Component-specific | Requires separate deployment and does not satisfy native local onboarding. | Remains an option but does not replace native Windows path. |

Primary sources: [initdb](https://www.postgresql.org/docs/17/app-initdb.html), [pinned initdb source](https://github.com/postgres/postgres/blob/REL_17_10/src/bin/initdb/initdb.c), [pg_ctl](https://www.postgresql.org/docs/17/app-pg-ctl.html), [DirectorySecurity](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.directorysecurity), [Electron safeStorage](https://github.com/electron/electron/blob/v44.2.0/docs/api/safe-storage.md), [binary upstream](https://github.com/leinelissen/embedded-postgres/tree/c23ad8a026c711c8666c3c2596d0fde643cf378a).

## Reuse decision

Keep the existing controller; adapt the minimum platform seams (binary names, ACLs, initdb password transport, environment and shutdown). Windows stages workspace copies rather than privileged symlinks. A password file exists only within the newly protected staging directory and is removed in `finally`; no password enters command arguments or logs. Runtime code cannot choose an executable or ACL script from renderer data. Future PostgreSQL upgrades must explicitly validate retained cluster major versions.

## Source incorporation

No implementation source is copied or substantially adapted. Binary-only PostgreSQL is staged from the exact optional package with its packager license and OpenBot's native notices. Distribution inventory is not a complete provenance attestation: Windows includes additional third-party DLLs, and their corresponding-source/license inventory must be completed before claiming an attested redistributable binary. No WiX installation or acceptance of its separate commercial terms is implied.

## Verification plan

Portable tests cover Windows command/environment policy, bounded startup failures and packaging resource selection. A Windows-native smoke gate initializes the actual PostgreSQL package with the actual controller, launches the built Server, authenticates, checks health, persists data across restart and checks shutdown. The hosted runner can prove execution and migrations, not an interactive user installation, SmartScreen/code-signing trust, or desktop-control Provider behavior. macOS tests do not substitute for native Windows evidence. User instructions and limitations are maintained in bilingual Windows Desktop documents.

## Source-build replacement (2026-09-10)

The embedded Windows package inventory did not provide complete matching source and build provenance for its bundled modified gettext/libiconv DLLs. It is no longer a distributable input. The accepted replacement is PostgreSQL's official 17.11 source archive (`https://ftp.postgresql.org/pub/source/v17.11/postgresql-17.11.tar.bz2`, SHA-256 `dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979`), built on Windows using the reviewed Meson/MSVC script and minimal optional features. See `scripts/build-windows-postgresql.ps1` and `licenses/windows-postgresql` for exact tool pins, build options, licenses and source URLs. Existing Darwin binaries are unchanged.

Windows staging requires `OPENBOT_WINDOWS_POSTGRES_RUNTIME` from that build. It validates pinned identity/source, required disabled-feature/static-runtime options, each listed file's size/SHA-256, canonical relative paths, absence of symlinks and completeness of the inventory before copying verified bytes. Missing or unexpected files, modified bytes, and the old npm binary package fail closed. The manifest proves consistency with the CI build output, not that an arbitrary externally supplied manifest is trustworthy; the workflow's pinned source download/build is the provenance boundary. Native CI must still install the NSIS output and exercise PostgreSQL authentication, migration and retained restart.
