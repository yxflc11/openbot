# Windows Desktop

Windows x64 Desktop can run its own local OpenBot Server and PostgreSQL, or connect to an existing Server. The local process belongs to the signed-in user's Desktop session. Installing it does not enroll a Worker Host or grant computer-control authority.

## Install and run

Use the versioned `openbot-desktop-<version>-win32-x64.exe` and verify its SHA-256 against that release's `SHA256SUMS`. The NSIS installer installs per user without requesting administrator rights. It creates a Start menu shortcut and preserves application data on uninstall. Unsigned development installers retain Windows trust prompts; OpenBot does not bypass SmartScreen, policy or antivirus controls.

Open OpenBot and choose this computer as the Server. The application initializes a private PostgreSQL 17 cluster, starts the bundled Server on loopback, migrates its schema and signs in the local Owner. Configure a model through Settings before asking a Bot to work. There is no Docker, PowerShell installer, separately installed Node.js or public network listener required for this local mode.

The installer itself needs no Internet connection once downloaded. A configured remote model or external tool can require network access. The application package includes the exact PostgreSQL binaries; it never downloads database executables on first use.

Windows uses PostgreSQL’s official restricted-token launcher even when Desktop inherits an administrator token. The private database log is `postgres.log` beside the cluster; it is local diagnostic data and is not uploaded. Stop operations verify the database process identity before acting.

## Data and lifecycle

Data lives below Electron's per-user application-data directory in `openbot/local-server`: PostgreSQL data, uploaded objects, model settings and an encrypted bootstrap file. Electron `safeStorage` uses Windows DPAPI for bootstrap encryption. The directory gets an owner-only inheritable NTFS DACL; existing unexpected access is rejected rather than silently repaired. DPAPI is a user-login boundary, not protection from malicious software running under the same login.

Normal quit first asks the Server to stop through its private parent process channel, then invokes PostgreSQL's Windows-aware `pg_ctl stop`. Reopening reuses the same encrypted identity and database. Before manually backing up, quit OpenBot and verify its PostgreSQL process has stopped. Keep the encrypted bootstrap with the database; copying it to another login is not a supported migration. Major PostgreSQL version changes require an explicit migration.

## Verification and current limits

The Windows CI job builds and makes NSIS, installs it into a unique temporary directory, verifies the installed ASAR hash, exercises the **installed** native runtime with Electron DPAPI, real PostgreSQL, schema migration, Owner authentication, stop, persistent restart, and uninstall. The separate native ACL test checks actual NTFS ACLs. Read the actual CI run result for the source commit; adding a workflow is not evidence it passed.

The development host for this change is macOS. Local portable tests passed; native Windows execution is pending its Windows CI run. The smoke harness uses the same controller and installed runtime but does not drive the installed application window. Manual Windows desktop/SmartScreen, code signing, accessibility and real computer-control conformance remain separate acceptance steps. Windows ARM64 is not a supported package target.

The Windows Worker Host service remains a separately reviewed component. Its SCM installer, identity and real-device acceptance cannot be inferred from Desktop installation. Windows PostgreSQL is built from the pinned official 17.11 source using Meson/MSVC with optional dependencies disabled and a static MSVC runtime. Packaging requires the source-build manifest and verifies every installed file; the former npm binary package is not accepted. Review the CI provenance, bundled licenses and code-signing result before advertising an attested production binary; see [research](research/windows-desktop-completion.md). No new macOS or Linux adaptation is included in this milestone.
