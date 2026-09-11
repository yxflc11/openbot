# Research: capability lease protocol (DEV-001 H2)

- Status: Proposed (design draft; design gate is **not** closed; implementation not started)
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

- Search date: 2026-09-11 (jose fixed-algorithm allowlist re-verified 2026-09-11 against panva/jose docs)
- Standards and primary documentation queries:
  - [RFC 9449 OAuth 2.0 DPoP](https://datatracker.ietf.org/doc/rfc9449/) (Proposed Standard, September 2023): sender-constrained tokens; proof JWT claims `jti`, `iat`, `htm`, `htu`, optional `nonce`
  - [RFC 9396 OAuth 2.0 Rich Authorization Requests](https://datatracker.ietf.org/doc/rfc9396/) (Proposed Standard, May 2023): `authorization_details` for fine-grained action/resource binding
  - [SPIFFE overview](https://spiffe.io/docs/latest/spiffe-about/overview/) and SPIRE releases: workload SVIDs (X.509/JWT)
  - [PASETO draft-paragon-paseto-rfc-01](https://datatracker.ietf.org/doc/html/draft-paragon-paseto-rfc-01) / [paseto-standard](https://github.com/paseto-standard/paseto-rfc/blob/master/paseto.md): v4.local / v4.public
  - [Branca specification](https://github.com/tuupola/branca-spec) (XChaCha20-Poly1305 AEAD tokens)
  - Google NDSS 2014 macaroons paper and [libmacaroons](https://github.com/rescrv/libmacaroons)
  - Node.js `crypto` (`createHmac`, `sign`/`verify` Ed25519) on engines `^22.22.2 || ^24.15.0 || >=26.0.0`
  - [jose `JWTVerifyOptions.algorithms`](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md): optional `algorithms?: string[]` allowlist of accepted JWS `alg` values; default is algorithms applicable to the supplied key/secret; unsecured JWTs (`alg: "none"`) are never accepted. Sign path sets a concrete `alg` via `setProtectedHeader({ alg })`. **Conclusion:** jose supports fixed-algorithm allowlists; "algorithm agility" alone is **not** a valid rejection reason.
- Package and release queries (npm registry and GitHub tags fetched 2026-09-11):
  - `paseto@4.0.1` → GitHub tag commit `5c7812e818c1d50a47ce3baf107614c42ae16c43` (MIT, panva/paseto)
  - `jose@6.2.12` → GitHub tag object `99eaf5ed086cbee3fe49fcdf68681f68b1f122f7` (MIT, panva/jose)
  - `macaroons.js@0.3.9` → `0a0361174a07` (Apache-2.0)
  - `branca@0.5.0` → `498bb5f76316` (MIT)
  - SPIRE `v1.15.3` (published 2026-08-21) peeled commit `2f7861ae3923caf1f57eb087fc2928d58c0fb1d2` (Apache-2.0)
  - libmacaroons tip observed `ca0211d8633c` (2021-02-19; BSD-3-Clause; no recent release tags)
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0028; DEV-001 review H2;
  `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/CONTROLLED_BROWSER.md`,
  `docs/ROADMAP.md`, `docs/research/dev-001-short-term-hardening.md`,
  `docs/research/controlled-browser-click.md`, `docs/OPEN_SOURCE_REUSE.md` (Server-authoritative
  approval policy and Node protocol rows), Employee DSSE/Ed25519 keyring as local signing prior art.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| RFC 9449 DPoP claim patterns (`jti`/`iat`/`exp`/unique proof) | RFC 9449 (2023-09) | IETF Trust | IETF Proposed Standard | Excellent guidance for single-use identifiers and replay resistance; full DPoP assumes HTTP resource access + client key proofs OpenBot Node WS protocol and H3 PoP identity do not yet provide | Adopt claim/semantics ideas only; do not implement HTTP DPoP headers now |
| RFC 9396 RAR `authorization_details` | RFC 9396 (2023-05) | IETF Trust | IETF Proposed Standard | Matches fine-grained action/target binding language; OpenBot already has Server catalog + frozen `PreparedAction`, not an OAuth AS/RS split | Adopt binding vocabulary; do not add OAuth AS |
| SPIFFE SVID + SPIRE | SPIRE `v1.15.3` / `2f7861ae3923caf1f57eb087fc2928d58c0fb1d2` | Apache-2.0 | Active release train, broad tests | Strong workload identity plane, but introduces agents, attestation, and a second identity authority before OpenBot Node PoP (H3) | Do not add now; revisit with H3 |
| PASETO v4 (`paseto` npm) | `4.0.1` / `5c7812e818c1d50a47ce3baf107614c42ae16c43` | MIT | Maintained by panva; versioned suites | Good future encoding for signed/encrypted tokens; claim schema and Server consume semantics would still be OpenBot-specific | Defer encoding dependency; keep as upgrade candidate |
| `jose` JWT/JWS | `6.2.12` / tag `99eaf5ed086cbee3fe49fcdf68681f68b1f122f7` | MIT | Very active; extensive tests | **Verified:** `jwtVerify(..., { algorithms: [...] })` is a fixed-algorithm allowlist; `alg: none` is rejected. Agility is therefore controllable. Still a new runtime dependency that does not own Server lease key lifecycle, dual-verify rotation, or PostgreSQL single-consume/revoke store semantics; JWT claim validation would not replace the durable lease row | **Do not add for v1** for dependency / key-lifecycle / lease-store fit (not for "algorithm agility"). Remains a viable encoding candidate if a later slice chooses JWT wire format with an explicit allowlist |
| Macaroons (`macaroons.js` / libmacaroons) | JS `0.3.9` / `0a0361174a07`; C tip `ca0211d8633c` (2021) | Apache-2.0; BSD-3-Clause | JS package stale; C library quiet | Caveats fit attenuation, but third-party discharge and decentralized delegation exceed the single-Server lease; JS maintenance risk | Reject for v1 |
| Branca | Spec tip `c8b0ba5e2262` (2025-05-06); JS `0.5.0` / `498bb5f76316` | MIT | Spec active; JS small | Symmetric AEAD opaque tokens lack structured public claims for Node-side binding checks without Server round-trips already required for consume | Reject as primary format |
| Local OpenBot lease + Node `crypto` | Node engines floor `22.22.2` (OpenBot `package.json`) | Node.js license | Platform primitive; Employee Ed25519 signing already in-tree | Exact gap is Server issuance, durable consume, WS protocol fields, fingerprint revalidation, and Provider gate — not a missing generic token library. Sealing algorithm (HMAC-SHA256 vs Ed25519) is **undecided** (see open questions) | **Select** local gap + Node `crypto`; sealing algorithm undecided |

## Reuse decision

- Selected option: open-standard semantics + documented local gap (no new runtime dependency in the
  coding slice that follows this design).
- Selected upstream or standard: RFC 9449 (single-use/`jti`/time-bound proof ideas) and RFC 9396
  (fine-grained authorization detail binding), implemented with Node.js `crypto` and PostgreSQL.
  **Sealing algorithm is UNDECIDED** between Server-held HMAC-SHA256 opaque tokens and a dedicated
  Server Ed25519 key for publicly verifiable leases. This design does **not** select either; the
  coding ADR/PR must pick one using the decision criteria below and document startup key checks.
- Why jose (and similar JWT libraries) are not added for v1 (after docs verification):
  1. **Supply-chain / dependency cost:** Node.js `crypto` is already required; jose would be a new
     production dependency for a Server-only seal/verify path.
  2. **Server-owned key lifecycle fit:** OpenBot needs env/secret-store loaded lease keys, domain
     separation from sessions/enrollment/Employee keys, startup fail-closed on missing material, and
     Operator-driven dual-verify rotation for at most one TTL horizon. jose is a JWT toolkit, not a
     lease key lifecycle or rotation policy.
  3. **Lease store semantics:** single-consume, revoke/cancel races, and binding equality are
     PostgreSQL conditional updates on durable lease rows. jose claim checks do not provide that
     store or race protocol.
  4. **Wire/protocol surface:** OpenBot still needs WS fields, fingerprint revalidation, and
     Provider gating regardless of encoding. JWT would not close the gap by itself.
  5. **Not** rejected for algorithm agility: jose documents fixed `algorithms` allowlists.
- Why this is the first viable option: no reviewed upstream defines OpenBot's WebSocket
  approval→lease→consume loop, PostgreSQL single-consume rows, and `targetFingerprint` revalidation
  against frozen `PreparedAction`. Pulling SPIRE, OAuth AS, PASETO, jose, or macaroons would add
  authority or dependency surfaces without closing that gap.
- Exact OpenBot-specific gap: protocol fields, durable lease rows, atomic issue-on-approve, Node
  pre-commit consume, fingerprint recompute, revoke/cancel vs consume races, restart-safe status,
  and malicious/replay tests. Real side-effect Providers stay disabled until that coding slice
  lands.
- Upgrade, replacement, or exit plan: if claim growth or multi-verifier needs appear, reconsider
  PASETO v4.public, Ed25519 with distributed verify keys, or jose/JWT **with an explicit algorithm
  allowlist**; if Node PoP (H3) lands, reconsider DPoP-like proofs bound to Node keys; SPIRE only if
  OpenBot operates a workload identity plane.
- Failure behavior when the upstream is missing, incompatible, or compromised: this design depends
  on Node.js `crypto` and PostgreSQL already required by the Server. Missing lease key material
  fails Server startup closed. Invalid, expired, revoked, or already-consumed leases deny commit.
  Absence of a lease must never fall back to bare `approval.resolved`.

### Sealing algorithm decision criteria (UNDECIDED)

| Criterion | Favors HMAC-SHA256 (opaque) | Favors Ed25519 (publicly verifiable) |
| --- | --- | --- |
| Who must verify | Only Server consume path verifies integrity | Node or other components may verify claims offline before round-trip (still must consume at Server) |
| Key material ops | Single shared secret in Server secret store; dual-secret verify window | Dedicated Server signing keypair; public key distribution / pin story |
| Token opacity | Binding not readable without Server (or stolen secret) | Claims readable; signature proves Server issuance |
| Prior art in-tree | HMAC patterns for session-like Server secrets | Employee DSSE/Ed25519 publisher keys (different trust domain; must stay separated) |
| Coding-slice cost | Minimal seal/verify surface | Slightly larger key lifecycle and public-pin documentation |

**Open question (blocking for coding ADR, not for this design draft):** choose exactly one algorithm
for the first coding slice using the table above. Do not ship dual algorithms or runtime agility.
Either choice still requires Server consume to remain the sole authorization for side effects.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: standards cited for claim and binding semantics only; no RFC text,
  library source, or macaroon/PASETO/Branca code is vendored. jose docs were read only to verify
  allowlist APIs.
- Required copyright or license notice location: not applicable beyond this research record and the
  OPEN_SOURCE_REUSE ledger row.

## Protocol design (contract for the coding slice)

### Issuance (Server only) — atomic with Owner approve

**Atomic transaction (precise):** Owner `decideApproval` success with `approved` and lease creation
are one PostgreSQL transaction (or equivalent single atomic unit):

1. Preconditions checked in-txn: approval is `pending` and unexpired; Run is `waiting_approval`;
   lease key material is available; binding fields (including `providerId` per rules below) are
   complete.
2. In the same transaction:
   - conditionally update approval `pending → approved` (exactly-once; conflict fails closed);
   - insert exactly one durable lease row: `leaseId` (UUID), `approvalId`, `runId`, `nodeId`,
     `providerId` (per binding rules), `action`, `target`, `targetFingerprint`, `status=issued`,
     `issuedAt`, `expiresAt` (short TTL: min of remaining approval TTL and a hard cap, default cap
     **120s** for interactive commits; never longer than the approval `expiresAt`);
   - write audit events for both approval decision and lease issue.
3. Seal the opaque/signed token **after** the durable row is inserted, still before commit of the
   surrounding unit of work that exposes the decision to the Node path. If sealing fails, the
   transaction rolls back: approval stays `pending` (or returns to prior state), **no** lease row
   remains, and **no** `approval.resolved` with lease is emitted.
4. Commit then emit extended `approval.resolved` (approved branch) including
   `{ leaseId, leaseToken, expiresAt, targetFingerprint, action, target, providerId? }` plus today's
   decision fields. Rejected/expired branches must not include a lease and must not insert a lease
   row.

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

1. Before any side-effecting Provider `commit`/click/write, the Node sends `lease.consume` on the
   Node WebSocket with `leaseId`, `leaseToken`, `runId`, `providerId` (when required), and the
   recomputed `targetFingerprint`.
2. Server verifies token integrity, binding equality (including `providerId` rules), `status=issued`,
   `expiresAt > now` (Server clock), Node identity, and active Run assignment; then conditionally
   updates `issued → consumed` in one atomic statement.
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
| Server restart | Issued leases remain until TTL or revoke; consumed stay consumed; never re-mint without a new Owner decision |
| Node disconnect / credential revoke | Revoke all `issued` leases for that `nodeId` (and fail related waiting Runs per existing policy) |
| Run cancel / terminal / member removal | Revoke `issued` leases for that `runId` |
| Owner reject / approval expiry | No lease on reject/expiry path; if an approve+lease txn raced and lost, no lease; if an issued lease exists for a racing reject, revoke it under the race table |
| Concurrent consume | Per race table; loser deny |
| Replay of `approval.resolved` or `leaseToken` after consume | Deny |
| Clock skew | Server time is authoritative; Nodes treat local timers as UX only |

### Key lifecycle

- Dedicated Server lease key material (environment/secret store), domain-separated from Owner
  session secrets, Node enrollment tokens, and Employee publisher keys.
- Startup fails closed if the lease key is missing/invalid when the lease feature flag/code path is
  compiled in.
- Rotation: dual-key verify window (current + previous) for at most one TTL horizon; mint only with
  current key. Documented rotation is Operator-driven; no automatic Node-held private lease keys.
- Lease tokens never enter channel messages, Employee packages, logs, or browser storage.

### Minimal coding slice (follow-up PR; out of scope here)

1. DB migration for `capability_leases` + indexes on `(leaseId)`, `(status, expiresAt)`, `(runId)`.
2. Protocol Zod schemas for extended `approval.resolved` and `lease.consume` /
   `lease.consume_result`.
3. Server atomic issue-on-approve; consume handler; revoke hooks on cancel/disconnect with race
   rules above.
4. Node client: fingerprint recompute gate + consume-before-commit wrapper around Provider approval
   resume; enforce required `providerId` for side-effect commits.
5. Keep real side-effect Providers disabled behind the existing feature/opt-in until tests pass.
6. Docs: API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER bilingual updates stating the lease is
   implemented only when the coding slice merges.
7. Coding ADR must record the chosen sealing algorithm (HMAC vs Ed25519) and the jose/PASETO
   non-add rationale if unchanged.

### Malicious / fail-closed test matrix

| Case | Expect |
| --- | --- |
| Forged or truncated `leaseToken` | consume deny; no side effect |
| Token with swapped `action`/`target`/`targetFingerprint`/`providerId` | deny |
| Missing `providerId` on side-effect issue or consume | issue fails closed / consume deny |
| Wrong `nodeId` or `runId` presenter | deny |
| Second consume of same `leaseId` | deny |
| Consume after TTL | deny |
| Consume after revoke/disconnect/cancel | deny |
| Cancel after consume | idempotent no-op; audit `already_consumed`; no new lease |
| Concurrent consume vs cancel | exactly one winner per race table; loser deny or no-op |
| Approve without durable lease insert (forced seal/DB failure) | txn rollback; approval not left `approved` without lease |
| `approval.resolved` without lease on approve path (protocol downgrade) | Node refuses commit |
| Fingerprint mismatch vs frozen `beforeState` | Node refuses consume/commit |
| Approved but Node offline | existing `node_disconnected` failure; no orphan usable lease after revoke/TTL |
| Concurrent Owner double-decide | existing approval conflict; at most one lease |
| Server restart mid-issued | lease still single-consume or expired; no duplicate mint |
| Provider returns uncertain after successful consume | no automatic re-consume/re-click; Run fails closed with explicit summary |

## Verification plan

- Automated tests: listed matrix plus existing approval policy, reviewed-click, and Run transition
  suites remain green; protocol unknown-field rejection retained.
- Negative and fail-closed tests: every deny row above; missing lease key at startup; migration
  drift fail closed; missing `providerId` on side-effect paths.
- Platforms and devices: Linux CI Server/Node unit+integration; no claim of production side-effect
  Provider support from this design-only record.
- User-visible documentation and translations: this research EN/ZH, ADR-0045, OPEN_SOURCE_REUSE
  ledger; coding slice updates API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER EN/ZH.
- Support level that the evidence permits: **Proposed design draft only**. Design gate remains
  open until maintainers accept the ADR. No Declared/Integrated runtime lease support until the
  coding slice merges with tests.

## Unresolved questions

- **Sealing algorithm (UNDECIDED):** HMAC-SHA256 opaque vs Ed25519 publicly verifiable — choose in
  the coding ADR using the decision-criteria table; both require Server consume authority; do not
  pretend selected here.
- Interaction with a future exclusive human control lease (ROADMAP): control lease must revoke or
  preempt capability leases for the same surface; exact precedence belongs in that later design.
- Post-consume crash before side effect: may leave a consumed lease without effect; fail closed and
  require a new Owner approval rather than resurrecting the lease (aligns with "ambiguous external
  effects are not replayed").
- Whether a future non-side-effect lease path should exist at all; until specified, `providerId`
  omission remains forbidden.
