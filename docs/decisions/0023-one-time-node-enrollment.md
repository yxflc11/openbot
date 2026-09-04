# ADR-0023: One-time Node enrollment and individually revocable credentials

- Status: Accepted
- Date: 2026-09-04

## Context

OpenBot previously authenticated every Worker Host with one deployment-wide secret. Any host that
possessed it could claim another Node id, and the Server could not revoke one host without rotating
every host. Worker Hosts require a bootstrap flow that works on Windows, macOS, Linux, containers,
and VMs without opening an inbound management port.

The first milestone needs a recoverable operator workflow and a durable per-Node identity before it
adds a full PKI. It must not relabel a bearer secret as device attestation or imply that enrollment
grants Provider authority.

## Upstream review

- [Tailscale `92ec1026`](https://github.com/tailscale/tailscale/tree/92ec102673bf46d72bab64b0a278b93c01a47f34)
  and [Headscale 0.29.3](https://github.com/juanfont/headscale/tree/v0.29.3) (BSD-3-Clause) were
  reviewed for short-lived pre-authentication keys, one-time display, hashed-at-rest storage, and
  separation between bootstrap keys and durable machine state.
- [SPIFFE `99470b9a`](https://github.com/spiffe/spiffe/tree/99470b9abc825f14aa364dfa2c3b53b02ba5db5b)
  and [SPIRE 1.15.2](https://github.com/spiffe/spire/tree/v1.15.2) (Apache-2.0) were reviewed for
  Node attestation, challenge/response, join-token bootstrap, re-attestation, rotation, and
  revocation. Running a SPIRE control plane is disproportionate for the M1 local deployment.
- [Kubernetes 1.36.2](https://github.com/kubernetes/kubernetes/tree/v1.36.2)
  (Apache-2.0) was reviewed for the bootstrap-token-to-locally-created-key CSR pattern. Automatic
  certificate approval is not adopted without OpenBot's Owner and host policy.
- [Smallstep Certificates 0.30.2](https://github.com/smallstep/certificates/tree/v0.30.2)
  (Apache-2.0) was reviewed for
  single-use authorization tokens, token reuse prevention, and certificate issuance. OpenBot does
  not yet operate a CA or issue certificates.
- [`write-file-atomic` 8.0.0](https://github.com/npm/write-file-atomic/tree/v8.0.0) (ISC) already
  supplies the tested fsync, atomic rename, mode, and failed-temporary cleanup mechanics needed by
  the baseline file credential adapter.
- A follow-up [POSIX permission review](../research/posix-node-credential-permissions.md) compares
  OpenSSH's opened-handle permission check and OpenClaw's credential-file audit. OpenBot retains
  atomic creation and adds a fail-closed load check rather than silently repairing an exposed
  authentication secret.
- Hono 4.13.5 (MIT) supplies the public enrollment route's transport-level request body limit. This
  version is newer than the chunked-body bypass fix published in 4.12.16.

## Reuse decision

Adopt the common two-stage contract: a short-lived, single-use operator bootstrap value creates a
durable Node-specific credential. Reuse Hono's body limiter and `write-file-atomic`; keep only the
OpenBot-specific PostgreSQL transaction, audit events, protocol schemas, and Node adapter locally.

Do not import a VPN control plane, Kubernetes certificate controller, or SPIRE deployment into the
M1 Server. They solve broader infrastructure identity problems but would add a second control
plane. Design the local interfaces so a future proof-of-possession or SPIRE/mTLS adapter can replace
the bearer verifier without changing Employee identity or routing.

## Source incorporation

No upstream source or documentation was copied or substantially adapted. OpenBot calls released
library APIs and implements its own bounded protocol and persistence contract. Licenses and exact
design lineage are recorded here and in the reuse ledger.

## Verification plan

- Unit tests cover issue, replacement, wrong-Node exchange, expiry, exactly-once consumption,
  digest-only storage, authentication, and per-Node revocation.
- HTTP tests prove anonymous callers cannot issue tokens, public enrollment can exchange one valid
  token, replay fails, oversized bodies fail, and Owner revocation disconnects the online Node.
- Node tests prove a new credential is persisted before `node.hello` and the file adapter rejects
  symlinks, wrong identities, malformed content, unsafe size, and group/other-readable POSIX mode.
- A disposable real PostgreSQL test performs two concurrent exchanges and requires exactly one
  success, then authenticates and revokes the credential.
- Future proof-of-possession, rotation, keyring, and real-device conformance work must receive a new
  upstream review; this ADR is not sufficient evidence for those claims.

## Decision

1. Only an authenticated Owner may create a token. A token is bound to one Node id, expires in
   60–3,600 seconds, is returned once, and is stored only as a domain-separated SHA-256 digest.
   PostgreSQL serializes concurrent issuance for the same Node with a transaction-scoped advisory
   lock; both requests may complete, but only the last active token can be exchanged.
2. A public, request-size-bounded endpoint may exchange the exact token once. The transaction marks
   it consumed before upserting a newly random Node credential and an immutable audit event.
3. Each Node presents its credential in the first strict `node.hello`. The Server authenticates its
   Node id before accepting lifecycle or Run messages.
4. The Server stores only the credential digest. Owner revocation invalidates it and closes the
   matching live connection. Fresh enrollment can replace a revoked identity.
5. The baseline Node adapter writes a versioned identity package atomically with Owner-only POSIX
   permissions. It validates and reads the opened file handle, and refuses a file if group or other
   permission bits later appear. Environment and custom-path adapters support external secret
   injection; Windows ACL enforcement and native keyrings remain future adapters.
6. Enrollment does not grant capabilities, elevate trust tier, authenticate a human, or carry into
   an Employee package. Server policy, Run assignment, and approval remain independent.
7. Non-loopback Node connections require WSS. Bearer credentials are explicitly transitional and
   unsuitable for an untrusted network without proof of possession and replay protection.

## Consequences

- Compromising one Node credential no longer authenticates another Node id, and the Owner can
  revoke one host without rotating the deployment.
- Operators must perform a deliberate pairing step and protect or replace the resulting local file.
- The Server cannot recover plaintext credentials; a lost value requires revocation and enrollment.
- A copied bearer credential can still impersonate its own Node id. Native keyring storage,
  non-exportable keys, challenge/response, short-lived certificates, rotation, and message sequence
  protection remain required production work.
