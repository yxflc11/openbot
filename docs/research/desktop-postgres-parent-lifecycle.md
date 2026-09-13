# Research: macOS PostgreSQL parent lifecycle

- Status: Implemented; macOS arm64 native acceptance passed
- Date: 2026-09-13
- Owner: @yxflc11
- Acceptance journey: reopen the retained local workspace after abrupt Desktop main-process exit.
- Security boundary: only the directly spawned PostgreSQL child may be signalled; no PID-file-based process adoption, lock deletion, or data reinitialization.

## Search evidence

Searched GitHub for embedded-postgres exit/crash recovery, tini parent-death handling, and proper-lockfile stale ownership. Read the existing Integrated Desktop onboarding and Windows startup entries in OPEN_SOURCE_REUSE.md, native-server.ts, windows-postgres.ts, and package fuse policy. Read the local macOS waitpid(2) manual, Apple's archived wait/poll manuals, PostgreSQL 17 pg_ctl documentation and REL_17_11 source, Electron v44.2.0 utilityProcess documentation, and the pinned embedded-postgres source/tests. The Open Group online POSIX.1-2024 pages returned 403; local platform manuals and Apple's primary documentation supply the platform evidence.

## Candidate comparison

| Candidate | Exact version | License | Maintenance/tests and fit | Decision |
| --- | --- | --- | --- | --- |
| POSIX child wait/pipe primitives on macOS | macOS 13+ system API; local SDK manuals reviewed 2026-09-13 | OS interface, no source incorporation | Direct child ownership is retained until waitpid reaps it; parent pipe EOF survives an abrupt exit. Verify with actual child/parent termination. | Selected thin adapter. |
| embedded-postgres | c23ad8a026c711c8666c3c2596d0fde643cf378a, existing 17.10.0-beta.17 binary source | MIT, PostgreSQL | Source keeps in-memory ChildProcess and async-exit-hook. Tests cover ordinary start/stop and data operations, not SIGKILL recovery. Cannot execute an exit hook after SIGKILL. | Keep binary reuse; do not add wrapper. |
| PostgreSQL pg_ctl | REL_17_11 | PostgreSQL | Standard bounded shutdown, but status uses PID liveness rather than application identity. Status-only synthetic probe reported our unrelated sleep process as a running server. | Do not use status/PID files as adoption authority. |
| Tini | v0.19.0 | MIT | Source/tests/releases inspected; parent-death and subreaper facilities target Linux/PID1 containers. Doesn't supply the required macOS lifecycle contract. | Rejected platform fit. |
| proper-lockfile | README overview only; no release selected | MIT | Stale-time coordination does not prove an old process has exited, particularly during suspension; no process lifetime binding. | Not selected, no dependency added. |

## Reuse decision

Select standard OS primitives before adding a lifecycle dependency. A small app-bundled macOS executable keeps one unreaped direct PostgreSQL child and reads a pipe owned by Desktop. Pipe EOF or a termination request initiates PostgreSQL fast shutdown, with bounded escalation for a stuck child. Never accept a PID to stop; never read postmaster.pid as signal authority. Because the supervisor is the sole reaper, an exited child's PID cannot be reused between its liveness check and signal.

The main process closes the pipe for normal shutdown. A new startup briefly allows a previous supervisor to finish shutdown; PostgreSQL itself remains responsible for cluster lock validation. Existing externally started clusters and old unsupervised orphans are not adopted or killed. The Windows restricted-token adapter remains separate; this change does not prove Windows crash recovery. Simultaneously force-killing both the main process and its supervisor is outside the ordinary parent-crash recovery claim and must remain explicit.

The executable is built with the package toolchain, included in native runtime inventory/signing, and invoked only by trusted main-process code. Missing or failed helper means local startup fails closed, never falls back to unsupervised launch. No runtime download, shell evaluation, RunAsNode fuse change, or credential access is introduced.

## Source incorporation

No upstream source copied or substantially adapted. New C/TypeScript adapter is OpenBot MIT. References:

- https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/wait.2.html
- https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/poll.2.html
- https://www.postgresql.org/docs/17/app-pg-ctl.html
- https://github.com/postgres/postgres/blob/REL_17_11/src/bin/pg_ctl/pg_ctl.c
- https://github.com/leinelissen/embedded-postgres/tree/c23ad8a026c711c8666c3c2596d0fde643cf378a
- https://github.com/krallin/tini/tree/v0.19.0
- https://github.com/electron/electron/blob/v44.2.0/docs/api/utility-process.md

## Verification plan

Native child fixtures cover pipe-close shutdown, abrupt parent death, child early exit, repeated stop, and no signal of unrelated processes. Actual Electron + packaged PostgreSQL/Server covers retained data/bootstrap across crash and immediate reopen, concurrent cluster refusal, normal restart, and helper inclusion/signature inventory. Full npm run check before handoff. Update English/Chinese installation behavior and support limits together. No real Windows crash claim without independent hardware/CI evidence.

## Unresolved questions

Windows crash recovery and simultaneous supervisor termination remain outside this change. A locally packaged unsigned candidate is not a published or notarized release.

## Verification results

- Three actual Electron main-process SIGKILL/immediate-reopen cycles returned ready, retained a committed database row and the exact bootstrap ciphertext digest, and left no old PostgreSQL process. Isolated data and synthetic encryption; not a Keychain test.
- A competing NativeServerController for the same cluster failed without stopping the active owner or changing its PostgreSQL PID.
- Native supervisor and existing controller tests: 23 passed, including ordinary pipe shutdown, termination request, early exit, invalid arguments, unrelated process survival and bounded escalation.
- Full npm run check passed. Native runtime staging and unsigned macOS arm64 packaging passed; helper bytes matched staged bytes, native code signature verification passed, and the compiled adapter was present in ASAR. The package was not installed over the user application.

