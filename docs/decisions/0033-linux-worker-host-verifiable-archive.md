# ADR-0033: Linux Worker Host releases use a verifiable runtime archive

- Status: Accepted
- Date: 2026-09-04

## Context

The Linux Worker Host now has explicit service and credential profiles, but there is no immutable
artifact that an operator can verify, install, upgrade, or roll back. Copying a workspace or
running against an arbitrary system Node would make dependency and runtime identity ambiguous.

The reviewed alternatives and exact pins are recorded in
[Linux Worker Host verifiable archive research](../research/linux-worker-host-archive.md).

## Upstream review

- Official Node `v22.22.2` publishes signed checksums and exact Linux x64/arm64 runtime archives.
- `@vercel/ncc` `0.45.0` has current release and platform test evidence and emits bundle license and
  stats files; its documented ESM and multi-output edge cases require an OpenBot-specific gate.
- Node SEA remains stability 1.1 with a Linux arm64 container caveat; `vercel/pkg` is archived.
- npm `10.9.8` already emits SPDX 2.3, while `actions/attest` `v4.2.2` provides Sigstore-backed
  provenance only when the release workflow has the required eligibility and authority.
- GNU tar 1.35 documents the selected reproducibility flags. XZ explicitly warns that compressed
  bytes can differ across versions/builds and threading modes, so the release job must pin the
  Ubuntu 24.04 package baseline, force single-thread encoding, and compare two same-job builds.

## Reuse decision

Use the released ncc build dependency, the official Node runtime artifact, the pinned npm SBOM
command, and the GitHub attestation service. Implement only the validation, production dependency
projection, canonical staging, and release-policy gap specific to OpenBot. No experimental runtime
injection, archived packager, or second SBOM dependency is needed.

## Decision

1. The first Linux distribution format is an x64 or arm64 archive containing one ncc-built
   application entry, the exact official Node `v22.22.2` runtime, both systemd profiles, OpenBot and
   upstream notices, a production-only SPDX SBOM, a canonical file manifest, and SHA-256 checksums.
2. `@vercel/ncc` `0.45.0` is an exact build-only dependency. A release build rejects externals,
   unexpected assets, missing license output, or a bundle that does not pass the packaged-runtime
   smoke test.
3. Runtime inputs are local explicit paths. The builder validates the exact official x64/arm64
   SHA-256 before listing or extraction and never fetches a fallback. Archive paths, link targets,
   counts, and sizes are bounded and validated.
4. npm `10.9.8` generates SPDX 2.3 from a tested production-only projection of the existing lock.
   The build rejects test-only packages, missing reachable packages, ambiguous versions, or a
   dependency list that differs from the ncc bundle inventory.
5. Staged paths, file modes, manifest key/file order, ownership metadata, timestamps, and
   compression settings are fixed. Archive creation requires GNU tar 1.35 and xz 5.4.5, records the
   Ubuntu package revisions, and uses one xz thread. Two builds from the same inputs in one release
   job must be byte-identical before publication can be enabled.
6. Local and pull-request artifacts are visibly unsigned candidates. Only an authorized, tag-only
   trusted workflow may create a release and use `actions/attest` `v4.2.2` for archive/checksum and
   SBOM provenance. Its first slice accepts only bounded `node-v<SemVer>` tags whose commit is
   reachable from `main`, uses exact action commits and least privilege, uploads temporary review
   artifacts, and does not create a GitHub Release. Missing eligibility, OIDC, permissions,
   attestation, reproducibility, or upload is a release failure.
7. Checksums, SBOMs, and attestations do not grant platform support. Real Ubuntu 24.04 x64/arm64
   install, service lifecycle, keyring, upgrade, rollback, and recovery evidence remains required.
8. Tag builds run x64 on `ubuntu-24.04` and arm64 on GA `ubuntu-24.04-arm`. Before attestation, the
   bundled Node binary must start the bundled entry point, make a schema-valid `node.hello` to an
   isolated loopback gateway, declare the matching Linux architecture and no unconfigured
   capabilities, then terminate cleanly. This proves packaged startup on the hosted CPU only.

## Verification plan

- Unit-test hashes, archive path/link bounds, dependency closure, bundle inventory, canonical
  manifests, modes, checksums, and every fail-closed error.
- Require byte-identical rebuilds on the Ubuntu 24.04 release image and runtime smoke tests with the
  packaged Node executable.
- Require authorized tag provenance plus real x64 and arm64 install/service/rollback evidence before
  changing the Linux support claim.
- Repository policy tests must reject widened triggers/permissions, moving action references, a
  missing main-ancestry gate, omitted two-build comparison, or a release-publishing side effect.

## Consequences

- Operators can inspect exact files and dependencies before installation and can verify that bytes
  match a source-bound release workflow.
- Windows and macOS packaging can reuse the version, manifest, dependency, checksum, and provenance
  contracts while replacing only the platform runtime, service, signing, and installer layers.
- Release construction has more fail-closed gates and cannot fall back to a host Node, stale
  runtime, incomplete dependency inventory, or unsigned publication.
- The archive is not yet an installer. deb/rpm transactions and ownership are deliberately delayed
  until this simpler format has deterministic and real-host evidence.

## Source incorporation

No upstream source or tests are copied or substantially adapted. OpenBot uses published artifacts
and command contracts; exact releases, integrity values, licenses, and notice requirements are
recorded in the research note and reuse ledger.
