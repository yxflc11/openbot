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
  - `site:github.com/npm/ssri browser integrity check sha256`
  - `site:github.com/openclaw/openclaw sha256 verify download checksum`
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
  - W3C Web Cryptography Level 2 `SubtleCrypto.digest`: hashes an exact copied `BufferSource` and
    supports SHA-256 without a third-party runtime;
  - npm `ssri` v14.0.0 and its tests: maintained Node.js integrity generation/checking with an ISC
    license, but not a browser-first API and unnecessary for one fixed hex SHA-256 comparison;
  - OpenClaw/ClawHub issue #2378 and OpenClaw v2026.7.1 release assets: a real mismatch occurred
    when a published digest described a tarball while a legacy endpoint returned ZIP bytes,
    reinforcing that the Client must hash the bytes it actually received.
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
| Web Cryptography | [Web Cryptography Level 2](https://www.w3.org/TR/WebCryptoAPI/), especially `SubtleCrypto.digest` and SHA-256 | W3C Software and Document License | Browser standard with byte-defined asynchronous digest semantics | Already available in OpenBot's localhost secure context and required HTTPS remote context; hashes the received `Blob` before any download side effect | Adopt the native API |
| npm `ssri` | [`v14.0.0` / `b70a4da`](https://github.com/npm/ssri/tree/v14.0.0) | ISC | Maintained, tested integrity parser/checker used by npm | Strong Node.js option for SRI strings and streams, but adds `minipass` and a second integrity format to a browser flow that has one fixed SHA-256 hex token | Do not add the dependency |
| OpenClaw release checksum practice | [`v2026.7.1`](https://github.com/openclaw/openclaw/releases/tag/v2026.7.1) and ClawHub [issue #2378](https://github.com/openclaw/clawhub/issues/2378) | MIT | Signed release workflow publishes per-asset SHA-256 evidence; issue records a concrete wrong-artifact digest mismatch | Confirms that checking only metadata is insufficient when endpoint bytes differ | Adapt the hash-the-received-artifact invariant |
| Existing OpenBot package builder and publisher | commits through `c9680bc` | MIT | Strict package schema, deterministic content build, Ed25519/DSSE publisher, blockers, quarantine, and tests | Already owns exact export content and reviewed-download preconditions; the browser still needs to verify the actual bytes it receives | Reuse and add the missing Client verification adapter |

## Reuse decision

- Selected option: open standard plus a narrow adapter over existing OpenBot code.
- Selected upstream or standard: RFC 9110 `ETag`/`If-Match`, RFC 6585 `428`,
  Kubernetes-style opaque reviewed-version interaction, and W3C Web Crypto SHA-256 over received
  bytes.
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
  strong-tag parser, export preparation helper, route preconditions, native Web Crypto digest
  comparison, Client forwarding, and tests. No W3C, npm, or OpenClaw source is copied.
- Required copyright or license notice location: citations and license decisions are recorded here
  and in `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: preview returns `packageId`, `generatedAt`, and a 64-character strong entity-tag
  value; a matching download returns the exact same bytes, response `ETag`, and package metadata for
  unsigned and signed exports. The Web Client checks the response tag and SHA-256 of the received
  `Blob` before creating a browser download.
- Negative and fail-closed tests: missing `If-Match` returns `428`; weak/malformed tags or malformed
  snapshot parameters return `422`; stale content or publisher state returns `412`; response-tag
  or received-byte mismatch stops before browser download; a blocked package is never downloadable.
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
