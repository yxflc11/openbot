# Research: Windows Worker Host service boundary

- Status: Accepted for staged implementation; native Windows evidence pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G4 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: An administrator installs a signed Windows x64 Worker Host, the Service
  Control Manager starts it under the declared low-privilege identity, and Stop gives the packaged
  Node a bounded drain period before the complete process tree is terminated.
- Security boundary: The Windows service host is only a lifecycle adapter. It may start one fixed,
  verified OpenBot Node release and report bounded operational failures; it cannot grant Node
  authority, select an arbitrary command, expose an interactive desktop, or replace the Server as
  the source of identity, authorization, routing, approval, and audit. Service, ACL, child-process,
  credential, or shutdown uncertainty fails closed and blocks a support claim.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `Windows Service Node.js wrapper maintained`, `WinSW restricted service account`,
  `WinSW LocalService access denied`, `WinSW credential logging`, `node-windows winsw sudowin`,
  `Microsoft.Extensions.Hosting.WindowsServices shutdown timeout`, `.NET Windows Job Object
  package`, and repository searches for Windows service, installer, Worker Host, and
  credential-store code.
- Standards and primary documentation queries: Microsoft `CreateService`, `LocalService account`,
  `virtual service account`, `.NET Worker Service Windows Service`, `BackgroundService shutdown`,
  redirected `Process.StandardInput`, Windows Job Objects, `Process.Kill(entireProcessTree)`, named
  pipe security, and Node `process.stdin`, Windows signal, and IPC behavior.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `docs/EXECUTION_PLAN.md`,
  `docs/CROSS_PLATFORM.md`, ADR-0031 through ADR-0034, all current `deploy/node` definitions, and the
  Node protocol, enrollment, shutdown, packaging, install-transaction, and credential entries in
  `docs/OPEN_SOURCE_REUSE.md`. No existing Windows service entry or implementation was present.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Microsoft .NET Windows Service lifetime | [`Microsoft.Extensions.Hosting.WindowsServices` `10.0.11`](https://www.nuget.org/packages/Microsoft.Extensions.Hosting.WindowsServices/10.0.11), built from [`dotnet/dotnet` `e2f47b01`](https://github.com/dotnet/dotnet/tree/e2f47b0110ed922f21a1522da67279133ce28f32) | MIT | Current supported .NET release train with Microsoft source, package metadata, and runtime tests. The reviewed nupkg SHA-256 is `84d88ff794bd372e0fcccc1b1755332d1b60201df87e0557ecbca56c707fcf58`; its direct `net10.0` dependencies are the matching `10.0.11` Hosting, EventLog, and ServiceController packages. | Official SCM lifetime integration and documented self-contained single-file deployment avoid implementing `ServiceMain` and control callbacks locally. It does not supply OpenBot release verification, child supervision, bounded drain, or ACL policy. | Select only as the thin Windows service-lifetime adapter. Pin the package and SDK/release line before source implementation. |
| WinSW | Stable [`v2.12.0` / `eef5bade`](https://github.com/winsw/winsw/tree/eef5bade59fca0254e387ac73ed7625ba6aa7147); current 3.x reviewed as prerelease | MIT | Widely used and tested, but stable 2.x is old and 3.x remains prerelease. Open reports include excessive SCM access under restricted users ([#1136](https://github.com/winsw/winsw/issues/1136)), account handling ([#971](https://github.com/winsw/winsw/issues/971)), and NetworkService access denial ([#872](https://github.com/winsw/winsw/issues/872)). | XML can select LocalService and wrap Node, but restricted-account lifecycle evidence conflicts with this boundary. A generic executable/XML pair also creates a broader mutable child-command configuration surface. | Reject for the privileged OpenBot service boundary. Reconsider only after a stable release closes the restricted-account cases with native evidence. |
| `node-windows` | npm [`1.0.0-beta.8` / `e60ec01c`](https://github.com/coreybutler/node-windows/tree/e60ec01cb63f73a713581548d24256b25c5f93f8) | MIT plus bundled components | Still beta. The reviewed package bundles WinSW, Sudowin, elevation scripts, and a broad command wrapper. Its WinSW path contains an unconditional configuration log. | Adds more privileged code and can expose generated service configuration, including sensitive account material. It inherits the rejected WinSW boundary and is not a narrow lifecycle adapter. | Reject. Do not ship, copy, or adapt it. |
| Direct Win32 service implementation | Microsoft [`CreateService`](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-createservicea) and service API contracts | Microsoft documentation/API | Stable operating-system API, but OpenBot would own interop, callback, error, timeout, and process-lifecycle correctness. | Smallest runtime dependency, yet it is a larger OpenBot-specific security implementation than the official maintained .NET lifetime adapter. | Defer. Use only if the selected Microsoft package proves incompatible under native tests. |
| Redirected standard input | .NET 10 [`ProcessStartInfo.RedirectStandardInput`](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.processstartinfo.redirectstandardinput?view=net-10.0) and [Node.js `v22.22.2` / `2645dc73`](https://github.com/nodejs/node/tree/2645dc73720b1b4f27c49f395d3c66025ce126cc) `process.stdin` | Microsoft documentation/API; Node.js license | Stable parent-child stream APIs, already present in the selected runtimes, with no new shipped dependency. | The service creates the anonymous pipe while starting the exact child. There is no named endpoint, command listener, credential, or general IPC surface. EOF also gives the Node a fail-closed parent-loss signal. | Select for one versioned, ASCII, maximum-64-byte shutdown command. Standard input is reserved for lifecycle control in Windows service mode only. |
| Windows named pipe control | .NET 10 `NamedPipeServerStream`, Windows named-pipe ACLs and `GetNamedPipeClientProcessId`, Node.js `node:net` IPC | Microsoft documentation/API; Node.js license | Stable APIs, but require explicit DACL, remote-client, instance, endpoint-name, peer-PID, framing, and denial-of-service tests. Microsoft's default pipe DACL includes broad read access. | Can authenticate a local client when fully constrained, but adds a discoverable namespace and native peer/ACL handling that the one-parent/one-child shutdown path does not need. | Reject for the first service host. Reconsider only if a future bidirectional control requirement cannot use inherited handles. |
| Meziantou Windows Job Object wrapper | [`Meziantou.Framework.Win32.Jobs` `4.0.0` / `111934ad`](https://github.com/meziantou/Meziantou.Framework/tree/111934ad792cefd946e99bfd1bba71c39e45f163) | MIT | Released 2026-07-05, active repository, Windows-only tests for assignment, explicit termination, and kill-on-close. The reviewed nupkg SHA-256 is `b7f80e101c8ced92674b8b3542c13ea4bc2c6fa956ffec88cf0a109b610dd4d7`; its `net10.0` runtime has no package dependencies. | Thin safe-handle wrapper over the exact Win32 Job Object API. It can bind descendants and terminate the unit, whereas .NET documents that `Process.Kill(true)` completion does not prove descendant exit. | Select for process containment, `KillOnJobClose`, and deadline termination. Use an unnamed job with no breakaway flags and keep all broader resource/UI controls disabled until separately reviewed. |
| Local Job Object P/Invoke | Windows [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) API | Microsoft documentation/API | Stable API, but OpenBot would own safe handles, layouts, error translation, and architecture behavior already covered by the maintained package. | Could reduce binary size, but would duplicate a security-sensitive interop layer and its tests. | Reject while the pinned released adapter remains viable. |
| `NT AUTHORITY\\LocalService` identity | Microsoft [`LocalService` account](https://learn.microsoft.com/en-us/windows/win32/services/localservice-account) contract | Microsoft documentation/API | Stable well-known service identity with minimal local privileges and anonymous network credentials. | Avoids a managed password and reduces network authority. Because the identity is shared, release/state ACL isolation and Credential Manager behavior still require explicit native evidence. | Select for the first x64 service-host prototype; do not treat selection as credential-store or production evidence. |
| Virtual service account | Microsoft [service-account guidance](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-service-accounts) and `NT SERVICE\\<name>` support in `CreateService` | Microsoft documentation/API | Stable account type with OS-managed credentials. | Provides a service-specific SID, but authenticates to the network as the machine account and needs native proof for credential-store, ACL, upgrade, and domain-policy behavior. | Defer until the Credential Manager slice compares it on real Windows hosts. |

## Reuse decision

- Selected option: released dependency plus a thin OpenBot adapter.
- Selected upstream or standard: `Microsoft.Extensions.Hosting.WindowsServices` `10.0.11` from
  `dotnet/dotnet` commit `e2f47b0110ed922f21a1522da67279133ce28f32`,
  `Meziantou.Framework.Win32.Jobs` `4.0.0` from commit
  `111934ad792cefd946e99bfd1bba71c39e45f163`, the Microsoft SCM/redirected-input/Job Object
  contracts, Node.js `v22.22.2` standard input, and a self-contained single-file Windows x64
  deployment.
- Why this is the first viable option: It is the current first-party implementation of the SCM
  lifetime contract and removes lower-level service-dispatcher code from OpenBot. WinSW cannot yet
  prove the required restricted-identity lifecycle, while `node-windows` expands the privileged
  surface and can log generated configuration.
- Exact OpenBot-specific gap: Bind SCM start/stop to one fixed verified release, parse one exact
  bounded shutdown frame from inherited standard input, make Node shutdown await cooperative
  Provider cancellation, contain the child in an unnamed non-breakaway job, terminate that job
  after the deadline, emit allowlisted diagnostics, and integrate the existing recoverable install
  states without granting authority.
- Upgrade, replacement, or exit plan: Keep the service-host boundary behind OpenBot-owned lifecycle
  tests. A later maintained WinSW release or direct Win32 host can replace the adapter only if it
  passes the same identity, ACL, stop, restart, crash, and upgrade evidence.
- Failure behavior when the upstream is missing, incompatible, or compromised: The service build,
  install, or start fails. OpenBot never falls back to an interactive process, LocalSystem, an
  arbitrary wrapper, a plaintext credential, or an unverified release.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: none. This record selects a future package reference and platform
  contract; no Windows service source or binary is added in this slice.
- Required copyright or license notice location: Record both MIT packages and all transitive
  shipped licenses in `THIRD_PARTY_NOTICES.md` and the release SBOM when implementation begins.

## Verification plan

- Automated tests: Pure lifecycle tests for fixed executable/argument selection, fragmented/exact/
  malformed/oversized standard-input frames, EOF, repeated stop, cooperative execution drain,
  bounded graceful stop, deadline job termination, child crash, restart, cancellation, redacted
  diagnostics, and install-transaction handoff. Windows integration tests must install, query,
  start, stop, restart, upgrade, roll back, reboot, and uninstall the real service.
- Negative and fail-closed tests: Wrong principal, writable executable/config ancestry, unexpected
  ACL inheritance, missing or changed release, interactive desktop access, SCM denial, incomplete
  child termination, log overflow, locked/denied credential store, and shutdown timeout all fail
  without selecting LocalSystem, plaintext files, or another release.
- Platforms and devices: Windows x64 is the first evidence target. Record exact Windows edition,
  build, architecture, hardware or VM, .NET SDK/runtime, service binary digest, Node release digest,
  account SID, and test version. Windows arm64 remains unclaimed until equivalent native evidence.
- User-visible documentation and translations: Keep the English execution plan, reuse ledger,
  installer/operator guide, and their Simplified Chinese counterparts aligned. Do not change the
  support matrix before reviewed native evidence exists.
- Support level that the evidence permits: Research accepted only. This macOS development host has
  no .NET, PowerShell, Windows SDK, or Windows SCM, so it cannot produce Windows build or lifecycle
  evidence. Source implementation must begin with a pinned Windows build lane and remain
  experimental until a controlled native x64 report passes.

## Unresolved questions

- None for graceful-stop transport: redirected standard input is the private inherited one-way
  channel. Its exact frame is `OPENBOT_NODE_CONTROL/1 SHUTDOWN\n`, with a 64-byte total input bound;
  invalid input or EOF before that frame requests a non-zero fail-closed shutdown.
- Does LocalService-scoped Windows Credential Manager provide the required at-rest and principal
  isolation properties across install, upgrade, repair, and uninstall? The installer must not
  impersonate or write a secret into a different principal's store.
- MSI technology, Authenticode signing, timestamping, and recoverable version-pointer semantics need
  a separate pinned installer review; this service-host decision does not select WiX or claim a
  signed installer.
