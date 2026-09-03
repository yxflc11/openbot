# ADR-0014: DSSE envelopes for portable employee packages

Status: Accepted — 2026-09-04

Implementation note: ADR-0024 now supplies the Owner key lifecycle and HTTP adapter that this
decision intentionally deferred. The DSSE format and trust constraints below remain unchanged.

## Context

`openbot.employee/v1` deliberately started as a checksum-protected, identity-free template. A
checksum detects accidental changes but cannot identify a publisher. Downloading, copying, and
eventually transferring an Employee requires cryptographic authenticity without coupling the
portable knowledge package to a Worker Host, credential, or capability grant.

The design must authenticate the exact bytes consumed by the importer, support offline
verification, and leave key ownership and trust policy under the receiving OpenBot Server.

## Upstream review

- [DSSE 1.0.2](https://github.com/secure-systems-lab/dsse/tree/1d3370f62565bca041e97c8310b873ac340edc2e)
  is an Apache-2.0 standard for authenticating arbitrary payload bytes together with an
  application-specific type. It avoids JSON canonicalization and explicitly treats `keyid` as an
  unauthenticated lookup hint.
- [Sigstore JS](https://github.com/sigstore/sigstore-js/tree/769a53d8713248a8bf49edfc2a5d1955b0dcc24d)
  is Apache-2.0 and publishes `@sigstore/core`. OpenBot pins `4.0.1` and uses its maintained DSSE
  pre-authentication encoding instead of reimplementing that algorithm.
- [in-toto Attestation v1.2](https://github.com/in-toto/attestation/tree/2dcd055e9f72e746687c306e35f4e59720ff45be)
  models publisher and build provenance. It is suitable for a future provenance attestation, but
  wrapping the employee document in a generic software-build Statement would add no trust by
  itself.
- Sigstore Bundle 0.3 can later add short-lived identity certificates, timestamps, and transparency
  log evidence. TUF can later protect a public Employee registry and publisher-key rotation. Neither
  belongs in the first offline, self-hosted signing primitive.

No upstream source is copied into OpenBot.

## Decision

1. A signed template is a standard DSSE JSON envelope whose `payloadType` is
   `application/vnd.openbot.employee.v1+json`.
2. The envelope payload is the exact UTF-8 serialization of the strict employee package. The same
   decoded bytes that pass signature verification are passed once to UTF-8 and JSON parsing.
3. The initial offline algorithm is Ed25519. Algorithm choice and trusted public keys are configured
   out of band by the Server; private keys never enter an Employee package.
4. The authenticated inner package records `signature.status`, `algorithm`, and `keyid`. A verifier
   accepts it only when that inner key id names a configured public key that actually verified.
5. The outer DSSE `keyid` never grants trust and may be ignored or modified without changing the
   verification decision.
6. Verification order is: bounded envelope parse, signature verification over exact bytes, payload
   type check, fatal UTF-8 decode, strict employee schema, checksum, then authenticated signature
   metadata consistency.
7. Unknown DSSE envelope fields are accepted for forward compatibility; unknown employee-package
   fields remain rejected.
8. This change provides a tested library primitive only. The existing HTTP export remains unsigned
   until an Owner key lifecycle, encrypted storage, rotation, revocation, backup, and explicit trust
   policy exist.

## Consequences

- Semantic reserialization after signing invalidates the signature, even if the parsed JSON would
  look equivalent.
- An attacker cannot gain trust by changing an envelope key hint or by recomputing the existing
  checksum.
- A signed package still carries no source Employee identity, credentials, sessions, host binding,
  approvals, or authority.
- Keyless publishing and public registry distribution can be added later as separate Sigstore and
  TUF adapters without changing the Server's Employee or authorization model.
