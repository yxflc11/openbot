# Research: Linux Worker Host verifiable archive

- Status: Accepted
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: G3 in `docs/EXECUTION_PLAN.md`
- Acceptance journey: a release builder produces Linux x64 and arm64 Worker Host archives whose
  application, bundled runtime, service units, dependency inventory, file manifest, and checksums
  can be inspected before installation and tied back to the exact source revision.
- Security boundary: the archive is transport, not authority. The Server remains authoritative for
  enrollment, Node identity, revocation, routing, approvals, and audit. Build inputs are pinned and
  verified before extraction; archive creation is offline after inputs exist; provenance is emitted
  only by a trusted release workflow and must be verified by the consumer to add value.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries:
  - `vercel ncc release tests Node 22 Windows Linux license`
  - `vercel pkg archived latest release`
  - `CycloneDX npm SBOM release security tests`
  - `actions attest v4 release provenance SBOM`
  - `actions upload-artifact v7 direct upload Node 24 release tests issues`
  - `GitHub ubuntu-24.04-arm GA runner image inventory systemd xz transition issue`
- Standards and primary documentation queries:
  - `Node.js single executable application stability Linux arm64 caveat`
  - `Node.js v22.22.2 signed SHASUMS linux x64 arm64`
  - `npm 10 sbom SPDX package lock only omit dev`
  - `GitHub artifact attestations permissions verification public private repository`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0014, ADR-0020, ADR-0032,
  the cross-platform execution plan, the Linux service/keyring review, and the `GitHub contribution
  and CI surface` / `Node bootstrap identity` ledger coverage.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Node.js release archive | `v22.22.2` annotated tag target `2645dc73720b1b4f27c49f395d3c66025ce126cc`; official Linux x64 `.tar.xz` SHA-256 `88fd1ce767091fd8d4a99fdb2356e98c819f93f3b1f8663853a2dee9b438068a`; arm64 `e9e1930fd321a470e29bb68f30318bf58e3ecb4acb4f1533fb19c58328a091fe` | Node.js license plus bundled notices | Official release artifacts, signed checksum manifest, and Node release CI | Supplies a reviewed runtime without relying on a host-wide Node installation. Only the required executable and its upstream license/notices should enter the OpenBot archive | Select and verify the exact artifact hash before listing or extraction |
| GNU tar and XZ Utils | GNU tar `1.35`, official source SHA-256 `4d62ff37342ec7aed748535323930c7cf94acf71c3591882b26a7ea50f3edc16`; Ubuntu 24.04 amd64 currently `1.35+dfsg-3ubuntu0.4`. Ubuntu xz-utils reports upstream `5.4.5`, currently `5.6.1+really5.4.5-1ubuntu0.3` on amd64; upstream tag target `49053c0a649f4c8bd2b8d97ce915f401fbc0f3d9` | GPL-3.0-or-later; public-domain/LGPL/GPL mix | GNU tar documents exact reproducibility flags. Ubuntu maintains security-patched packages. The XZ manual warns output can vary across versions and builds, and single- versus multi-thread output differs | Select only on the Ubuntu 24.04 release job; require GNU tar 1.35 and xz 5.4.5, force one thread and fixed options, record the OS package revisions, and compare two same-job builds byte for byte |
| `@vercel/ncc` | `0.45.0` / `cb1f1f058bfa7de4cb63f2411e14a724e714e260`; npm integrity `sha512-8zPi1yO2mHpoKTD+e+Bf0ZT3e+sWHSOyGapm9s7b5R0gxJi3CiFTqmeQiMEyu6ejrz2s09M8JkEoUaTWjBJPQQ==` | MIT | Released 2026-08-13; release commit has successful Node 22 Linux, Node 24 Windows, Node 26 Linux, Dependabot, and Socket checks. Open issues include ESM/export and multi-output edge cases | Produces one deployable JS entry plus an upstream-generated license file and webpack stats. OpenBot must run a bundle smoke test and reject unexpected assets or externals | Select as an exact build-only dependency |
| Node.js Single Executable Applications | Node `v22.22.2` behavior reviewed; current documentation still marks SEA `Stability: 1.1` | Node.js license | Tested upstream on a bounded platform set | Creation remains subject to change, supports one embedded script, and documents a Linux arm64 container ELF hash-table caveat. It adds binary injection complexity without improving OpenBot's current service boundary | Reject for the first stable archive format; reconsider after the API stabilizes and both architectures pass native evidence |
| `vercel/pkg` | `5.8.1` / `5dc987b90ffd191263eb0202833dc382cea0d47d` | MIT | Repository archived; last push 2024-01-03 | A frozen runtime packager is not a viable new security-sensitive release dependency | Reject |
| npm native SBOM | npm CLI `10.9.8` / `dd3c80e9965d240957684e9951603cf22eaae74c`; npm integrity `sha512-fYwb6ODSmHkqrJQQaCxY3M2lPf/mpgC7ik0HSzzIwG5CGtabRp4bNqikatvCoT42b5INQSqudVH0R7yVmC9hVg==` | Artistic-2.0 | Released CLI with native SPDX 2.3 and CycloneDX support | Avoids another generator dependency. The monorepo workspace view currently includes Node test-only workspace links, so release code must create and validate a production-only lock projection before calling it | Select the existing pinned package-manager capability behind a tested projection adapter |
| CycloneDX npm CLI | `6.0.0` / `e16960691fc8e09f8df3bd2e0b3e3828f859ab94`; npm integrity `sha512-kpWjjV0j5y0mMHUB5dSx1hxweH8K2blSqkgdQ6eHgU7aClB4CcXGhbHtGY6WVHSo3A01Rt7WOLas/wQ1E+tBDg==` | Apache-2.0 | Active OWASP project; the release fixes workspace shell injection and adds regression tests | Strong npm-specific generator, but it adds another executable dependency and does not remove OpenBot's need to project the exact bundled production graph | Keep as fallback if native npm output proves insufficient |
| GitHub artifact attestation | `actions/attest` `v4.2.2` / `1e69f48acb82d1966a394da916b4c1698aa569d6` | MIT | Maintained GitHub action with signed immutable release | Binds archive/checksum subjects and SBOMs to workflow, repository, commit, and event through Sigstore. It requires OIDC and write permissions and is unavailable for private repositories outside Enterprise Cloud | Select for a tag-only trusted release workflow after repository eligibility and Owner publication authorization are confirmed |
| GitHub workflow artifact upload | `actions/upload-artifact` `v7.0.1` / `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | MIT | Signed release published 2026-04-10; Node 24 action with direct-file upload support and repository tests. Current issue `#811` reports download-action failures for some artifacts, so the first remote run must exercise retrieval | `archive: false` preserves the already-deterministic `.tar.xz` and sidecar bytes instead of wrapping them in a service ZIP. Workflow artifacts expire and are not a durable GitHub Release | Select only as temporary review transport; exact checksums and attestations remain authoritative, and durable release publication stays separately authorized |
| GitHub-hosted Ubuntu 24.04 arm64 runner | `actions/runner-images` inventory commit `c623f51349e6e669403715506fe7f4c63b14e08b`, image `20260823.101.1`, label `ubuntu-24.04-arm` | MIT plus installed-tool licenses and GitHub service terms | The official inventory records Ubuntu 24.04.4 arm64, systemd `255.4-1ubuntu8.17`, tar `1.35+dfsg-3ubuntu0.4`, xz-utils `5.6.1+really5.4.5-1ubuntu0.3`, and npm `10.9.8`. The label is GA; issue `actions/runner-images#14100` records the 2026 transition from Arm partner maintenance to GitHub | Lets the arm64 package execute on matching hosted CPU rather than being cross-built only. It remains an ephemeral VM without production service/keyring lifecycle evidence | Select for the arm64 tag-build job and packaged entry-point handshake smoke test; retain real-device gates |

## Reuse decision

- Selected option: released dependencies and platform artifacts plus narrow validation/projection
  adapters.
- Selected upstream or standard: Node.js `v22.22.2` archives, `@vercel/ncc` `0.45.0`, npm SBOM
  `10.9.8`, SPDX 2.3 output, GNU tar 1.35, Ubuntu's security-patched xz 5.4.5 line, and
  `actions/attest` `v4.2.2` plus `actions/upload-artifact` `v7.0.1` for authorized tag builds.
- Why this is the first viable option: it keeps an ordinary upstream Node executable, isolates the
  application into one auditable bundle, reuses an already-selected package-manager SBOM command,
  and defers networked signing to the release boundary. No experimental executable injection or
  archived packager is required.
- Exact OpenBot-specific gap: validate runtime filenames and hashes, reject unsafe archive entries,
  project only the Node production dependency closure, check bundle stats/externals, stage fixed
  paths and modes, emit a canonical file manifest and checksums, and make archive creation
  reproducible from explicit local inputs. A tag workflow must also validate bounded SemVer, require
  the tagged commit to be reachable from `main`, grant only read/OIDC/attestation permissions, attest
  both provenance and the embedded SBOM, execute the packaged entry point on a matching x64/arm64
  hosted CPU, and stop before any GitHub Release mutation.
- Upgrade, replacement, or exit plan: each Node, ncc, npm, or attestation update repeats source,
  release, test, issue, platform, integrity, and license review. ncc can be replaced by another
  bundler because the archive contract is bundle/runtime/manifest based rather than ncc-specific.
- Failure behavior when the upstream is missing, incompatible, or compromised: missing tools,
  wrong versions or hashes, unexpected archive entries, bundle externals/assets, dependency-graph
  drift, non-canonical manifests, non-reproducible output, ineligible tags/commits, missing OIDC,
  failed attestation, or failed upload stop the build. They never download a fallback, reuse a stale
  artifact, skip provenance, create a GitHub Release, or produce a release-looking unsigned archive.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: OpenBot invokes published command contracts and extracts the
  reviewed official Node artifact. No ncc, npm, Node, pkg, CycloneDX, attest, or upload-artifact
  source is copied.
- Required copyright or license notice location: the archive carries the OpenBot license, ncc's
  generated dependency license report, the Node distribution's license/notices, and a generated
  dependency inventory. Repository pins and licenses are recorded here and in
  `docs/OPEN_SOURCE_REUSE.md`.

## Verification plan

- Automated tests: exact platform/hash table, safe runtime archive listing, production dependency
  closure, stable SPDX semantics, allowed ncc output, canonical manifest order, fixed modes,
  checksum verification, exact GNU tar/xz version gates, fixed archive arguments, compressed-stream
  integrity, and byte-identical repeat builds inside one release job.
- Negative and fail-closed tests: wrong hash or architecture, path traversal, absolute paths,
  symlink escapes, duplicate entries, oversized files/counts, unexpected ncc assets/externals,
  test-only dependency leakage, tool-version drift, changed staged bytes, malformed/movable tag
  inputs, a commit outside `main`, broadened permissions, changed action pins, and unavailable signer.
- Packaged-runtime smoke test: on the matching hosted architecture, start the bundled application
  using its bundled Node binary and an isolated loopback WebSocket gateway; validate the bounded
  `node.hello` against the protocol schema, declared Linux architecture, fixed smoke identity, empty
  Provider set, and graceful termination. A timeout, early exit, extra capability, or malformed hello
  fails the release job.
- Platforms and devices: build both archives on the pinned Ubuntu 24.04 release image; execute and
  install the x64 archive on real Ubuntu 24.04 x64 and the arm64 archive on real Ubuntu 24.04 arm64.
  Cross-arch construction alone is not runtime evidence.
- User-visible documentation and translations: document verification, contents, unsigned local
  candidate naming, install/upgrade/rollback boundaries, and the difference between checksums and
  signed provenance in English and Simplified Chinese.
- Support level that the evidence permits: locally verified archive candidate only until an
  authorized tag workflow publishes attested outputs and both architectures pass real-host
  lifecycle evidence.

## Implementation verification

- On 2026-09-04, the focused archive checks passed 11 tests covering the pinned inputs, production
  dependency projection, SPDX canonicalization, ncc output boundary, manifests, checksums, exact
  Ubuntu/tar/xz gates, deterministic arguments, candidate revalidation, and fail-closed drift.
- The x64 candidate from source commit `9644451b6014620a6b7e6b2568d056046ae2c1c2` was packed twice
  inside official Ubuntu 24.04 image manifest
  `sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517`, selected as
  `linux/amd64` on an Apple-hosted Docker engine. Both runs used Ubuntu package revisions
  `tar=1.35+dfsg-3ubuntu0.4` and `xz-utils=5.6.1+really5.4.5-1ubuntu0.3`.
- The two 29,155,296-byte archives, build metadata files, and checksum files were byte-identical.
  The archive SHA-256 was `2b83c61eb9a8b8141f130ce3e3dc1568ffd71a51071dc4d218811f997bc497f5`;
  `xz --test` and the sidecar checksum verification passed.
- This proves the named packaging path under emulation only. It does not prove a native x64 host,
  arm64 output, systemd lifecycle, Secret Service behavior, installer transaction, provenance, or
  Linux support.

## Remote eligibility and publication boundary

- A read-only `gh repo view` query on 2026-09-04 reported `yxflc11/openbot` as `PUBLIC` with default
  branch `main`. GitHub's current primary documentation permits attestations for public repositories
  on current plans and requires `contents: read`, `id-token: write`, and `attestations: write`.
- The first workflow slice is deliberately dormant until an Owner explicitly pushes a matching
  `node-v<SemVer>` tag. It builds and attests review artifacts but does not create a GitHub Release,
  modify a tag, push a package, or mark Linux supported.
- Each architecture must build twice in one Ubuntu 24.04 job and compare archive plus sidecars before
  attestation. x64 uses `ubuntu-24.04`; arm64 uses GA `ubuntu-24.04-arm`. Each job must execute the
  packaged runtime on its matching CPU before compression. The tagged commit must be an ancestor of
  `origin/main`; this rejects provenance for an arbitrary side-branch tag even if a writer can create
  it.
- `actions/upload-artifact` is temporary transport only. Exact file SHA-256 and verified provenance
  are the identity; retrieval and `gh attestation verify --repo yxflc11/openbot` remain mandatory
  observation steps after an authorized first tag.

## Unresolved questions

- The public-repository eligibility check is satisfied, but the workflow remains unobserved until an
  Owner authorizes a tag push. No workflow should silently skip provenance and still upload assets.
- deb/rpm ownership, post-install transactions, and rollback remain a later G3 review after the
  archive contract is implemented and exercised.
- Signing checksums proves origin and integrity, not safety. Vulnerability scanning and real-device
  tests remain independent release gates.
