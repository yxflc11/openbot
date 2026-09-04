# ADR-0036: The Windows Worker Host starts behind a locked .NET build lane

- Status: Accepted for staged implementation
- Date: 2026-09-04

## Context

ADR-0035 selects a small .NET Windows Service lifetime adapter and a Job Object wrapper, but this
macOS development host did not have a .NET toolchain and no Windows-specific project or CI job
existed. Writing the service first would leave compiler, transitive dependency, runtime identifier,
and publish-shape assumptions unverified.

The acceptance journey, versions, alternatives, licenses, and evidence boundary are recorded in the
[Windows Worker Host build-lane research](../research/windows-worker-host-build-lane.md).

## Upstream review

- `actions/setup-dotnet` `v5.3.0` at
  `9a946fdbd5fb07b82b2f5a4466058b876ab72bb2` is GitHub's maintained MIT-licensed action. The
  reviewed release is signed, uses Node 24, supports exact SDK versions and NuGet lock-file caches,
  and requires runner `2.327.1` or newer.
- Microsoft .NET SDK `10.0.400` carries runtime `10.0.11`, matches the selected service package,
  and is the current security-bearing .NET 10 LTS release. Exact selection is stored in
  `global.json`; automatic feature-band, major, and prerelease roll-forward are not allowed.
- The image-preinstalled SDK is rejected as the selection mechanism because GitHub documents that
  installed versions change. Calling `dotnet-install` directly would duplicate the maintained
  action's runner integration, while a Windows container is deferred until release packaging needs
  and reviews that larger boundary.
- NuGet's built-in package lock and `--locked-mode` are selected to bind exact transitive versions
  and content hashes. Restore uncertainty fails instead of rewriting the graph in CI.

## Reuse decision

Use the released first-party action by immutable commit, the exact LTS SDK, and SDK-native locked
restore. Implement only OpenBot's project layout, workflow policy assertions, host contract tests,
and bounded `win-x64` artifact inventory. Do not add a custom SDK installer or depend on a
preinstalled compiler.

## Source incorporation

No upstream source or tests are copied or substantially adapted. The action runs at a full commit;
the SDK and future host packages are binary dependencies. Shipped runtime-package licenses must be
preserved in `THIRD_PARTY_NOTICES.md` and the release SBOM when source references begin.

## Verification plan

- Assert the full action SHA, explicit `windows-2025` runner, exact `global.json`, locked restore,
  and absence of artifact upload in a local workflow-policy test.
- Restore, build, test, and publish on a clean hosted Windows x64 runner. Print `dotnet --info` and
  reject a missing or changed lock.
- Publish a self-contained single-file `win-x64` host and reject files outside the reviewed
  allowlist. Keep symbols and any future notice/SBOM decisions explicit rather than silently
  dropping or uploading them.
- Treat the result as build evidence only. SCM start/stop, service identity, ACL, install, upgrade,
  rollback, reboot, Credential Manager, signing, and real-device evidence remain separate gates.

## Decision

1. The Windows Worker Host uses .NET SDK `10.0.400`, selected by a project-scoped `global.json` with
   feature-band/major/prerelease roll-forward disabled.
2. CI runs on explicit GitHub-hosted `windows-2025` x64 and invokes `actions/setup-dotnet` only at
   `9a946fdbd5fb07b82b2f5a4466058b876ab72bb2`.
3. Every package reference is exact and every project enables a NuGet lock. CI uses
   `dotnet restore --locked-mode`; it does not repair or regenerate locks.
4. The source gate runs restore, build, pure tests, and a self-contained single-file `win-x64`
   publish. It uploads and publishes nothing.
5. Workflow-policy tests reject floating pins, skipped failures, unlocked restore, wrong target,
   and upload steps before remote execution.
6. Passing this lane is not evidence of installation, Windows Service behavior, LocalService ACLs,
   Credential Manager isolation, binary signing, or platform support.

## Consequences

The Windows host gains an auditable compiler and dependency baseline before privileged code grows.
Future service changes receive clean Windows compilation and contract feedback, and upgrades become
explicit review events. The cost is a dedicated CI job, checked-in package locks, and servicing work
for SDK/action pins. Native lifecycle, installer, signing, credential-store, and device evidence
remain intentionally unresolved.
