# ADR-0045: Server-issued single-use capability leases for approved actions

- Status: Proposed
- Date: 2026-09-11

## Context

OpenBot already records approvals with a Server-computed `targetFingerprint`, evaluates policy at
the Server boundary (ADR-0028), and can notify a Node with `approval.resolved`. That notification
is not a capability: the protocol carries no signature, short-TTL lease, or single-use consume
step, and neither Server nor Node revalidates the fingerprint at commit time. DEV-001 H2,
`docs/API.md`, `docs/ARCHITECTURE.md`, `docs/CONTROLLED_BROWSER.md`, and the ROADMAP therefore keep
real side-effecting Providers disabled until a reviewed lease protocol exists.

The user outcome is: an Owner approval authorizes exactly one commit of one frozen action on one
assigned Node for a short time, with restart/revoke/replay failing closed.

This ADR is **Proposed**. Encoding/algorithm choices below are a **CONVERGE** design recommendation
for maintainer review. The H2 design gate is **not** closed until maintainers Accept this ADR.

Full candidate, license, maintenance, race, claim, and code-path evidence is recorded in
[capability-lease-protocol research](../research/capability-lease-protocol.md).

## Upstream review

- [RFC 9449](https://datatracker.ietf.org/doc/rfc9449/) (DPoP) supplies single-use proof identifier
  and time-bound sender-constraint ideas (`jti`, `iat`, replay resistance). Full HTTP DPoP is not
  adopted because OpenBot's Node channel is a Server-authenticated WebSocket and Node proof-of
  possession remains a separate H3 project.
- [RFC 9396](https://datatracker.ietf.org/doc/rfc9396/) (RAR) supplies fine-grained authorization
  detail vocabulary for binding action/resource fields. OpenBot does not add an OAuth authorization
  server.
- [RFC 7515 / 7519](https://datatracker.ietf.org/doc/html/rfc7519) JWS Compact Serialization JWT is
  the selected wire encoding for the lease token.
- SPIRE `v1.15.3` / `2f7861ae3923caf1f57eb087fc2928d58c0fb1d2` (Apache-2.0) is a mature SVID plane
  but would introduce a second identity authority before OpenBot Node PoP exists — not selected.
- PASETO `4.0.1` / `5c7812e818c1d50a47ce3baf107614c42ae16c43` (MIT), `macaroons.js` `0.3.9`
  (Apache-2.0), and Branca `0.5.0` (MIT) were reviewed as alternate encodings and not selected for
  v1.
- **`jose@6.2.12` selected for encode/verify (CONVERGE):**
  - Annotated GitHub tag object `99eaf5ed086cbee3fe49fcdf68681f68b1f122f7` peels to commit
    **`505a55b8f73536082367b2614cb77e927ba96ec1`** (MIT; **no runtime dependencies**).
  - `jwtVerify` supports fixed `algorithms` allowlist plus `issuer` / `audience` / `typ` /
    `requiredClaims`; `alg: "none"` is never accepted.
  - [panva/jose#262](https://github.com/panva/jose/issues/262) Node support table lists
    Edwards-curve DSA JWS algs **`EdDSA`** and **`Ed25519`**. Prefer the fully-specified
    **`Ed25519`** identifier; pin allowlist to that single alg and require exact protected-header
    match. Local probe: `SignJWT` with `alg: "Ed25519"` emits `Ed25519`; cross-allowlist with
    `EdDSA` fails closed (`ERR_JOSE_ALG_NOT_ALLOWED`).
  - Node 22 (`crypto.generateKeyPairSync('ed25519')`) supports Ed25519 natively (confirmed on
    `v22.22.2`).
- **Rewrite of prior jose rejection:** earlier drafts deferred jose for dependency / key-lifecycle /
  lease-store reasons. Per OPEN_SOURCE_REUSE / AGENTS order, prefer the maintained library for
  signature encoding. **“Library does not provide OpenBot lease store semantics” is not a reason to
  reject jose for signature encoding.** PostgreSQL single-consume/revoke remains OpenBot's
  documented gap beside jose, not a substitute for rejecting it.

## Reuse decision

1. **Encoding:** add `jose@6.2.12` (after Accept, in the coding slice) for JWS Compact JWT
   `SignJWT` / `jwtVerify`.
2. **Algorithm:** Server Ed25519 keys; protected header **`alg: "Ed25519"`**; verify
   `algorithms: ['Ed25519']` only. Document if signing API ever emits `EdDSA` instead and freeze to
   that single value — never accept both.
3. **Architecture:** Server issues with private key; Node holds/verifies with **public key only**
   (trusted `kid` pins; no remote key fetch); Server performs **atomic consume** in PostgreSQL.
4. **Semantics:** RFC 9449/9396 claim and binding ideas; OpenBot-specific WS protocol, durable lease
   rows, fingerprint revalidation, and Provider gate.
5. Do **not** add SPIRE, OAuth AS, PASETO, macaroons, or Branca for the first coding slice.

## Source incorporation

No RFC text or upstream library source is copied or substantially adapted. jose documentation and
issue #262 were consulted for allowlist/alg evidence. Notices for the MIT `jose` dependency are
required when the coding slice adds it to the lockfile; this Proposed design records the pin in
research and OPEN_SOURCE_REUSE only.

## Verification plan

- Design evidence: bilingual research record, this Proposed ADR, reuse ledger row (jose selected).
- Coding-slice evidence (follow-up, **only after Accept**): `jose@6.2.12` pin; protocol schema
  tests; atomic issue-on-approve; conditional consume; consume vs cancel races; revoke on
  cancel/disconnect; restart durability; fingerprint mismatch; missing/mismatched `providerId`;
  replay; concurrent consume; wrong/`EdDSA`/none alg; unknown `kid`; `jku`/`jwk` rejection;
  protocol downgrade rejection; token oversize; missing lease key fails startup; existing approval
  policy and reviewed-click suites; bilingual API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER updates;
  CI assert of emitted header `alg`.
- Rollback: feature remains off and Providers stay disabled if lease paths are incomplete.

## Decision

1. **Server issuance only, atomic with approve.** After a successful Owner approve of a pending,
   unexpired approval, the Server inserts exactly one durable lease (`issued`) in the **same atomic
   transaction** as the approval state transition, then seals a JWS Compact JWT with the Server
   Ed25519 private key. Seal failure or oversize token rolls the unit back: no approved approval
   without a durable lease, and no lease token emitted. Binding includes
   `leaseId`/`jti`/`approvalId`/`runId`/`nodeId`/`providerId` (per rules below)/`action`/`target`/
   `targetFingerprint` with short `exp` (capped, never beyond the approval expiry), plus `iss`/
   `aud`/`iat`/`nbf` and header `kid`/`alg`/`typ`. The required v1 profile below also binds purpose, fingerprint
   version and the authenticated connection.
2. **`providerId` fail-closed.** Required on issue and consume for every side-effecting action
   lease; missing, empty, or mismatched values fail closed (no txn commit / deny consume). Optional
   only if a future non-side-effect lease path is explicitly specified and the catalog proves a
   single unambiguous Provider; until then omission is forbidden. Multi-Provider Nodes always
   require `providerId`.
3. **Protocol.** Approved `approval.resolved` messages carry the lease fields under a minimum
   `protocolVersion`. Rejected/expired resolutions never carry a lease. Nodes must not treat a bare
   decision as commit authority once the coding slice is enabled. Client/protocol version downgrade
   that strips lease fields is rejected.
4. **Trusted `kid` + rotation; no remote keys.** Server publishes/pins known kids to Nodes. Node
   accepts only configured kids. Rotation retains the prior public key for a verify-window ≥ max
   lease TTL. Verifiers **reject** `jku`/`jwk`/`x5u`/`x5c` (and similar) and never fetch keys from
   the token or a URL.
5. **One-time consume.** Before any side-effecting commit, the Node verifies the JWT locally
   (public key only), recomputes `targetFingerprint` from its frozen `PreparedAction`/`beforeState`,
   and sends `lease.consume`. The Server re-verifies the token and bindings, then conditionally
   transitions `issued → consumed`. Only a successful consume result authorizes the side effect.
   Automatic retry of consume or commit after uncertainty is forbidden.
6. **Consume vs cancel/revoke races.** Competing conditional updates on the same `issued` row: first
   successful transition wins. Loser consume → deny (no side-effect authority). Repeat consume after
   `consumed` → non-success deny (does not re-arm). Repeat revoke on `revoked`/`expired` → idempotent
   success; revoke after `consumed` → idempotent no-op. Every attempt is audited (`leaseId`, actor,
   prior status, outcome). At most one successful consume per `leaseId`. Cancel/revoke never mints a
   replacement lease.
7. **Revocation and restart.** Run cancel/terminal state, Node disconnect/credential revoke, Owner
   rejection races, TTL sweep, and Operator key invalidation revoke or deny `issued` leases under
   the race rules. Server restart must not mint a replacement lease without a new Owner decision.
   Consumed leases remain consumed. Post-consume crash before side effect requires a new Owner
   approval (no resurrection).
8. **Key lifecycle.** Lease Ed25519 keys are Server-only for private material, domain-separated from
   sessions, enrollment, and Employee publisher keys. Missing/invalid keys or empty public pin sets
   fail closed at startup when the lease path is present. Tokens never enter logs, channels,
   Employee packages, or browsers. Token compact form hard-capped at **8192** bytes.
9. **Provider gate unchanged until implemented.** This ADR proposes the design contract only. Real
   side-effecting Providers remain disabled until Accept, then the minimal coding slice and
   malicious test matrix in the research record pass. Local screenshot/URL checks remain necessary
   but never sufficient.
10. **Minimal coding slice only after Accept.** Dependency add, migrations, protocol bump, and
    Node/Server wiring are out of scope for this docs PR.

## Exact v1 profile required by this proposal

The [research addendum](../research/capability-lease-protocol.md#review-addendum-exact-v1-profile)
is normative for this Proposed design. It fixes the protected type to
`openbot-capability-lease+jwt` and required `tokenUse` to `capability_lease`; both must match exactly.

Action fingerprints use RFC 8785 JCS with proposed `canonicalize@5.0.0` /
`7d97c70c79c9f52070e6c24c38a92f0dd9b32a57` (Apache-2.0, no runtime dependencies), a bounded strict JSON
profile, and a versioned domain prefix. The addendum defines the precise bytes and limits;
[shared vectors](../research/capability-lease-v1-vectors.json) cover canonical input, ordering,
Unicode, negative input and legacy rejection. Preserve old approval hashes for history; new
preparation and Owner review are required before an unversioned approval can obtain a v1 lease.
No production dependency or migration is added by this design PR.

Expiry is strict at both verifiers: `nbf <= now < exp`, with no authorization leeway. Server-issued
connection identity is signed and persisted. A consume result must match the single pending
request, lease, run, Node, Provider, connection and fingerprint on the same authenticated socket.
Node expiry/clock-health and monotonic response deadlines reject delayed or duplicate results,
including after reconnect. One successful database consume does not guarantee exactly-once
execution across a crash; uncertain outcomes never trigger automatic retry.

## Consequences

- Advances the H2 design draft for review with a concrete jose@6.2.12 + `Ed25519` CONVERGE; **does
  not close** the design gate while Status remains Proposed.
- After Accept, coding adds a MIT, zero-dependency JWT toolkit and Operator work for lease key
  provisioning, `kid` pins, migration, atomic approve+issue, and revoke hooks with explicit
  race/audit rules.
- Does not by itself stop a fully compromised Node that already obtained a valid lease from abusing
  that one consumed window; TTL, binding, required `providerId`, and disablement of broad Providers
  remain required.
- Defers workload identity (SPIFFE/SPIRE) and Node proof-of-possession (DPoP-like) to their own
  projects while remaining compatible with later binding of leases to Node keys.
- Leaves HMAC-only opaque tokens and PASETO as explicit non-selected alternatives rather than open
  algorithm agility.
