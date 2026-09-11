# ADR-0045: Server-issued single-use capability leases for approved actions

- Status: Accepted
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

Full candidate, license, maintenance, and code-path evidence is recorded in
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
  None close the Server consume + fingerprint revalidation + WS protocol gap by themselves; several
  add maintenance or algorithm-agility cost inappropriate for the first lease slice.

## Reuse decision

Implement an OpenBot-specific capability-lease protocol as the documented local gap, guided by
RFC 9449/9396 semantics, using Node.js `crypto` and PostgreSQL. Do not add SPIRE, OAuth, PASETO,
jose, macaroons, or Branca dependencies for the first coding slice. Prefer an opaque Server-sealed
token (HMAC-SHA256) verified only at Server consume; Ed25519 is an allowed alternative if the
implementation PR documents key distribution and still keeps Server consume authoritative.

## Source incorporation

No RFC text or upstream library source is copied or substantially adapted. Notices are not required
beyond the research record and OPEN_SOURCE_REUSE ledger citation.

## Verification plan

- Design evidence: bilingual research record, this ADR, reuse ledger row.
- Coding-slice evidence (follow-up): protocol schema tests; issue-on-approve; conditional consume;
  revoke on cancel/disconnect; restart durability; fingerprint mismatch; replay; concurrent consume;
  missing lease key fails startup; existing approval policy and reviewed-click suites; bilingual
  API/ARCHITECTURE/SECURITY/CONTROLLED_BROWSER updates.
- Rollback: feature remains off and Providers stay disabled if lease paths are incomplete.

## Decision

1. **Server issuance only.** After a successful Owner approve of a pending, unexpired approval, the
   Server inserts exactly one durable lease (`issued`) and seals a token bound to
   `leaseId`/`approvalId`/`runId`/`nodeId`/(optional `providerId`)/`action`/`target`/
   `targetFingerprint` with a short `expiresAt` (capped, never beyond the approval expiry).
2. **Protocol.** Approved `approval.resolved` messages carry the lease fields. Rejected/expired
   resolutions never carry a lease. Nodes must not treat a bare decision as commit authority once
   the coding slice is enabled.
3. **One-time consume.** Before any side-effecting commit, the Node recomputes
   `targetFingerprint` from its frozen `PreparedAction`/`beforeState` and sends `lease.consume`.
   The Server verifies the token and bindings, then conditionally transitions `issued → consumed`.
   Only a successful consume result authorizes the side effect. Automatic retry of consume or
   commit after uncertainty is forbidden.
4. **Revocation and restart.** Run cancel/terminal state, Node disconnect/credential revoke, Owner
   rejection races, and Operator key invalidation revoke or deny `issued` leases. Server restart
   must not mint a replacement lease without a new Owner decision. Consumed leases remain consumed.
5. **Key lifecycle.** Lease keys are Server-only, domain-separated from sessions, enrollment, and
   Employee publisher keys. Missing/invalid keys fail closed at startup when the lease path is
   present. Rotation uses a bounded dual-verify window; minting uses the current key only. Tokens
   never enter logs, channels, Employee packages, or browsers.
6. **Provider gate unchanged until implemented.** This ADR accepts the design contract only. Real
   side-effecting Providers remain disabled until the minimal coding slice and malicious test
   matrix in the research record pass. Local screenshot/URL checks remain necessary but never
   sufficient.

## Consequences

- Closes the documented H2 design gate: future coding can replace notification-only approval with
  a verifiable, single-use lease without re-litigating upstream choice.
- Adds operational work: lease key provisioning, migration, and revoke hooks on existing Run/Node
  lifecycle edges.
- Does not by itself stop a fully compromised Node that already obtained a valid lease from abusing
  that one consumed window; TTL, binding, and disablement of broad Providers remain required.
- Defers workload identity (SPIFFE/SPIRE) and Node proof-of-possession (DPoP-like) to their own
  projects while remaining compatible with later binding of leases to Node keys.
