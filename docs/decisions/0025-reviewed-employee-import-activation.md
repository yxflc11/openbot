# ADR-0025: Reviewed Employee import activation

Status: Accepted — 2026-09-04

## Context

OpenBot can export an identity-free Employee template and inspect unsigned or trusted DSSE packages
without side effects. It cannot yet turn an Owner-reviewed package into a local Employee. The next
step must preserve the current trust boundary: a portable Employee describes configuration and
skills, but carries no identity, credentials, memory, history, host binding, or authority.

Preview and activation also need a stable binding. Reviewing one canonical package or authenticated
publisher while activating another would make the preview meaningless. Cosmetic JSON whitespace is
not package identity. Retries must be safe, and one portable package must not silently create
several Employees on the same Server.

The upstream comparison is recorded in
[the research note](../research/reviewed-employee-import-activation.md).

## Upstream review

- Backstage `v1.51.0` supplies a maintained preview → review → create journey and a true dry-run
  contract without persistence.
- Kubernetes `v1.36.2` supplies the mature API meaning of dry run: run validation while guaranteeing
  no persisted change or side effect.
- OpenClaw `v2026.7.1-2` treats third-party skills as untrusted and favors explicit approval before
  installation or execution.
- in-toto Attestation Framework `v1.2.0` identifies immutable subjects by digest, while Cosign
  `v3.1.2` verifies both blob content and expected signer identity; both corroborate the follow-up
  review-binding audit.
- OmniScientist-V2 provides corroborating quarantine behavior but lacks the release and adoption
  evidence required to lead this decision.
- The existing OpenBot PostgreSQL store already supplies the exact transaction, uniqueness, skill
  graph, audit, and profile primitives required by this domain.

All exact repositories, reviewed locations, licenses, and rejected choices are recorded in the
linked research note.

## Reuse decision

Adopt Backstage's three-stage journey, Kubernetes no-side-effect preview semantics, and OpenClaw's
default-untrusted skill behavior. Reuse OpenBot's package validator, DSSE verifier, PostgreSQL
transaction layer, and Employee profile model. Implement only the OpenBot-specific atomic activation
and receipt gap; do not add Backstage, Kubernetes, or OpenClaw as runtime dependencies.

## Source incorporation

No upstream source is copied or substantially adapted. OpenBot implements independently against its
own public protocol and store interfaces. Required upstream links and licenses are recorded in the
research note and reuse ledger.

## Verification plan

- Unit and HTTP integration tests cover exact package-id and canonical SHA-256 digest binding,
  explicit Owner review, signed and explicitly accepted unsigned activation, trusted-publisher
  substitution rejection, fresh identity, candidate-only skills, no imported authority, and
  idempotent replay.
- Negative tests cover changed content, blocked previews, conflicting receipts, reused idempotency
  keys, conflicting skill definitions, unsigned activation without risk acceptance, and untrusted
  or revoked signatures.
- A disposable real PostgreSQL database must apply every migration and complete one activation
  round trip before merge.
- English-first documentation plus maintained Simplified Chinese translations describe the Owner
  journey and its remaining trust limits.

## Decision

1. `POST /api/v1/employees/import/preview` remains a no-side-effect operation. Its response includes
   the canonical package SHA-256 digest that activation must echo.
2. `POST /api/v1/employees/import/activate` accepts the package, reviewed package id and digest,
   `ownerReviewed: true`, a UUID idempotency key, and an explicit unsigned-risk acceptance when the
   package has no trusted DSSE publisher.
3. Activation repeats the same strict parsing, signature verification, checksum inspection, and
   current-host compatibility checks. Any issue blocks before the persistence transaction begins.
4. The transaction creates a fresh Bot id and Owner-local name, copies only role, appearance, and
   recommended execution profile, and creates one append-only `imported` evolution event.
5. Every imported skill is assigned as `candidate` with confidence `0` and source `imported`.
   Dependencies remain a graph among imported skill definitions. No imported skill is executable or
   verified until a later, separate Owner review.
6. Activation imports no source identity, ownership, memories, runs, artifacts, decisions,
   approvals, credentials, sessions, Node bindings, capability grants, or other authority.
7. An immutable receipt records package id, digest, created Employee id, signature state, publisher
   key id when trusted, reviewer, review time, imported skill count, and idempotency key.
8. Package id and idempotency key are unique per Server. Ordered transaction-scoped advisory locks
   serialize concurrent requests for either value. An exact idempotent replay returns the original
   result; a changed request with the same key or a second activation of the package fails.
9. A receiving user who wants another local copy must export a fresh package with a new package id.
10. Public registry installation, publisher identity distribution, package update semantics, and
    automatic skill verification are outside this decision.

## Consequences

- Owners gain a complete, auditable download/copy/activate loop without turning portable data into
  ambient authority.
- A package can be activated only while the receiving Server satisfies the current compatibility
  policy; disconnected future hardware cannot be pre-provisioned in this phase.
- The receipt table adds durable state and therefore requires a forward-only migration and backup.
- Imported skill definitions may conflict with an existing `(slug, version)` definition; OpenBot
  fails the whole transaction instead of silently merging different content.
- Package ids become single-use installation artifacts on each Server, which makes retries safe but
  postpones package-family/update semantics to the registry phase.
