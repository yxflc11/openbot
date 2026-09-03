# Research: Employee publisher-key lifecycle

- Status: Accepted for implementation
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: not filed yet
- Acceptance journey: an operator provisions one encrypted Owner publisher key outside the Web
  application, the Server signs an identity-free Employee template, and another Server either
  verifies it against an explicitly trusted public key or rejects it without importing anything.
- Security boundary: private keys never enter PostgreSQL, HTTP, an Employee package, logs, or the
  browser. A public key included with a package never grants itself trust. Missing, malformed,
  revoked, or mismatched key material fails closed.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `sigstore cosign generate-key-pair encrypted private key PKCS8`, `TUF root key
  rotation revoked key specification`, `Notary trust policy trust store signing key plugin`, and
  `Node crypto Ed25519 encrypted PKCS8`.
- Standards and primary documentation queries: DSSE 1.0.2; Sigstore/Cosign key management; TUF key
  management and migration; Notary Project blob trust policy; Node.js 22 crypto key generation.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0014, Employee package tests,
  strict package schemas, quarantine-only import preview, `OPEN_SOURCE_REUSE.md`, the current Server
  configuration boundary, and atomic `0600` file storage.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Sigstore Cosign | [`v3.0.6`](https://github.com/sigstore/cosign/tree/v3.0.6), especially `pkg/cosign/keys.go` | Apache-2.0 | Active release with key, KMS, and signing coverage | Strong model for password-encrypted private-key files, separate public keys, and future KMS adapters; its Go CLI and OCI workflow are not an embeddable TypeScript key store | Adopt the file/KMS separation and encrypted-key behavior; do not copy source or invoke Cosign at runtime |
| TUF specification | [`v1.0.35`](https://github.com/theupdateframework/specification/tree/v1.0.35) | Community Specification License 1.0 | Mature security specification with explicit rotation continuity and revocation | Correct future registry trust-update model; a full repository/root-role implementation is excessive for one self-hosted publisher | Adopt retained public-key history and explicit status; defer threshold/continuity metadata to the registry phase |
| Notary Project specifications | [`v1.1.0`](https://github.com/notaryproject/specifications/tree/v1.1.0) | Apache-2.0 | CNCF project with trust-policy, signature, and plugin specifications | Strong separation of trust material from trust policy and fail-closed verification; its current X.509/OCI model does not match OpenBot's Ed25519 DSSE package | Adopt explicit out-of-band trust and fail-closed policy; do not adopt its envelope or PKI stack |
| Node.js crypto | [`v22.23.2`](https://github.com/nodejs/node/tree/v22.23.2) | MIT | Supported runtime with OpenSSL-backed Ed25519, PKCS#8, SPKI, and encrypted PEM support | Already required by OpenBot and avoids adding a second cryptographic implementation | Reuse directly for key generation, loading, fingerprinting, signing, and verification |
| OpenBot DSSE primitive | ADR-0014 and current branch | MIT | Exact-byte, algorithm-confusion, checksum, malformed envelope, and trust-store tests already exist | Exact package and domain fit | Extend behind a narrow lifecycle service and HTTP adapter |

## Reuse decision

- Selected option: reuse Node.js crypto and the existing DSSE primitive, with a narrow local
  filesystem adapter informed by Cosign, TUF, and Notary trust behavior.
- Selected upstream or standard: Node.js encrypted PKCS#8/SPKI support; DSSE 1.0.2; Cosign's
  encrypted private/public separation; Notary's trust-store/policy separation; TUF's retained key
  history and explicit rotation/revocation concepts.
- Why this is the first viable option: no maintained TypeScript package provides an
  OpenBot-compatible Owner lifecycle without introducing a hosted authority, Go subprocess, OCI
  registry, or X.509 PKI. Node already supplies the cryptographic primitives; the remaining work is
  OpenBot-specific policy and file layout.
- Exact OpenBot-specific gap: bind an Owner-controlled encrypted key to the existing
  `openbot.employee/v1` DSSE primitive, expose signed export and verified quarantine preview, and
  preserve local trust state without ever allowing an Employee package to carry authority.
- Upgrade, replacement, or exit plan: the signer and trust resolver are interfaces. A future
  Cosign KMS, native keyring, Sigstore keyless, or TUF registry adapter can replace the filesystem
  backend without changing Employee packages or HTTP routes.
- Failure behavior when the upstream is missing, incompatible, or compromised: startup refuses an
  explicitly configured but unreadable keyring; export stays visibly unsigned when signing is not
  configured; signed import is rejected when no active, retired, or explicitly trusted key verifies;
  revoked keys are never passed to cryptographic verification.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: public specifications and behavior were reviewed; implementation
  uses Node.js public APIs and existing OpenBot code.
- Required copyright or license notice location: links and licenses are recorded here and in
  `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: create encrypted Ed25519 keyring; deterministic SPKI fingerprint; load active
  signer; rotate while retaining the former public key; require an expected fingerprint before
  trusting a transferred public key; revoke a key; signed HTTP export; trusted signed import preview.
- Negative and fail-closed tests: wrong passphrase, loose permissions, symlinked files, malformed
  manifest, signer/public-key mismatch, untrusted signer, revoked signer, payload tampering,
  algorithm confusion, signed package presented as unsigned, and absent configuration.
- Platforms and devices: file adapter tests on the repository's Linux CI and local macOS; native OS
  keyrings and KMS are separate Providers and not claimed by this slice.
- User-visible documentation and translations: configuration and operator CLI runbook in English
  and Simplified Chinese, status/roadmap update, and reuse ledger entry.
- Support level that the evidence permits: experimental self-hosted signing with an explicit local
  trust store; not a public publisher identity or registry trust claim.

## Unresolved questions

- Public cross-user discovery, key endorsement, recovery after private-key loss, threshold signing,
  transparency, and compromise recovery need a TUF/Sigstore-backed registry design.
- Native Keychain, Windows Credential Manager, Secret Service, and cloud KMS adapters require their
  own platform evidence before replacing the portable encrypted-file backend.
