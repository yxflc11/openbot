# Research: Windows Worker Host reproducible build lane

- Status: Accepted for staged implementation; hosted execution pending
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G4 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: A clean GitHub-hosted Windows x64 runner restores the exact reviewed package
  graph, builds and tests the Worker Host, publishes one self-contained `win-x64` executable, and
  rejects compiler, dependency-lock, or artifact-shape drift before any installer consumes it.
- Security boundary: This lane proves only reproducible compilation and portable host contracts. It
  does not install a service, authenticate a Node, sign a binary, publish an artifact, exercise the
  Service Control Manager, or grant a Windows support claim. Actions, SDKs, packages, and runner
  input are untrusted until pinned and checked; uncertainty fails the job without a fallback SDK or
  unlocked restore.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `actions/setup-dotnet releases v5`, `setup-dotnet cache packages.lock.json`,
  `setup-dotnet windows runner issues`, `.NET SDK 10.0.400 release`, and repository searches for
  existing .NET projects, Windows workflows, package locks, and third-party notices.
- Standards and primary documentation queries: GitHub Actions immutable commit pinning and hosted
  runner labels; Microsoft `.NET 10.0.11` release metadata, `global.json`, locked NuGet restore,
  deterministic builds, self-contained single-file publish, and runtime identifier catalog.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `docs/EXECUTION_PLAN.md`,
  `docs/CROSS_PLATFORM.md`, ADR-0035, the Windows Worker Host service research, the cross-platform
  Node CI baseline, `.github/workflows/ci.yml`, the workflow policy checker, and both open-source
  reuse ledgers. No .NET project, SDK pin, NuGet lock, or Windows service build job existed.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| GitHub `actions/setup-dotnet` | [`v5.3.0` / `9a946fdb`](https://github.com/actions/setup-dotnet/tree/9a946fdbd5fb07b82b2f5a4466058b876ab72bb2) | MIT | First-party action, signed GitHub release, 607 commits at review, unit/e2e suites, and explicit exact-version plus lock-file cache support. V5 uses Node 24 and requires runner `2.327.1` or newer. | Installs the exact SDK declared by OpenBot and can key a cache from the checked-in lock without persisting repository credentials. A full commit pin removes mutable-tag execution. | Select at the full commit. Keep cache disabled initially so the first contract does not depend on mutable runner cache state. |
| Preinstalled hosted-runner SDK | GitHub `windows-2025` image at execution time | Runner image licenses | GitHub maintains and updates the image, but its installed SDK set changes over time. | Fast, but a passing build could silently select a different feature band or prerelease when the image rolls. | Reject as the selection mechanism. Record `dotnet --info`, but install and select the checked-in exact SDK. |
| Microsoft `dotnet-install` script called locally in the workflow | Script `v2026.05.19`, as embedded by `setup-dotnet` `v5.3.0` | MIT | Official maintained installer script used by the selected action. | Reimplementing download, proxy, retry, path, and runner integration in repository YAML adds local supply-chain code without closing another OpenBot boundary. | Reject as a local workflow implementation while the pinned first-party action is viable. |
| Windows container build | `.NET SDK 10.0.400` Windows container family | MIT plus base-image terms | Microsoft-maintained images can pin a manifest, but require Windows container availability and still do not exercise the host service environment. | Useful for later hermetic packaging, but broader and slower than the first source-build gate and does not replace native SCM evidence. | Defer until release packaging has a reviewed container and base-image update policy. |
| .NET SDK and runtime line | [SDK `10.0.400`, runtime `10.0.11`](https://github.com/dotnet/core/blob/main/release-notes/10.0/10.0.11/10.0.11.md) | MIT | Current .NET 10 LTS servicing release on 2026-09-04; upstream metadata marks the release as security-bearing and supported through 2028-11-14. | Matches the selected `10.0.11` Windows Service package. An exact `global.json` with roll-forward disabled prevents feature-band or prerelease drift. | Select for the first host lane. Security servicing still requires a new reviewed pin and regenerated lock. |
| NuGet lock files | .NET SDK `10.0.400` locked restore contract | MIT tooling; package-specific licenses | Built into the SDK; lock files bind exact transitive versions and content hashes. | `dotnet restore --locked-mode` fails when a project or feed would resolve a different graph. This complements, but does not replace, package signature and provenance review. | Select. Every committed project must enable lock generation and CI must restore only in locked mode. |

## Reuse decision

- Selected option: open build contract plus a released first-party CI adapter.
- Selected upstream or standard: `actions/setup-dotnet` `v5.3.0` at
  `9a946fdbd5fb07b82b2f5a4466058b876ab72bb2`, .NET SDK `10.0.400` / runtime `10.0.11`, an exact
  `global.json`, NuGet package locks, and the existing explicit `windows-2025` x64 hosted lane.
- Why this is the first viable option: It uses the official SDK installer integration while keeping
  the executable action, compiler, architecture, dependency graph, and restore mode explicit.
  Preinstalled SDK selection drifts, a repository-owned install script duplicates the selected
  action, and a Windows container is broader without proving SCM behavior.
- Exact OpenBot-specific gap: Add the minimal project and solution layout, exact SDK and package
  locks, a full-SHA-pinned Windows build job, local workflow-policy checks, bounded contract tests,
  and an artifact-inventory assertion that does not upload or claim support.
- Upgrade, replacement, or exit plan: Review each SDK servicing update and action release, replace
  the exact pins and regenerated lock in one focused change, and retain project-local build commands
  so the action can be replaced without changing the host contract.
- Failure behavior when the upstream is missing, incompatible, or compromised: Restore or build
  fails. CI must not use an image-preinstalled SDK, floating action tag, unlocked package graph,
  prerelease compiler, cached output, or previous binary as a fallback.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: none. The action executes at an immutable commit; the SDK and NuGet
  packages are consumed as reviewed tools or binary dependencies.
- Required copyright or license notice location: Record runtime package licenses in
  `THIRD_PARTY_NOTICES.md` and the future release SBOM when the host source first references them.
  CI-only `actions/setup-dotnet` remains recorded in the reuse ledger and research artifact.

## Verification plan

- Automated tests: A repository policy test asserts the explicit Windows runner, full action SHA,
  exact SDK/global.json, locked restore, no upload, and build/test/publish order. Pure host tests run
  without SCM; publish targets `win-x64`, self-contained and single-file, then checks an allowlisted
  artifact inventory.
- Negative and fail-closed tests: Changed/missing lock, floating action or SDK, prerelease
  roll-forward, `continue-on-error`, artifact upload, framework-dependent output, wrong RID, or extra
  publish files fail locally or in CI.
- Platforms and devices: The first remote build target is GitHub-hosted `windows-2025` x64. The job
  must print SDK/OS information. This is build evidence only; controlled Windows x64 service and ACL
  tests remain separate, and Windows arm64 remains unclaimed.
- User-visible documentation and translations: Keep the English and Simplified Chinese execution
  plan, research index, reuse ledger, and future operator guide aligned.
- Support level that the evidence permits: Accepted design until the job is committed; hosted build
  evidence only after an authorized push runs it. Neither state permits a Windows service support
  claim.

## Unresolved questions

- Authenticode, timestamping, MSI technology, installer privileges, package provenance, and binary
  publication remain separate reviews. This lane intentionally uploads nothing.
- GitHub-hosted images are mutable even with an explicit label. A release build will need stronger
  runner-image and artifact provenance before it can produce a distributable binary.
