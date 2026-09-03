# ADR-0024: Owner-managed Employee publisher keys

Status: Accepted — 2026-09-04

## Context

ADR-0014 defines an Ed25519 DSSE envelope but deliberately leaves HTTP export unsigned until a key
lifecycle and explicit trust policy exist. OpenBot now needs the smallest safe self-hosted bridge
from that tested primitive to Employee download and quarantine preview.

The Server is authoritative for trust decisions. The Web client must not create, receive, or retain
private signing keys. An Employee package is portable knowledge, not an account or authority
transfer, so neither an embedded public key nor a publisher label may make a package trusted.

The upstream comparison is recorded in
[the research note](../research/employee-publisher-key-lifecycle.md).

## Upstream review

- Sigstore Cosign `v3.0.6` separates encrypted private keys, public keys, and future KMS custody.
- TUF specification `v1.0.35` retains versioned key history across rotation and removes revoked keys
  from the trusted role.
- Notary Project specifications `v1.1.0` keep trust material separate from the policy that decides
  whether an artifact is authentic, and fail when no policy applies.
- Node.js `v22.23.2` already provides the required Ed25519, encrypted PKCS#8, SPKI, and hashing APIs.

Exact repositories, licenses, source locations, and rejected integration choices are recorded in
the linked research note.

## Reuse decision

Reuse Node.js crypto and the existing `@sigstore/core` DSSE primitive. Adopt Cosign's public/private
separation, Notary's explicit out-of-band trust, and TUF's retained key-state concepts. Implement
only OpenBot's missing filesystem layout, Owner CLI, package-policy adapter, and HTTP integration.
Keep the signer and verifier behind interfaces so native keyrings, KMS, Sigstore, or TUF can replace
the backend without changing the Employee package.

## Source incorporation

No upstream source is copied or substantially adapted. OpenBot calls released Node.js and
`@sigstore/core` APIs. Required upstream links and licenses are recorded in the research note and
reuse ledger.

## Decision

1. The first backend is an operator-managed filesystem keyring outside PostgreSQL and the object
   store. Its private Ed25519 key is password-encrypted PKCS#8 PEM; public keys are SPKI PEM.
2. The decryption passphrase is read from a separate `0600` regular file. It is never accepted by an
   HTTP route or stored in the key manifest.
3. Key ids are deterministic `ed25519:<sha256-spki-der>` fingerprints. The Server recomputes the id
   and proves the configured private and public keys match before enabling signing.
4. The trust manifest is strict, bounded, versioned, and atomically replaced. It records one active
   signing key plus retained public keys in `active`, `retired`, externally `trusted`, or `revoked`
   state.
5. Rotation generates a new active key and retires the previous key. Retired public keys remain
   eligible for verification so previously distributed packages can still be inspected. Retired
   private keys are not loaded by the Server.
6. Revoked keys are excluded before signature verification. Packages signed by a revoked key fail
   closed even if their cryptographic signature is otherwise valid.
7. Key initialization, rotation, and revocation are offline operator CLI commands. The Web/API
   cannot create or mutate publisher keys. The running Server reloads key state only on restart.
   Trusting an external key additionally requires its expected fingerprint from a separate,
   authenticated channel.
8. When the keyring is not configured, existing exports remain explicitly unsigned. When a keyring
   is explicitly configured but invalid, Server startup fails; it must never silently downgrade to
   unsigned export.
9. When a signer is configured, export returns a DSSE envelope and a DSSE-specific filename and
   media type. Import first distinguishes a strict unsigned document from a DSSE envelope. A signed
   envelope is parsed only after a configured active or retired key verifies it.
10. Both signed and unsigned imports remain read-only quarantine previews. Verification never
    creates an Employee, enables a skill, binds a host, or grants authority.
11. The trust store is local policy. Cross-user trust enrollment, key endorsement, TUF continuity,
    Sigstore identity/transparency, native keyrings, and KMS are future adapters.

ADR-0025 later adds a separate Owner-reviewed activation command. It does not change this decision:
signature verification and preview themselves remain read-only and never grant authority.

## Consequences

- A copied Employee can prove it was signed by a key the receiving Server already trusts, but it
  cannot prove a human-readable identity without an external trust-distribution system.
- Backups must include the keyring and passphrase through separate protected channels. Losing the
  active private key prevents new signed exports but does not erase previously imported Employees.
- Rotation is intentionally restart-bound in this phase; this avoids mutable key state inside a
  long-running signing process.
- The portable DSSE format remains stable if a future adapter moves private keys to an OS keyring,
  hardware token, KMS, or keyless signer.

## Verification plan

- Unit tests generate and decrypt an encrypted keyring, derive deterministic public-key
  fingerprints, rotate keys, retain historical verification, revoke keys, reject active-key
  revocation, reject unsafe permissions and symlinks, and require a matching out-of-band fingerprint
  for external trust.
- HTTP tests cover signed export, trusted quarantine preview, untrusted-signature rejection, and
  unsigned backward compatibility. Existing DSSE fixtures continue to cover tampering, algorithm
  confusion, payload-type confusion, checksum mismatch, malformed envelopes, and unauthenticated
  envelope key hints.
- The full repository check and an operator CLI round trip must pass before the slice is committed.
- Linux CI and local macOS exercise the portable file adapter; no native keyring or public identity
  claim is made by this decision.
