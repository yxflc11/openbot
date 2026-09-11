# Research: capability lease protocol (DEV-001 H2)

- Status: Accepted (design contract; implementation not started)
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
| Fingerprint computation | `apps/server/src/postgres-store.ts` `approvalTargetFingerprint`: `sha256(action \|\| "\\0" \|\| target \|\| "\\0" \|\| JSON.stringify(beforeState))` on `requestApproval` | Never recomputed or compared at resolve, Node resume, or Provider commit |
| Owner decision | `decideApproval` conditionally updates pending→approved/rejected/expired once; event payload repeats stored fingerprint | Still no signed lease |
| Prepare / approve / commit | `packages/provider-sdk/src/provider.ts` documents frozen `PreparedAction` and optional `prepare`/`commit`; Docker reviewed click freezes `beforeState` then locally rechecks screenshot/URL before one `/click` (`providers/docker/src/reviewed-click.ts`) | Local evidence binding only; `docs/CONTROLLED_BROWSER.md` explicitly states no signed single-use execution lease |
| Policy / disclosure | ADR-0028; `docs/API.md` approval section; `docs/ARCHITECTURE.md`; `docs/reviews/DEV-001.md` H2; `docs/ROADMAP.md`; `docs/SECURITY.md` attack scenarios (repeat consume, post-approval drift, restart of expired approval) | Contract already forbids enabling real side-effect Providers until a lease protocol exists |

## Search evidence

- Search date: 2026-09-11
- Standards and primary documentation queries:
  - [RFC 9449 OAuth 2.0 DPoP](https://datatracker.ietf.org/doc/rfc9449/) (Proposed Standard, September 2023): sender-constrained tokens; proof JWT claims `jti`, `iat`, `htm`, `htu`, optional `nonce`
  - [RFC 9396 OAuth 2.0 Rich Authorization Requests](https://datatracker.ietf.org/doc/rfc9396/) (Proposed Standard, May 2023): `authorization_details` for fine-grained action/resource binding
  - [SPIFFE overview](https://spiffe.io/docs/latest/spiffe-about/overview/) and SPIRE releases: workload SVIDs (X.509/JWT)
  - [PASETO draft-paragon-paseto-rfc-01](https://datatracker.ietf.org/doc/html/draft-paragon-paseto-rfc-01) / [paseto-standard](https://github.com/paseto-standard/paseto-rfc/blob/master/paseto.md): v4.local / v4.public
  - [Branca specification](https://github.com/tuupola/branca-spec) (XChaCha20-Poly1305 AEAD tokens)
  - Google NDSS 2014 macaroons paper and [libmacaroons](https://github.com/rescrv/libmacaroons)
  - Node.js `crypto` (`createHmac`, `sign`/`verify` Ed25519) on engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`
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
| `jose` JWT/JWS | `6.2.12` / tag `99eaf5ed086cbee3fe49fcdf68681f68b1f122f7` | MIT | Very active; extensive tests | Could carry claims, but JOSE algorithm agility is a footgun OpenBot avoids elsewhere (Employee packages use fixed Ed25519/DSSE) | Do not add for v1 lease |
| Macaroons (`macaroons.js` / libmacaroons) | JS `0.3.9` / `0a0361174a07`; C tip `ca0211d8633c` (2021) | Apache-2.0; BSD-3-Clause | JS package stale; C library quiet | Caveats fit attenuation, but third-party discharge and decentralized delegation exceed the single-Server lease; JS maintenance risk | Reject for v1 |
| Branca | Spec tip `c8b0ba5e2262` (2025-05-06); JS `0.5.0` / `498bb5f76316` | MIT | Spec active; JS small | Symmetric AEAD opaque tokens lack structured public claims for Node-side binding checks without Server round-trips already required for consume | Reject as primary format |
| Local OpenBot lease + Node `crypto` | Node engines floor `22.22.2` (OpenBot `package.json`) | Node.js license | Platform primitive; Employee Ed25519 signing already in-tree | Exact gap is Server issuance, durable consume, WS protocol fields, fingerprint revalidation, and Provider gate — not a missing generic token library | **Select** |

## Reuse decision

- Selected option: open-standard semantics + documented local gap (no new runtime dependency in the
  coding slice that follows this design).
- Selected upstream or standard: RFC 9449 (single-use/`jti`/time-bound proof ideas) and RFC 9396
  (fine-grained authorization detail binding), implemented with Node.js `crypto` using a
  Server-held HMAC-SHA256 key for opaque lease tokens **or** a dedicated Server Ed25519 key for
  publicly verifiable leases (implementation chooses one algorithm in the coding ADR/PR; design
  allows either). Prefer HMAC opaque tokens for the minimal slice because only the Server must
  authorize consume and Nodes remain untrusted.
- Why this is the first viable option: no reviewed upstream defines OpenBot's WebSocket
  approval→lease→consume loop, PostgreSQL single-consume rows, and `targetFingerprint` revalidation
  against frozen `PreparedAction`. Pulling SPIRE, OAuth AS, PASETO, or macaroons would add
  authority surfaces without closing that gap.
- Exact OpenBot-specific gap: protocol fields, durable lease rows, Server issuance on Owner
  approve, Node pre-commit consume, fingerprint recompute, revocation on Run/Node/Owner cancel,
  restart-safe status, and malicious/replay tests. Real side-effect Providers stay disabled until
  that coding slice lands.
- Upgrade, replacement, or exit plan: if claim growth or multi-verifier needs appear, reconsider
  PASETO v4.public or Ed25519 with distributed verify keys; if Node PoP (H3) lands, reconsider
  DPoP-like proofs bound to Node keys; SPIRE only if OpenBot operates a workload identity plane.
- Failure behavior when the upstream is missing, incompatible, or compromised: this design depends
  on Node.js `crypto` and PostgreSQL already required by the Server. Missing lease key material
  fails Server startup closed. Invalid, expired, revoked, or already-consumed leases deny commit.
  Absence of a lease must never fall back to bare `approval.resolved`.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: standards cited for claim and binding semantics only; no RFC text,
  library source, or macaroon/PASETO/Branca code is vendored.
- Required copyright or license notice location: not applicable beyond this research record and the
  OPEN_SOURCE_REUSE ledger row.

## Protocol design (contract for the coding slice)

### Issuance (Server only)

1. Owner `decideApproval` succeeds with `approved` for a pending, unexpired approval while the Run
   is `waiting_approval`.
2. Server creates one durable lease row: `leaseId` (UUID), `approvalId`, `runId`, `nodeId`,
   optional `providerId`, `action`, `target`, `targetFingerprint`, `status=issued`, `issuedAt`,
   `expiresAt` (short TTL: min of remaining approval TTL and a hard cap, default cap **120s** for
   interactive commits; never longer than the approval `expiresAt`).
3. Server seals an opaque token over a canonical byte string of those bindings (plus `jti=leaseId`)
   with the Server lease key. The token is returned only on the Node path.
4. Extended `approval.resolved` (approved branch) includes `{ leaseId, leaseToken, expiresAt,
   targetFingerprint, action, target }` in addition to today's decision fields. Rejected/expired
   branches must not include a lease.

### Binding

A lease authorizes exactly one commit of one frozen action:

- `runId` + `nodeId` + `approvalId` + `action` + `target` + `targetFingerprint`
- optional `providerId` when the Node hosts multiple Providers
- Node must recompute `sha256(action || "\\0" || target || "\\0" || JSON.stringify(beforeState))`
  from its frozen `PreparedAction` and refuse commit on mismatch before calling consume

### Consume (one-time)

1. Before any side-effecting Provider `commit`/click/write, the Node sends `lease.consume` on the
   Node WebSocket with `leaseId`, `leaseToken`, `runId`, and the recomputed `targetFingerprint`.
2. Server verifies token integrity, binding equality, `status=issued`, `expiresAt > now`, Node
   identity, and active Run assignment; then conditionally updates `issued → consumed`.
3. Only after `lease.consume_result` success may the Node perform the side effect. Uncertain
   Provider results must not retry consume or commit automatically (preserve reviewed-click rule).

### Restart, revoke, concurrency, replay

| Event | Required behavior |
| --- | --- |
| Server restart | Issued leases remain until TTL or revoke; consumed stay consumed; never re-mint without a new Owner decision |
| Node disconnect / credential revoke | Revoke all `issued` leases for that `nodeId` (and fail related waiting Runs per existing policy) |
| Run cancel / terminal / member removal | Revoke `issued` leases for that `runId` |
| Owner reject / approval expiry | No lease; existing issued lease for that approval must be revoked if racing |
| Concurrent consume | Conditional update; loser gets deny |
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
3. Server issue on approve; consume handler; revoke hooks on cancel/disconnect.
4. Node client: fingerprint recompute gate + consume-before-commit wrapper around Provider approval
   resume.
5. Keep real side-effect Providers disabled behind the existing feature/opt-in until tests pass.
6. Docs: API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER bilingual updates stating the lease is
   implemented only when the coding slice merges.

### Malicious / fail-closed test matrix

| Case | Expect |
| --- | --- |
| Forged or truncated `leaseToken` | consume deny; no side effect |
| Token with swapped `action`/`target`/`targetFingerprint` | deny |
| Wrong `nodeId` or `runId` presenter | deny |
| Second consume of same `leaseId` | deny |
| Consume after TTL | deny |
| Consume after revoke/disconnect/cancel | deny |
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
  drift fail closed.
- Platforms and devices: Linux CI Server/Node unit+integration; no claim of production side-effect
  Provider support from this design-only record.
- User-visible documentation and translations: this research EN/ZH, ADR-0045, OPEN_SOURCE_REUSE
  ledger; coding slice updates API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER EN/ZH.
- Support level that the evidence permits: design contract only. No Declared/Integrated runtime
  lease support until the coding slice merges with tests.

## Unresolved questions

- Final sealing algorithm for the first coding slice (HMAC-SHA256 opaque vs Ed25519 publicly
  verifiable): both meet this ADR if Server consume remains authoritative; pick one in the
  implementation PR with startup key checks.
- Whether `providerId` is mandatory on multi-Provider Nodes in v1 or derived from the frozen action
  catalog entry.
- Interaction with a future exclusive human control lease (ROADMAP): control lease must revoke or
  preempt capability leases for the same surface; exact precedence belongs in that later design.
- Post-consume crash before side effect: may leave a consumed lease without effect; fail closed and
  require a new Owner approval rather than resurrecting the lease (aligns with "ambiguous external
  effects are not replayed").
