# ADR-0037: The Windows Worker Host installer uses MSI standard transactions

- Status: Accepted platform contract; tool authorization pending
- Date: 2026-09-04

## Context

The experimental Windows Worker Host now has a pinned compiler, locked packages, pure supervision
tests, and a build-only hosted lane. Installing it introduces a different privileged boundary:
files, ACLs, the SCM database, service identity, upgrades, rollback, and retained state must remain
coherent across cancellation and failure. A self-install switch or administrative script would make
OpenBot own those operating-system transaction mechanics.

The acceptance journey, standards, candidates, licenses, and unresolved WiX authorization are
recorded in the
[Windows Worker Host installer research](../research/windows-worker-host-installer.md).

## Upstream review

- Windows Installer 5.0 exposes standard tables for service install/control, service SID and
  required-privilege configuration, failure actions, resource security, upgrades, and rollback.
  Microsoft recommends standard actions where sufficient and requires explicit rollback handling
  for state-changing custom actions.
- WiX `v7.0.0` at `b8977d6f88e7b68e000bac226a2814f236770570` is the current maintained thin authoring candidate.
  Its source is MS-RL, while using the binary release requires explicit OSMF EULA v1.1 acceptance
  and may require a maintenance fee. OpenBot cannot accept that agreement for the Owner.
- WiX v6 carries the same unresolved boundary with a shorter security window; WiX v3 is archived.
  MSIX packaged services require a higher platform floor and restricted capability. Generic scripts,
  self-install, and Electron wrappers add broader or mismatched privileged code.

## Reuse decision

Adopt the Windows Installer standard transaction as the package contract. If separately authorized,
use the exact WiX v7 release only as a declarative authoring adapter. Keep installer policy testable
at the compiled MSI-table layer so the adapter remains replaceable. Add no OpenBot custom action,
downloader, bootstrapper, or privileged transaction engine.

## Source incorporation

No upstream source, examples, tests, packages, or binaries are copied or substantially adapted in
this decision. If WiX is authorized later, preserve its required notices and record exact package
hashes and the Owner's EULA/fee decision before use.

## Verification plan

- Fail static and compiled-database checks unless scope, architecture, file inventory, service name,
  account, type, start mode, service SID, privileges, failure actions, ACLs, upgrade rules, rollback,
  and retention policy exactly match this ADR and its research record.
- Fail if any custom action, URL/download, mutable install path, credential property, password,
  interactive service, LocalSystem/NetworkService/custom account, downgrade, unsigned release input,
  extra file/table, ordinary-user mutation right, or rollback-disable path appears.
- On controlled Windows x64, test install, repair, restart, upgrade, injected-failure rollback,
  reboot, uninstall, locked files, non-admin denial, service SID/ACLs, and retained state. Keep x64
  support unclaimed until those reports and the existing host/Job tests pass together.

## Decision

1. The distributable Windows installer is a per-machine x64 MSI using Windows Installer 5.0
   standard actions and rollback. An MSI is not built until its authoring tool is authorized.
2. The package owns one fixed Program Files release and one fixed `OpenBotNode` service. ProgramData
   state is separately retained; credentials are never MSI files, properties, arguments, or logs.
3. The first install registers a vital, non-interactive own-process service as
   `NT AUTHORITY\\LocalService`, with demand start until a separate credential-aware enrollment
   workflow is available. It never falls back to LocalSystem or another account.
4. Service SID, required privileges, restart policy, resource/service DACLs, stop/delete sequencing,
   repair, and major-upgrade protection must be declarative standard rows and must pass compiled MSI
   inspection plus native tests.
5. Custom actions, downloads, install-path overrides, arbitrary service arguments, embedded
   credentials, disabled rollback, and auto-start before enrollment are prohibited.
6. WiX `v7.0.0` is only a conditional technical candidate. Approval of commits, dependencies, or
   execution work does not constitute acceptance of its OSMF EULA or fee obligations.

## Consequences

The operating system—not an OpenBot administrator script—owns installation rollback, repair, and
service sequencing. Administrators gain a conventional auditable enterprise package and failed
upgrades can restore prior installed files. The cost is strict MSI component/version discipline,
native Windows testing, signing infrastructure, and an explicit legal/commercial decision before
the current WiX binary may enter the build.
