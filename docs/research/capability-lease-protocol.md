# Research: capability lease protocol (DEV-001 H2)

- Status: Proposed (design draft; **CONVERGE** on encoding/alg; design gate is **not** closed until
  maintainers Accept; implementation not started)
- Date: 2026-09-11
- Owner: @yxflc11
- Related issue: DEV-001 H2 / ROADMAP approval lease milestone
- Acceptance journey: after an Owner approves one pending Server-classified action, the Server
  issues a short-TTL, single-use capability lease bound to exact run/node/provider/action/target and
  `targetFingerprint`; the Node may commit the frozen `PreparedAction` only after Server-side
  consume succeeds; restart, revoke, concurrency, and replay fail closed; real side-effecting
  Providers remain disabled until this protocol is implemented and tested.
- Security boundary: the Server remains the only issuer, consumer authority, and revocation
  authority for leases. Nodes and Providers remain untrusted. An Owner decision notification alone
  is not authorization to cause a side effect. Local Provider evidence checks (for example
  screenshot equality) cannot substitute for a Server lease. This design does not enable Providers,
  grant Node proof-of-possession identity, or replace exclusive human control leases.

## Current OpenBot evidence (base `09392b301dda906b6be2c24e1926e15b252c16f1`)

Surveyed paths (read-only; no runtime change in this docs slice):

| Area | Evidence | Gap relative to H2 |
| --- | --- | --- |
| Protocol `approval.resolved` | `packages/protocol/src/index.ts` `approvalResolvedSchema`: `type`, `protocolVersion`, `nodeId`, `runId`, `requestId`, `decision` (`approved`/`rejected`/`expired`), `decidedAt` only | No lease claims, signature, TTL, fingerprint, or consume token |
| Server delivery | `apps/server/src/node-registry.ts` `resolveApproval` builds and sends that message when the socket is open and the Run is active | Delivery is a notification, not a capability |
| Dispatcher | `apps/server/src/run-dispatcher.ts` `resolveApproval` calls `nodes.resolveApproval`; if `approved` and undelivered, fails the Run as `node_disconnected` | No lease issuance or consume path |
| Node client | `apps/node/src/client.ts` resumes `#approvalWaiters` when `requestId`/`runId` match; returns `{ approvalId, status }` | Does not revalidate `targetFingerprint`; treats decision as sufficient to resume |
| Fingerprint domain | `packages/domain/src/index.ts` `Approval.targetFingerprint`; DB `packages/db/src/schema.ts` `target_fingerprint` length-64 check | Persisted and audited, not a runtime gate after approval |
| Fingerprint computation | `apps/server/src/postgres-store.ts` `approvalTargetFingerprint`: `sha256(action || "\\0" || target || "\\0" || JSON.stringify(beforeState))` on `requestApproval` | Never recomputed or compared at resolve, Node resume, or Provider commit |
| Owner decision | `decideApproval` conditionally updates pending→approved/rejected/expired once; event payload repeats stored fingerprint | Still no signed lease |
| Prepare / approve / commit | `packages/provider-sdk/src/provider.ts` documents frozen `PreparedAction` and optional `prepare`/`commit`; Docker reviewed click freezes `beforeState` then locally rechecks screenshot/URL before one `/click` (`providers/docker/src/reviewed-click.ts`) | Local evidence binding only; `docs/CONTROLLED_BROWSER.md` explicitly states no signed single-use execution lease |
| Policy / disclosure | ADR-0028; `docs/API.md` approval section; `docs/ARCHITECTURE.md`; `docs/reviews/DEV-001.md` H2; `docs/ROADMAP.md`; `docs/SECURITY.md` attack scenarios (repeat consume, post-approval drift, restart of expired approval) | Contract already forbids enabling real side-effect Providers until a lease protocol exists |

## Search evidence

- Search date: 2026-09-11 (jose encoding selection and Ed25519 alg pin re-verified the same day)
- Standards and primary documentation queries:
  - [RFC 9449 OAuth 2.0 DPoP](https://datatracker.ietf.org/doc/rfc9449/) (Proposed Standard, September 2023): sender-constrained tokens; proof JWT claims `jti`, `iat`, replay resistance
  - [RFC 9396 OAuth 2.0 Rich Authorization Requests](https://datatracker.ietf.org/doc/rfc9396/) (Proposed Standard, May 2023): `authorization_details` for fine-grained action/resource binding
  - [RFC 7515 / 7519](https://datatracker.ietf.org/doc/html/rfc7519) JWS/JWT Compact Serialization as the wire encoding
  - [RFC 9864 family / jose support](https://github.com/panva/jose/issues/262): fully-specified Edwards-curve DSA JWS `alg` values include **`EdDSA`** and **`Ed25519`**
  - [SPIFFE overview](https://spiffe.io/docs/latest/spiffe-about/overview/) and SPIRE releases: workload SVIDs (X.509/JWT)
  - [PASETO draft-paragon-paseto-rfc-01](https://datatracker.ietf.org/doc/html/draft-paragon-paseto-rfc-01) / [paseto-standard](https://github.com/paseto-standard/paseto-rfc/blob/master/paseto.md): v4.local / v4.public
  - [Branca specification](https://github.com/tuupola/branca-spec) (XChaCha20-Poly1305 AEAD tokens)
  - Google NDSS 2014 macaroons paper and [libmacaroons](https://github.com/rescrv/libmacaroons)
  - Node.js `crypto` (`generateKeyPairSync('ed25519')`, `sign`/`verify`) on engines `^22.22.2 || ^24.15.0 || >=26.0.0`
  - [jose `JWTVerifyOptions`](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md): `algorithms?: string[]` fixed allowlist; `issuer` / `audience` / `typ` / `requiredClaims`; unsecured JWTs (`alg: "none"`) never accepted. Sign path sets concrete `alg` via `setProtectedHeader({ alg })`.
- Package and release queries (npm registry and GitHub tags fetched 2026-09-11):
  - `paseto@4.0.1` → GitHub tag commit `5c7812e818c1d50a47ce3baf107614c42ae16c43` (MIT, panva/paseto)
  - **`jose@6.2.12`** → annotated tag object `99eaf5ed086cbee3fe49fcdf68681f68b1f122f7` peels to real commit **`505a55b8f73536082367b2614cb77e927ba96ec1`** (MIT, panva/jose; **no runtime dependencies** on npm). Verified with `gh` tag API + local `npm view` / installed package probe.
  - `macaroons.js@0.3.9` → `0a0361174a07` (Apache-2.0)
  - `branca@0.5.0` → `498bb5f76316` (MIT)
  - SPIRE `v1.15.3` (published 2026-08-21) peeled commit `2f7861ae3923caf1f57eb087fc2928d58c0fb1d2` (Apache-2.0)
  - libmacaroons tip observed `ca0211d8633c` (2021-02-19; BSD-3-Clause; no recent release tags)
- **jose Node support matrix** ([panva/jose#262](https://github.com/panva/jose/issues/262)): Edwards-curve DSA JWS algs **`EdDSA`** and **`Ed25519`** are both listed as supported. Local probe on Node `v22.22.2` with installed `jose@6.2.12`:
  - `crypto.generateKeyPairSync('ed25519')` succeeds (native Ed25519).
  - `SignJWT` with `setProtectedHeader({ alg: 'Ed25519' })` emits protected-header `alg: "Ed25519"` and verifies under `jwtVerify(..., { algorithms: ['Ed25519'] })`.
  - Cross-allowlist is exact: an `Ed25519` token is rejected by `{ algorithms: ['EdDSA'] }` (`ERR_JOSE_ALG_NOT_ALLOWED`) and vice versa.
  - **Design pin:** prefer the fully-specified **`Ed25519`** JWS alg identifier; freeze the allowlist to that single value; require exact protected-header match. Document that `EdDSA` is a rejected alternate unless a future signing-API constraint forces it — in which case freeze to whichever one `SignJWT` emits and never accept both.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0028; DEV-001 review H2;
  `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/CONTROLLED_BROWSER.md`,
  `docs/ROADMAP.md`, `docs/research/dev-001-short-term-hardening.md`,
  `docs/research/controlled-browser-click.md`, `docs/OPEN_SOURCE_REUSE.md`, Employee DSSE/Ed25519
  keyring as **separate** signing prior art (must stay domain-separated from lease keys).
- **OPEN_SOURCE_REUSE / AGENTS order:** prefer maintained released dependency for token encode/verify
  when license/maintenance/fit are good; OpenBot still owns lease-store / race / WS protocol gap.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| RFC 9449 DPoP claim patterns (`jti`/`iat`/`exp`/unique proof) | RFC 9449 (2023-09) | IETF Trust | IETF Proposed Standard | Excellent guidance for single-use identifiers and replay resistance; full DPoP assumes HTTP resource access + client key proofs OpenBot Node WS protocol and H3 PoP identity do not yet provide | Adopt claim/semantics ideas only; do not implement HTTP DPoP headers now |
| RFC 9396 RAR `authorization_details` | RFC 9396 (2023-05) | IETF Trust | IETF Proposed Standard | Matches fine-grained action/target binding language; OpenBot already has Server catalog + frozen `PreparedAction`, not an OAuth AS/RS split | Adopt binding vocabulary; do not add OAuth AS |
| SPIFFE SVID + SPIRE | SPIRE `v1.15.3` / `2f7861ae3923caf1f57eb087fc2928d58c0fb1d2` | Apache-2.0 | Active release train, broad tests | Strong workload identity plane, but introduces agents, attestation, and a second identity authority before OpenBot Node PoP (H3) | Do not add now; revisit with H3 |
| PASETO v4 (`paseto` npm) | `4.0.1` / `5c7812e818c1d50a47ce3baf107614c42ae16c43` | MIT | Maintained by panva; versioned suites | Good alternate encoding; claim schema and Server consume semantics would still be OpenBot-specific | Defer; jose+JWS Compact JWT selected instead for broader Node tooling and fixed-alg allowlist |
| **`jose` JWS Compact JWT** | **`6.2.12` / tag object `99eaf5ed…` → commit `505a55b8f73536082367b2614cb77e927ba96ec1`** | **MIT; no runtime deps** | Very active; extensive tests | **Selected for encode/verify.** `jwtVerify` supports fixed `algorithms` allowlist + `issuer`/`audience`/`typ`/`requiredClaims`. Ed25519 keys via Node `crypto`; pin `alg` to `Ed25519`. Does **not** own PostgreSQL single-consume/revoke — and that is OpenBot's gap, **not** a reason to reject jose for signature encoding | **SELECT** for JWS Compact JWT encode/verify (CONVERGE; stay Proposed until Accept) |
| Macaroons (`macaroons.js` / libmacaroons) | JS `0.3.9` / `0a0361174a07`; C tip `ca0211d8633c` (2021) | Apache-2.0; BSD-3-Clause | JS package stale; C library quiet | Caveats fit attenuation, but third-party discharge and decentralized delegation exceed the single-Server lease; JS maintenance risk | Reject for v1 |
| Branca | Spec tip `c8b0ba5e2262` (2025-05-06); JS `0.5.0` / `498bb5f76316` | MIT | Spec active; JS small | Symmetric AEAD opaque tokens lack structured public claims for Node-side binding checks without Server round-trips already required for consume | Reject as primary format |
| Local HMAC-SHA256 opaque (Node `crypto` only) | Node engines floor `22.22.2` | Node.js license | Platform primitive | Viable seal, but forces Node to treat token as opaque and loses maintained JWT claim/allowlist helpers; AGENTS order prefers maintained library when fit is good | Reject as primary encoding (retain Node `crypto` only for Ed25519 keygen / PEM import helpers as needed) |

## Reuse decision

- **Selected encoding library:** `jose@6.2.12` (MIT; commit `505a55b8f73536082367b2614cb77e927ba96ec1`;
  no runtime dependencies) for **JWS Compact Serialization JWT** create (`SignJWT`) and verify
  (`jwtVerify`).
- **Selected algorithm:** Server Ed25519 signing keys; protected-header **`alg: "Ed25519"`**
  (fully-specified). Verify allowlist is exactly `algorithms: ['Ed25519']`. Reject `EdDSA`,
  `none`, HS*, RS*, ES*, and any other alg. If a future jose/SignJWT constraint ever forced
  emitting `EdDSA` instead, freeze to that single value and require exact match — never accept
  both.
- **Selected standards for claim/binding semantics:** RFC 9449 (single-use/`jti`/time-bound ideas)
  and RFC 9396 (fine-grained authorization detail binding). Do not add an OAuth AS or HTTP DPoP.
- **Architecture (encode vs store):**
  1. **Server** holds the Ed25519 **private** key; issues signed leases only after Owner approve.
  2. **Node** holds/pins Server **public** keys only (by trusted `kid`); verifies JWS locally for
     binding UX / fail-closed before round-trip; **never** receives private key material.
  3. **Server** remains the sole **atomic consume** authority in **PostgreSQL** (conditional
     `issued → consumed`). jose validates signature and registered claims; OpenBot owns durable
     lease rows, revoke/cancel races, fingerprint equality, and Provider gating.
- **Rewrite of prior jose rejection:** Earlier drafts deferred jose for “dependency / key-lifecycle /
  lease-store fit.” That is revised under CONVERGE + OPEN_SOURCE_REUSE/AGENTS order:
  - Prefer the maintained library for **signature encoding/verify**.
  - **“Library does not provide OpenBot lease store semantics” is not a reason to reject jose for
    signature encoding.** Lease store / race / WS protocol remain a documented OpenBot-specific gap
    implemented beside jose, not instead of it.
  - Key lifecycle (secret-store load, domain separation, kid pin/rotation, startup fail-closed)
    remains OpenBot-owned configuration around jose.
  - jose is still **not** rejected for algorithm agility: fixed `algorithms` allowlists are first-class.
- Why not SPIRE / OAuth / macaroons / Branca / PASETO for v1: authority surface, maintenance, or
  weaker fit vs jose+JWT Compact with pinned `Ed25519` (see comparison table).
- Exact OpenBot-specific gap (still local): protocol fields, durable lease rows, atomic
  issue-on-approve, Node pre-commit consume, fingerprint recompute, revoke/cancel vs consume races,
  restart-safe status, `kid` pin/rotation policy, rejection of remote key headers, protocol-version
  downgrade rejection, and malicious/replay tests. Real side-effect Providers stay disabled until
  that coding slice lands **after design Accept**.
- Upgrade, replacement, or exit plan: if jose becomes unmaintained or alg matrix regresses, fall
  back to Node `crypto` Ed25519 over the same claim schema, or reconsider PASETO v4.public; if Node
  PoP (H3) lands, reconsider DPoP-like proofs bound to Node keys; SPIRE only if OpenBot operates a
  workload identity plane.
- Failure behavior: missing lease signing key or empty trusted public-key pin set fails Server/Node
  startup closed when the lease path is present. Invalid, expired, revoked, wrong-`kid`, wrong-`alg`,
  or already-consumed leases deny commit. Absence of a lease must never fall back to bare
  `approval.resolved`.

### Encoding and algorithm pin (CONVERGE)

| Item | Decision |
| --- | --- |
| Wire format | JWS Compact Serialization JWT (`header.payload.signature`, three base64url segments) |
| Library | `jose@6.2.12` / `505a55b8f73536082367b2614cb77e927ba96ec1` |
| Sign API | `SignJWT` + `setProtectedHeader({ alg: 'Ed25519', typ: 'JWT', kid })` |
| Verify API | `jwtVerify` with `algorithms: ['Ed25519']`, `issuer`, `audience`, `typ: 'JWT'`, `requiredClaims` |
| Exact header `alg` | **`Ed25519`** (preferred fully-specified). `EdDSA` rejected unless signing API forces it — then freeze that one and document the switch in the coding ADR |
| Key type | Server Ed25519 keypair via Node `crypto.generateKeyPairSync('ed25519')` (confirmed on Node 22) |
| Who verifies | Node (public only) + Server (public or private path) before consume; **consume row transition is Server/DB only** |

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: standards cited for claim and binding semantics only; no RFC text
  or jose/PASETO/macaroon/Branca source is vendored. jose docs and issue #262 were consulted for
  allowlist/alg matrix evidence. Runtime dependency addition is deferred to the coding slice after
  Accept (this PR is docs-only).
- Required copyright or license notice location: when the coding slice adds `jose`, record MIT in
  THIRD_PARTY_NOTICES / package lock as usual; for this design draft, research + OPEN_SOURCE_REUSE
  ledger citation is sufficient.

## Protocol design (contract for the coding slice)

### Fixed encoding: JWS Compact JWT + trusted `kid`

**Token shape**

- Serialization: JWS Compact JWT only. Reject any other JOSE shape (JSON Serialization, unsecured
  JWT, JWE) on issue and consume paths.
- Protected header (required): `{ alg: "Ed25519", typ: "JWT", kid: "<server-key-id>" }`.
- **Reject remote key material in headers:** ignore and **fail closed** on `jku`, `jwk`, `x5u`,
  `x5c`, or any header that would cause the verifier to fetch or trust keys from the token or a
  URL. Node and Server verifiers use **only** locally configured/pinned public keys keyed by `kid`.
  No remote JWKS fetch for capability leases.
- **Trusted `kid` + rotation:**
  - Server publishes/pins a finite set of known `kid` → public key mappings to Nodes (enrollment /
    config channel — not from the token).
  - Node accepts tokens only when `kid` is in the configured pin set and the signature verifies
    under that public key + `algorithms: ['Ed25519']`.
  - Rotation: Operator installs next keypair; Server mints only with current `kid`; prior public key
    remains in the verify pin set for a bounded window (≥ max lease TTL, Operator-documented);
    then prior `kid` is removed. Stolen/compromised `kid` is removed immediately (fail closed for
    new verifies with that kid).
  - Private keys never leave the Server secret store; never enter logs, channels, Employee packages,
    browsers, or Node disks.

**Token max length**

- Compact JWT string hard cap: **8192** UTF-8 bytes on the wire (WS frame / DB column / audit redaction
  boundary). Larger tokens fail closed at issue (do not emit) and at consume (deny). Claims must stay
  short identifiers/hashes — no screenshots, `beforeState` blobs, or channel payloads inside the JWT.

**Claims / fields**

| Claim / field | Required? | Notes |
| --- | --- | --- |
| `typ` (header) | yes | Must be `JWT` |
| `alg` (header) | yes | Must be exactly `Ed25519` |
| `kid` (header) | yes | Must match pinned Server key id |
| `iss` | yes | Fixed Server issuer string (config); `jwtVerify` issuer check |
| `aud` | yes | Fixed Node/lease audience string (config); `jwtVerify` audience check |
| `iat` / `nbf` / `exp` | yes | Server clock; short TTL (default cap **120s** interactive; never beyond approval `expiresAt`); reject `nbf` in the future beyond small skew policy if any — prefer Server time authoritative with `nbf ≤ now ≤ exp` |
| `jti` | yes | Unique per lease; equals or bijectively maps to durable `leaseId` (coding slice picks one canonical id and stores it) |
| `runId` | yes | Side-effect binding |
| `nodeId` | yes | Side-effect binding |
| `approvalId` | yes | Ties to Owner decision row |
| `providerId` | **required for side-effect** | Missing/empty/mismatch → issue fail-closed / consume deny |
| `action` | yes | Frozen action id/name |
| `target` | yes | Frozen target string (bounded length) |
| `targetFingerprint` | yes | 64-hex sha256 binding |
| `leaseId` | yes if distinct from `jti` | Durable row id presented on consume |
| `tokenUse` / `leaseType` | recommended | Constant e.g. `capability_lease` to prevent cross-token confusion with other JWTs |

Custom claims are registered in protocol Zod schemas; unknown critical headers must not be honored.
Do not put secrets, Owner session material, or Provider credentials in claims.

### Issuance (Server only) — atomic with Owner approve

**Atomic transaction (precise):** Owner `decideApproval` success with `approved` and lease creation
are one PostgreSQL transaction (or equivalent single atomic unit):

1. Preconditions checked in-txn: approval is `pending` and unexpired; Run is `waiting_approval`;
   lease signing key material is available; binding fields (including `providerId` per rules below)
   are complete; `protocolVersion` of the Node session is in the Server allowlist (see downgrade
   rules).
2. In the same transaction:
   - conditionally update approval `pending → approved` (exactly-once; conflict fails closed);
   - insert exactly one durable lease row: `leaseId` (UUID), `approvalId`, `runId`, `nodeId`,
     `providerId` (per binding rules), `action`, `target`, `targetFingerprint`, `status=issued`,
     `jti`, `kid`, `issuedAt`, `expiresAt` (short TTL: min of remaining approval TTL and hard cap,
     default cap **120s**; never longer than the approval `expiresAt`);
   - write audit events for both approval decision and lease issue.
3. Seal the JWS Compact JWT with Server Ed25519 private key (`SignJWT`, `alg: Ed25519`, pinned
   `kid`) **after** the durable row is inserted, still before commit of the surrounding unit of work
   that exposes the decision to the Node path. If sealing fails or token length exceeds the hard
   cap, the transaction rolls back: approval stays `pending` (or returns to prior state), **no**
   lease row remains, and **no** `approval.resolved` with lease is emitted.
4. Commit then emit extended `approval.resolved` (approved branch) including
   `{ leaseId, leaseToken, expiresAt, targetFingerprint, action, target, providerId, kid? }` plus
   today's decision fields. Rejected/expired branches must not include a lease and must not insert a
   lease row.

There must be **no** observable window where an approval is `approved` without a matching durable
`issued` lease (when the lease feature path is enabled), or a lease row without a committed
approval.

### Binding and `providerId` rules

A lease authorizes exactly one commit of one frozen action:

- Always bound: `runId` + `nodeId` + `approvalId` + `action` + `target` + `targetFingerprint`
- `providerId` (fail-closed; not casually optional):
  - **Required** for every side-effecting action lease (any Provider `commit`/click/write/path that
    can change external or durable state). Issue **must fail closed** (no approve+lease commit) if
    `providerId` is missing, empty, or not equal to the Server catalog / frozen `PreparedAction`
    Provider identity for that approval.
  - **Required** on consume: Node must present the same `providerId`; mismatch or omission → deny
    consume; no side effect.
  - **Optional only** for explicitly non-side-effect, non-commit probe paths if a future design
    ever issues leases for them **and** the Server catalog proves a single unambiguous Provider for
    that `nodeId`+`action`. Until such a path is specified, treat omission as **forbidden**.
  - Multi-Provider Nodes: `providerId` is always required; deriving it implicitly at consume time
    is forbidden.
- Node must recompute `sha256(action || "\\0" || target || "\\0" || JSON.stringify(beforeState))`
  from its frozen `PreparedAction` and refuse commit on mismatch before calling consume.

### Consume (one-time)

1. Before any side-effecting Provider `commit`/click/write, the Node:
   - verifies local JWS (`jwtVerify` public key for `kid`, `algorithms: ['Ed25519']`, iss/aud/typ/
     requiredClaims);
   - rejects `jku`/`jwk`/remote-key headers;
   - recomputes `targetFingerprint`;
   - sends `lease.consume` on the Node WebSocket with `leaseId`, `leaseToken`, `runId`,
     `providerId` (when required), and the recomputed `targetFingerprint`.
2. Server re-verifies token (same allowlist/pin rules), binding equality (including `providerId`
   rules), `status=issued`, `expiresAt > now` (Server clock), Node identity, and active Run
   assignment; then conditionally updates `issued → consumed` in one atomic statement.
3. Only after `lease.consume_result` success may the Node perform the side effect. Uncertain
   Provider results must not retry consume or commit automatically (preserve reviewed-click rule).

### Consume vs cancel/revoke races (who wins, idempotency, audit)

Lease terminal states of interest: `issued`, `consumed`, `revoked` (cancel/disconnect/reject/TTL
sweeper may map to `revoked` or `expired`; coding slice picks exact enum names but must preserve
these rules).

| Race | Winner | Loser behavior | Idempotency | Audit |
| --- | --- | --- | --- | --- |
| Concurrent `lease.consume` vs `lease.consume` | First successful conditional `issued → consumed` | Second gets deny (`already_consumed` or equivalent); **no** side-effect authorization | Repeat consume after `consumed` is **non-success**: return deny / already-consumed; never re-arms the lease | Both attempts recorded with `leaseId`, presenter `nodeId`, prior status, outcome |
| `lease.consume` vs cancel/revoke (Run cancel, Node disconnect/credential revoke, Owner reject race, Operator revoke) | First successful conditional transition from `issued` wins | If revoke wins first → consume deny; if consume wins first → revoke is a no-op on capability (lease already `consumed`); side effect may still be in flight — Run/Node teardown follows existing fail-closed policy and must not mint a replacement lease | Repeat revoke on already-`revoked`/`expired` is **idempotent success** for the revoke API; repeat revoke on `consumed` is idempotent no-op with audit note `already_consumed` | Every attempt logged; order of terminal status is visible in audit |
| Cancel/revoke vs TTL expiry sweeper | First to leave `issued` wins (`revoked` or `expired`) | Other path idempotent no-op | Sweeper must use conditional update, not blind overwrite of `consumed` | Sweeper denials/no-ops audited at debug/ops level; security-relevant consumes/revokes at audit level |
| Replay of `approval.resolved` or `leaseToken` after consume/revoke | N/A (token may still cryptographically verify) | Consume deny because row status ≠ `issued` | N/A | Replay attempts audited as deny |

**Invariant:** at most one successful consume per `leaseId`. Cancel/revoke never creates a new lease.
Post-consume crash before side effect does **not** resurrect the lease; a new Owner approval is
required.

### Restart, revoke, concurrency, replay (summary)

| Event | Required behavior |
| --- | --- |
| Server restart | Issued leases remain until TTL or revoke; consumed stay consumed; never re-mint without a new Owner decision; key pin set reloaded from secret store |
| Node disconnect / credential revoke | Revoke all `issued` leases for that `nodeId` (and fail related waiting Runs per existing policy) |
| Run cancel / terminal / member removal | Revoke `issued` leases for that `runId` |
| Owner reject / approval expiry | No lease on reject/expiry path; if an approve+lease txn raced and lost, no lease; if an issued lease exists for a racing reject, revoke it under the race table |
| Concurrent consume | Per race table; loser deny |
| Replay of `approval.resolved` or `leaseToken` after consume | Deny |
| Clock skew | Server time is authoritative; Nodes treat local timers as UX only |

### Client / protocol version downgrade rejection

- Lease-bearing `approval.resolved` and `lease.consume` / `lease.consume_result` messages are part of
  a **minimum protocol version** bump (exact literal chosen in the coding slice; today's base is
  protocol `0.9.0` literals in `packages/protocol`).
- Server must **not** emit lease fields to Nodes advertising an older `protocolVersion`.
- Node implementations that understand leases must **reject** approve-path messages that omit the
  lease when the negotiated protocol version requires it (no silent downgrade to bare decision).
- Server consume handler rejects tokens/messages from sessions whose negotiated version is below the
  lease minimum, even if the JWT cryptographically verifies.
- Unknown future fields: retain existing strict Zod unknown-field rejection on Node protocol
  messages; do not accept alternate encodings via "compatibility" shims.

### Key lifecycle

- Dedicated Server lease Ed25519 key material (environment/secret store), domain-separated from Owner
  session secrets, Node enrollment tokens, and Employee publisher keys (ADR-0014 DSSE).
- Startup fails closed if the lease private key or the Node-facing public pin set is missing/invalid
  when the lease feature flag/code path is compiled in.
- Rotation: mint only with current `kid`; verify window retains prior public key as above.
- Lease tokens never enter channel messages, Employee packages, logs, or browser storage.

### Minimal coding slice (follow-up PR; **only after design Accept**)

1. Add exact dependency `jose@6.2.12` to the Server/Node packages that sign/verify; lockfile pin;
   THIRD_PARTY_NOTICES if required.
2. DB migration for `capability_leases` + indexes on `(leaseId)`, `(status, expiresAt)`, `(runId)`,
   unique `jti`.
3. Protocol Zod schemas for extended `approval.resolved` and `lease.consume` /
   `lease.consume_result`, including protocol version bump and lease field presence rules.
4. Server atomic issue-on-approve (`SignJWT` Ed25519); consume handler (`jwtVerify` + conditional
   update); revoke hooks on cancel/disconnect with race rules above; reject `jku`/`jwk`.
5. Node client: pinned public keys by `kid`; local verify; fingerprint recompute gate +
   consume-before-commit wrapper; enforce required `providerId` for side-effect commits; reject
   protocol downgrade / missing lease on approve path.
6. Keep real side-effect Providers disabled behind the existing feature/opt-in until tests pass.
7. Docs: API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER bilingual updates stating the lease is
   implemented only when the coding slice merges.
8. Coding ADR records the frozen header `alg` value actually emitted by `SignJWT` in CI (`Ed25519`
   expected) and the jose pin.

### Malicious / fail-closed test matrix

| Case | Expect |
| --- | --- |
| Forged or truncated `leaseToken` / broken JWS segment | consume deny; no side effect |
| Token with `alg: "none"` or alg confusion (`HS256` with public key as secret, etc.) | deny (`ERR_JOSE_ALG_NOT_ALLOWED` / fail closed) |
| Token with `alg: "EdDSA"` while allowlist is `Ed25519` only | deny exact-match allowlist |
| Token with swapped `action`/`target`/`targetFingerprint`/`providerId` | deny |
| Valid signature but wrong `kid` / unknown `kid` | deny (no remote fetch) |
| Header includes `jku` / `jwk` / `x5u` / `x5c` | deny; never fetch |
| Missing `providerId` on side-effect issue or consume | issue fails closed / consume deny |
| Wrong `iss` / `aud` / `typ` / missing requiredClaims | deny |
| Oversized compact token (>8192 bytes) | issue rollback / consume deny |
| Wrong `nodeId` or `runId` presenter | deny |
| Second consume of same `leaseId`/`jti` | deny |
| Consume after TTL / before `nbf` | deny |
| Consume after revoke/disconnect/cancel | deny |
| Cancel after consume | idempotent no-op; audit `already_consumed`; no new lease |
| Concurrent consume vs cancel | exactly one winner per race table; loser deny or no-op |
| Approve without durable lease insert (forced seal/DB failure) | txn rollback; approval not left `approved` without lease |
| `approval.resolved` without lease on approve path (protocol downgrade) | Node refuses commit |
| Client advertises old `protocolVersion` to strip lease fields | Server refuses lease emission / Node refuses bare approve as authority |
| Fingerprint mismatch vs frozen `beforeState` | Node refuses consume/commit |
| Approved but Node offline | existing `node_disconnected` failure; no orphan usable lease after revoke/TTL |
| Concurrent Owner double-decide | existing approval conflict; at most one lease |
| Server restart mid-issued | lease still single-consume or expired; no duplicate mint |
| Provider returns uncertain after successful consume | no automatic re-consume/re-click; Run fails closed with explicit summary |
| Cross-domain token (Employee DSSE key used as lease key or vice versa) | deny (separate key material / kid namespace) |

## Verification plan

- Automated tests: listed matrix plus existing approval policy, reviewed-click, and Run transition
  suites remain green; protocol unknown-field rejection retained; jose allowlist/alg/kid negative
  tests.
- Negative and fail-closed tests: every deny row above; missing lease key at startup; migration
  drift fail closed; missing `providerId` on side-effect paths; `jku`/`jwk` rejection.
- Platforms and devices: Linux CI Server/Node unit+integration; no claim of production side-effect
  Provider support from this design-only record.
- User-visible documentation and translations: this research EN/ZH, ADR-0045, OPEN_SOURCE_REUSE
  ledger; coding slice updates API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER EN/ZH.
- Support level that the evidence permits: **Proposed design draft only (CONVERGE on jose@6.2.12 +
  `Ed25519`)**. Design gate remains open until maintainers Accept the ADR. No Declared/Integrated
  runtime lease support until the coding slice merges with tests **after Accept**.

## Unresolved questions

- **Design Accept:** maintainers must Accept ADR-0045 before any coding slice adds `jose` or enables
  lease protocol fields. Until Accept, Status remains Proposed despite CONVERGE encoding choice.
- Confirm in coding-slice CI that `SignJWT` with Ed25519 keys continues to emit protected-header
  `alg: "Ed25519"` (not `EdDSA`); if upstream ever changes default emission, freeze explicit header
  set and update tests.
- Interaction with a future exclusive human control lease (ROADMAP): control lease must revoke or
  preempt capability leases for the same surface; exact precedence belongs in that later design.
- Post-consume crash before side effect: may leave a consumed lease without effect; fail closed and
  require a new Owner approval rather than resurrecting the lease (aligns with "ambiguous external
  effects are not replayed").
- Whether a future non-side-effect lease path should exist at all; until specified, `providerId`
  omission remains forbidden.
- Exact protocol version literal for the lease-bearing messages (coding slice).
