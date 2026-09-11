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

This ADR is **Proposed**. The H2 design gate is **not** closed until maintainers accept it.

Full candidate, license, maintenance, race, and code-path evidence is recorded in
[capability-lease-protocol research](../research/capability-lease-protocol.md).

## Upstream review

- [RFC 9449](https://datatracker.ietf.org/doc/rfc9449/) (DPoP) supplies single-use proof identifier
  and time-bound sender-constraint ideas (`jti`, `iat`, replay resistance). Full HTTP DPoP is not
  adopted because OpenBot's Node channel is a Server-authenticated WebSocket and Node proof-of
  possession remains a separate H3 project.
- [RFC 9396](https://datatracker.ietf.org/doc/rfc9396/) (RAR) supplies fine-grained authorization
  detail vocabulary for binding action/resource fields. OpenBot does not add an OAuth authorization
  server.
- SPIRE `v1.15.3` / `2f7861ae3923caf1f57eb087fc2928d58c0fb1d2` (Apache-2.0) is a mature SVID plane
  but would introduce a second identity authority before OpenBot Node PoP exists.
- PASETO `4.0.1` / `5c7812e818c1d50a47ce3baf107614c42ae16c43` (MIT), `jose` `6.2.12` (MIT),
  `macaroons.js` `0.3.9` (Apache-2.0), and Branca `0.5.0` (MIT) were reviewed as token encodings.
- **jose verification (2026-09-11):** panva/jose `JWTVerifyOptions.algorithms` is an explicit
  fixed-algorithm allowlist (`algorithms?: string[]`); `alg: "none"` is never accepted. Therefore
  jose is **not** rejected for "algorithm agility." It is deferred/not added for v1 because it is a
  new runtime dependency that does not own Server lease key lifecycle (secret-store load, domain
  separation, dual-verify rotation, startup fail-closed) or PostgreSQL single-consume/revoke store
  semantics, and JWT validation alone would not close the WS protocol + fingerprint gap. jose
  remains a viable later encoding candidate **with** an explicit allowlist if JWT wire format is
  chosen.
- None of the reviewed encodings close the Server consume + fingerprint revalidation + WS protocol
  gap by themselves.

## Reuse decision

Implement an OpenBot-specific capability-lease protocol as the documented local gap, guided by
RFC 9449/9396 semantics, using Node.js `crypto` and PostgreSQL. Do not add SPIRE, OAuth, PASETO,
jose, macaroons, or Branca dependencies for the first coding slice.

**Sealing algorithm is UNDECIDED** (HMAC-SHA256 opaque vs Server Ed25519). This ADR does not select
either. The coding ADR/PR must choose exactly one using the research decision-criteria table
(verifier set, key ops, opacity, in-tree prior art, slice cost). Either choice keeps Server consume
authoritative for side effects and must not introduce runtime algorithm agility.

## Source incorporation

No RFC text or upstream library source is copied or substantially adapted. jose documentation was
consulted only to verify allowlist APIs. Notices are not required beyond the research record and
OPEN_SOURCE_REUSE ledger citation.

## Verification plan

- Design evidence: bilingual research record, this Proposed ADR, reuse ledger row.
- Coding-slice evidence (follow-up): protocol schema tests; atomic issue-on-approve; conditional
  consume; consume vs cancel races; revoke on cancel/disconnect; restart durability; fingerprint
  mismatch; missing/mismatched `providerId` on side-effect paths; replay; concurrent consume;
  missing lease key fails startup; existing approval policy and reviewed-click suites; bilingual
  API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER updates; record chosen sealing algorithm.
- Rollback: feature remains off and Providers stay disabled if lease paths are incomplete.

## Decision

1. **Server issuance only, atomic with approve.** After a successful Owner approve of a pending,
   unexpired approval, the Server inserts exactly one durable lease (`issued`) in the **same atomic
   transaction** as the approval state transition. Seal failure rolls the unit back: no approved
   approval without a durable lease, and no lease token emitted. Binding includes
   `leaseId`/`approvalId`/`runId`/`nodeId`/`providerId` (per rules below)/`action`/`target`/
   `targetFingerprint` with a short `expiresAt` (capped, never beyond the approval expiry).
2. **`providerId` fail-closed.** Required on issue and consume for every side-effecting action
   lease; missing, empty, or mismatched values fail closed (no txn commit / deny consume). Optional
   only if a future non-side-effect lease path is explicitly specified and the catalog proves a
   single unambiguous Provider; until then omission is forbidden. Multi-Provider Nodes always
   require `providerId`.
3. **Protocol.** Approved `approval.resolved` messages carry the lease fields. Rejected/expired
   resolutions never carry a lease. Nodes must not treat a bare decision as commit authority once
   the coding slice is enabled.
4. **One-time consume.** Before any side-effecting commit, the Node recomputes
   `targetFingerprint` from its frozen `PreparedAction`/`beforeState` and sends `lease.consume`.
   The Server verifies the token and bindings, then conditionally transitions `issued → consumed`.
   Only a successful consume result authorizes the side effect. Automatic retry of consume or
   commit after uncertainty is forbidden.
5. **Consume vs cancel/revoke races.** Competing conditional updates on the same `issued` row: first
   successful transition wins. Loser consume → deny (no side-effect authority). Repeat consume after
   `consumed` → non-success deny (does not re-arm). Repeat revoke on `revoked`/`expired` → idempotent
   success; revoke after `consumed` → idempotent no-op. Every attempt is audited (`leaseId`, actor,
   prior status, outcome). At most one successful consume per `leaseId`. Cancel/revoke never mints a
   replacement lease.
6. **Revocation and restart.** Run cancel/terminal state, Node disconnect/credential revoke, Owner
   rejection races, TTL sweep, and Operator key invalidation revoke or deny `issued` leases under
   the race rules. Server restart must not mint a replacement lease without a new Owner decision.
   Consumed leases remain consumed. Post-consume crash before side effect requires a new Owner
   approval (no resurrection).
7. **Key lifecycle.** Lease keys are Server-only, domain-separated from sessions, enrollment, and
   Employee publisher keys. Missing/invalid keys fail closed at startup when the lease path is
   present. Rotation uses a bounded dual-verify window; minting uses the current key only. Tokens
   never enter logs, channels, Employee packages, or browsers.
8. **Provider gate unchanged until implemented.** This ADR proposes the design contract only. Real
   side-effecting Providers remain disabled until the minimal coding slice and malicious test
   matrix in the research record pass. Local screenshot/URL checks remain necessary but never
   sufficient.

## Consequences

- Advances the H2 design draft for review; **does not close** the design gate while Status remains
  Proposed. Future coding still needs an accepted ADR plus the coding-slice ADR's sealing-algorithm
  choice.
- Adds operational work once accepted and implemented: lease key provisioning, migration, atomic
  approve+issue, and revoke hooks on existing Run/Node lifecycle edges with explicit race/audit
  rules.
- Does not by itself stop a fully compromised Node that already obtained a valid lease from abusing
  that one consumed window; TTL, binding, required `providerId`, and disablement of broad Providers
  remain required.
- Defers workload identity (SPIFFE/SPIRE) and Node proof-of-possession (DPoP-like) to their own
  projects while remaining compatible with later binding of leases to Node keys.
- Leaves HMAC vs Ed25519 and any future JWT/jose encoding as explicit open follow-ups rather than
  implied selections.
