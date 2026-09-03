# Research: Employee export review binding

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: After an authenticated Owner reviews an Employee export preview, download
  returns that exact package instance; if the Employee profile or publisher state changes, the old
  reviewed request fails and the Client asks the Owner to review a fresh preview.
- Security boundary: The Server remains authoritative for profile content and publisher state. A
  preview token identifies bytes but grants no authority, contains no secret, and cannot bypass
  export findings. Missing, malformed, weak, or stale preconditions fail closed. Preview and error
  responses must not be cached.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/kubernetes/kubernetes resourceVersion conflict optimistic concurrency v1.36.2`
  - `site:github.com/honojs/hono etag middleware If-None-Match If-Match`
- Standards and primary documentation queries:
  - `site:rfc-editor.org/rfc/rfc9110 If-Match strong comparison 412 Precondition Failed`
  - `site:rfc-editor.org/rfc/rfc6585 428 Precondition Required`
  - RFC 9110 sections 8.8.1, 8.8.3.2, 13.1.1, and 13.2: a strong validator changes with
    observable representation data; `If-Match` uses strong comparison and a false condition can
    return `412`;
  - RFC 6585 section 3: `428 Precondition Required` requires a conditional request, should explain
    how to retry, and must not be cached;
  - Kubernetes v1.36.2 `resourceVersion` and API concurrency documentation: clients treat versions
    as opaque, submit the version they read, and handle stale conflicts instead of overwriting;
  - Hono 4.13.5 ETag middleware source: it computes cache validators and evaluates
    `If-None-Match` for `304`; it does not implement the required `If-Match` review precondition.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `docs/research/employee-export-content-preview.md`;
  - `docs/research/employee-publisher-key-lifecycle.md`;
  - `docs/decisions/0025-reviewed-employee-import-activation.md`;
  - Employee/API specifications, package builder, Web download client, app tests, and
    `docs/OPEN_SOURCE_REUSE.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| HTTP conditional requests | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), especially sections 8.8 and 13 | IETF Trust | Internet Standard with defined strong/weak comparison and precondition ordering | `ETag` plus `If-Match` directly binds a request to reviewed representation bytes and defines `412` for a mismatch | Adopt the standard |
| Precondition Required | [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html), section 3 | IETF Trust | Standards-track status code with explicit cache requirement | Lets the export endpoint require review rather than silently serving a fresh package when `If-Match` is absent | Adopt `428` with an actionable response |
| Kubernetes optimistic concurrency | [`v1.36.2`](https://github.com/kubernetes/kubernetes/tree/v1.36.2), especially [`ObjectMeta.resourceVersion`](https://github.com/kubernetes/kubernetes/blob/v1.36.2/staging/src/k8s.io/apimachinery/pkg/apis/meta/v1/types.go) | Apache-2.0 | Maintained production API with extensive concurrency tests | Opaque read-return-submit semantics are a strong interaction precedent, but Kubernetes object storage and update APIs are not Employee export machinery | Adapt the opaque-token and explicit-refresh behavior |
| Hono ETag middleware | [`4.13.5` / `e2740d5a`](https://github.com/honojs/hono/blob/e2740d5a1bd0b4254e517e3af8b60789284bc7bd/src/middleware/etag/index.ts) | MIT | Maintained framework middleware with digest and `304` tests | Handles `If-None-Match` caching, not mandatory `If-Match`; applying it would not close the reviewed-download race | Do not use for this boundary |
| Existing OpenBot package builder and publisher | commits through `ee418e7` | MIT | Strict package schema, deterministic content build, Ed25519/DSSE publisher, blockers, quarantine, and tests | Already owns exact export content, but preview and download independently generate `packageId`, timestamp, checksum, and signed bytes | Reuse and add the missing snapshot adapter |

## Reuse decision

- Selected option: open standard plus a narrow adapter over existing OpenBot code.
- Selected upstream or standard: RFC 9110 `ETag`/`If-Match`, RFC 6585 `428`, and
  Kubernetes-style opaque reviewed-version interaction.
- Why this is the first viable option: HTTP already defines representation validators and stale
  request behavior. No dependency or second service is needed, and Hono's cache middleware does
  not implement the required precondition.
- Exact OpenBot-specific gap: prepare and verify the complete downloadable JSON once for preview,
  return its strong SHA-256 entity-tag value as an opaque review token together with the generated package id and time,
  then reconstruct the same candidate at download and serve it only when all three match.
- Upgrade, replacement, or exit plan: keep the adapter isolated at the export route. Replace it
  with an expiring Server-side export snapshot only if future non-deterministic packaging makes
  exact reconstruction impossible; preserve the HTTP precondition contract.
- Failure behavior when the upstream is missing, incompatible, or compromised: there is no
  upstream runtime. Missing review state returns `428`; malformed input returns `422`; changed
  content, signing key, or serialized envelope returns `412`; safety findings remain `422`.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no RFC, Kubernetes, or Hono source is copied. OpenBot adds a small
  strong-tag parser, export preparation helper, route preconditions, Client forwarding, and tests.
- Required copyright or license notice location: citations and license decisions are recorded here
  and in `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: preview returns `packageId`, `generatedAt`, and a 64-character strong entity-tag
  value; a matching download returns the exact same bytes, response `ETag`, and package metadata for
  unsigned and signed exports.
- Negative and fail-closed tests: missing `If-Match` returns `428`; weak/malformed tags or malformed
  snapshot parameters return `422`; stale content or publisher state returns `412`; a blocked
  package is never downloadable.
- Platforms and devices: pure HTTP/Server and browser Client behavior shared by all supported Web
  Clients and Worker Host platforms.
- User-visible documentation and translations: update English API/Employee/reuse docs and their
  Simplified Chinese counterparts; show a clear re-review message after a stale response.
- Support level that the evidence permits: exact reviewed-download binding within one current
  Server deployment; no durable export reservation, authenticated ownership transfer, or public
  package registry claim.

## Unresolved questions

- Review tokens are intentionally not persisted and do not survive changes in serialization or
  publisher configuration. A fresh preview is the safe recovery path.
- A future selectable-memory or executable-skill export will need its own immutable snapshot and
  consent model before joining this contract.
