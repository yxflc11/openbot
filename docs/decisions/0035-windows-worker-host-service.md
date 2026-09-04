# ADR-0035: The Windows Worker Host uses a first-party .NET service lifetime

- Status: Accepted for staged implementation
- Date: 2026-09-04

## Context

The Linux Worker Host has established a fixed release, bounded lifecycle, recoverable version
switch, and fail-closed service adapter. G4 must preserve those semantics on Windows without
turning a generic service wrapper, mutable command line, privileged account, or installer into a
second authority.

The acceptance journey, candidate versions, licenses, open issues, package hash, and native
evidence gates are recorded in the
[Windows Worker Host service research](../research/windows-worker-host-service.md).

## Upstream review

- Microsoft's `Microsoft.Extensions.Hosting.WindowsServices` `10.0.11`, built from
  `dotnet/dotnet` commit `e2f47b0110ed922f21a1522da67279133ce28f32`, is the maintained first-party
  adapter between the .NET Generic Host and Windows Service Control Manager. Microsoft documents a
  self-contained single-file executable for Worker Services.
- WinSW stable `v2.12.0` at `eef5bade59fca0254e387ac73ed7625ba6aa7147` was rejected because open
  restricted-account reports show excessive SCM access, ignored account settings, and access
  denial; 3.x is still prerelease.
- `node-windows` `1.0.0-beta.8` at `e60ec01cb63f73a713581548d24256b25c5f93f8` was rejected because it
  bundles WinSW, Sudowin, elevation scripts, and a broad wrapper, while the reviewed package logs
  generated service configuration unconditionally.
- Direct Win32 service callbacks remain a fallback only. They would make OpenBot own more SCM
  interop, timeout, and error behavior than the released first-party adapter.
- Redirected standard input is the selected private graceful-stop channel. It is an inherited
  parent-child pipe with no named endpoint, network listener, credential, or general command API;
  Windows process signals are rejected because Node documents them as abrupt termination.
- `Meziantou.Framework.Win32.Jobs` `4.0.0` at
  `111934ad792cefd946e99bfd1bba71c39e45f163` is the selected process-tree adapter. Its released
  `net10.0` package has no runtime package dependencies and has Windows tests for assignment,
  termination, and kill-on-close. A local P/Invoke copy and .NET `Process.Kill(true)` are rejected;
  Microsoft documents that the latter's completion does not prove descendant exit.
- Microsoft defines LocalService as a minimal local identity with anonymous network credentials.
  A virtual service account provides a service SID but reaches networks as the machine account, so
  it remains part of the later native credential-store comparison.

## Reuse decision

Adopt the released Microsoft Windows Service lifetime and implement only OpenBot's fixed-release
supervision gap. Do not copy upstream source, use a generic XML/command wrapper, or add a Windows
service implementation to the JavaScript Server. The resulting executable will be self-contained
and single-file for the declared architecture so a target machine does not need a separately
managed .NET runtime.

## Source incorporation

No upstream source or tests are copied or substantially adapted. The selected NuGet packages will
be consumed as pinned binary dependencies only after their exact dependency graphs, license
notices, and SBOM entries are checked in with the implementation.

## Verification plan

- Unit-test fixed child selection, exact/fragmented/malformed/oversized standard-input control,
  parent EOF, repeated stops, cooperative Provider cancellation, bounded drain and job termination,
  child crash, lifecycle races, and redacted diagnostics without requiring SCM.
- Build and restore deterministically on a pinned Windows x64 lane, then verify the self-contained
  artifact inventory, hashes, SBOM, dependencies, and absence of a separately required runtime.
- On a controlled native Windows x64 target, prove install, identity, ACLs, non-interactive session,
  start, stop, restart, crash recovery, upgrade, rollback, reboot, and uninstall behavior.
- Reject wrong identity, unsafe ACLs, release drift, missing dependencies, incomplete child
  termination, shutdown timeout, and Credential Manager denial without falling back.
- Keep support experimental and Windows arm64 unclaimed until the corresponding reviewed native
  reports pass.

## Decision

1. The first evidence target is Windows x64. Windows arm64 remains unclaimed until the same native
   lifecycle and security suite passes there.
2. The service prototype runs as `NT AUTHORITY\\LocalService`, never LocalSystem and never an
   interactive user. The final installer must assert the actual SID, executable and state ACLs,
   non-interactive session, and absence of desktop interaction before activation.
3. The host may launch only the packaged OpenBot Node at a fixed path derived from the verified
   active release. It accepts no operator-supplied executable, shell, working directory, environment
   map, or passthrough arguments.
4. In Windows service mode, the child reserves inherited standard input for lifecycle control. SCM
   Stop writes exactly `OPENBOT_NODE_CONTROL/1 SHUTDOWN\n`; the Node accepts at most 64 total bytes,
   treats malformed input or parent EOF before the command as failure, aborts active Providers,
   waits for cooperative cleanup, closes its Server channel, and exits zero only after completion.
   The service applies the outer deadline, so a Provider cannot block SCM indefinitely.
5. The host assigns the child to one unnamed Windows Job Object with `KillOnJobClose` and no
   breakaway flags. If graceful stop exceeds the deadline—or the host itself exits—the complete job
   is terminated. A kill-only wrapper and `Process.Kill(true)` do not satisfy this decision.
6. The service host is not an authority. Enrollment, Node state, capability routing, approvals, and
   audit remain Server-owned. Starting a service cannot enroll a Node or increase its capabilities.
7. Missing dependencies, unsafe ACLs, an unverifiable release, wrong identity, credential-store
   denial, or ambiguous child state blocks start. There is no fallback to LocalSystem, plaintext
   credentials, another release, or interactive execution.
8. Both selected NuGet packages and all shipped dependencies must be pinned, restored
   deterministically, recorded in the SBOM and notices, and scanned before packaging.
9. This decision authorizes the portable Node-side shutdown parser and cooperative drain first, then
   hosted Windows service source and build work. It does not authorize an MSI technology, signing
   identity, release, support claim, or credential-store implementation.

## Consequences

- OpenBot reuses Microsoft's maintained SCM integration and keeps custom privileged code focused on
  the fixed child lifecycle it actually owns.
- LocalService removes a password and limits network authority, but its shared identity makes native
  ACL and Credential Manager evidence mandatory rather than assumed.
- A self-contained host adds a platform-specific build and artifact that must be pinned, scanned,
  signed, inventoried, and tested alongside the packaged Node.
- The implementation cannot begin as an unverified cross-compiled guess on the current macOS host.
  A pinned Windows build lane and controlled native x64 lifecycle report are explicit gates.
- The Windows installer, Credential Manager adapter, and recoverable version switch remain separate
  reviews so this service choice cannot silently decide their security boundaries.
