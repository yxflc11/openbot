# Research: Artifact read integrity

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pending
- Acceptance journey: when an authenticated Client requests a persisted screenshot, the Server
  serves bytes only if their size and SHA-256 still match the authoritative Artifact record.
- Security boundary: PostgreSQL metadata is Server-authoritative; the local artifact directory is
  operator-controlled but may suffer corruption or accidental replacement. This check detects
  changed bytes; it does not make an untrusted shared directory safe.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/opencontainers/image-spec digest verify content descriptor integrity`
  - `site:github.com/containerd/containerd content expected digest verify`
  - `site:github.com/minio/minio checksum reader integrity`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0018, `FileArtifactStorage`,
  authenticated Artifact HTTP delivery, and the persisted `sizeBytes`/`sha256` columns.

## Candidate comparison

| Candidate | Exact release or commit | License | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- |
| OCI Image Specification descriptor | [`13cff549`](https://github.com/opencontainers/image-spec/blob/13cff54902ec9ad6320cbc487a685b66fcd67171/descriptor.md#verification) | Apache-2.0 | Requires size verification before digest verification and SHA-256 support before consuming referenced bytes | Adopt the verification order and fail-closed behavior |
| containerd content store | [current content CLI](https://github.com/containerd/containerd/blob/main/cmd/ctr/commands/content/content.go) | Apache-2.0 | Supports expected size and digest during content ingestion, but importing its Go store would replace OpenBot's bounded local adapter | Use as implementation evidence; do not add a service or copy code |
| MinIO checksum reader | [current checksum reader](https://github.com/minio/minio/blob/master/internal/hash/reader.go) | AGPL-3.0 | Mature streaming checksum behavior, but is unnecessary and license-incompatible as copied Server code | Do not copy or depend on it |
| Existing OpenBot metadata | ADR-0018 and current branch | MIT | Already stores exact byte length and SHA-256 next to an opaque random storage key | Reuse directly and add only the missing read-time comparison |

## Reuse decision

- Selected option: adopt the OCI descriptor verification invariant over existing OpenBot metadata.
- Exact OpenBot-specific gap: compare stored bytes to `sizeBytes` and SHA-256 after the authenticated
  lookup and before constructing the response.
- Failure behavior: return a generic Server error without serving corrupted bytes. Recovery and
  operator alerting remain separate work.
- Upgrade or exit plan: the same metadata contract can validate an S3-compatible object-store
  adapter later; no new dependency or public format is introduced.

## Source incorporation

- Source copied or substantially adapted: no.
- OpenBot uses Node.js `crypto` and its existing fields. Upstream behavior and licenses are recorded
  here and in the reuse ledger.

## Verification plan

- Automated tests: serve matching bytes, then reject both a wrong size and same-length changed bytes
  before delivery.
- Platforms and devices: deterministic Server-side byte verification on supported Node.js hosts.
- Support level: corruption detection at the authenticated read boundary, not storage attestation.

## Unresolved questions

- Add structured operator alerts, repair/quarantine workflows, periodic scrubbing, and an external
  object-store checksum contract before production-scale Artifact retention.
