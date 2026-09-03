# Contributor work packages

[English](CONTRIBUTOR_TASKS.md) · [简体中文](CONTRIBUTOR_TASKS.zh-CN.md)

These packages turn roadmap items into independently reviewable contributions. Open an issue from
the matching form before implementation, link the pinned upstream review, and keep every support
claim at the lowest level proven by tests.

## Starter: accessibility regression runner

- **Outcome:** a repeatable report catches keyboard, name/role/state, and high-confidence WCAG
  regressions in the built Web app.
- **Start in:** `apps/web`, `.github/workflows`, `docs/ACCESSIBILITY.md`.
- **Research first:** compare `axe-core`, Playwright accessibility tooling, and maintained Vitest
  integrations; pin versions and licenses.
- **Acceptance:** deterministic local command; CI artifact; no live network; documented false
  positives; one fixture that proves a violation fails the gate.
- **Out of scope:** claiming screen-reader or WCAG conformance from automation alone.

## Starter: translation consistency checker

- **Outcome:** English source docs and maintained locale files cannot silently lose required safety
  warnings, commands, or configuration names.
- **Start in:** `scripts/check-docs.mjs`, `README*.md`, `docs/*.md`.
- **Research first:** evaluate documentation-lint and localization consistency tools before adding
  local rules.
- **Acceptance:** catches a deliberately missing warning/link in a fixture; does not require machine
  translation; prints the exact file and missing contract.
- **Out of scope:** judging prose quality or modifying translations automatically.

## Intermediate: Provider conformance runner

- **Available foundation:** `openbot.provider-conformance/v1`, its strict schema, expected-failure
  semantics, deterministic builder, and unit fixtures are implemented.
- **Outcome:** a standalone runner executes a Provider scenario set and publishes the bounded JSON
  report with reproducible hermetic or real-device evidence.
- **Start in:** a new runner package, `packages/provider-sdk`, Provider integration tests, and
  `.github/workflows`.
- **Research first:** the pinned MCP, Kubernetes, and OCI entries in
  [Open-source reuse](OPEN_SOURCE_REUSE.md), plus current maintained runner libraries.
- **Acceptance:** consumes the shared builder; no raw secrets in artifacts; explicit expected
  failures; expired/stale baselines fail; deterministic fixture; no self-certification.
- **Out of scope:** a hosted certification authority or real-device CI fleet.

## Intermediate: Agent Skills quarantine worker

- **Outcome:** an isolated Worker inspects a bounded skill directory with the official `skills-ref`
  validator and returns findings without installing or executing it.
- **Start in:** a new inspection Provider/Worker, not the Server process.
- **Research first:** Agent Skills validator, OpenClaw quarantine guidance, archive extraction
  libraries, and sandbox options.
- **Acceptance:** path traversal, symlinks, size expansion, unknown files, invalid metadata, and
  validator failure all fail closed; the Server receives only a bounded report.
- **Out of scope:** activation, host grants, autonomous skill execution, or network access.

## Completed baseline: signed Employee package design

- **Delivered:** ADR-0014 and ADR-0024 define the signature envelope, encrypted local keyring,
  explicit trust, rotation, revocation, and offline verification for `openbot.employee/v1`.
- **Start in:** `docs/decisions`, `apps/server/src/employee-package.ts`, `packages/domain`.
- **Research first:** Sigstore, in-toto, DSSE, TUF, and existing agent-package signing work.
- **Remaining contribution:** add native keyring/KMS adapters, publisher-key expiry, TUF continuity,
  and public identity/transparency without changing the DSSE package contract.
- **Still out of scope:** activation or ownership transfer.

## Advanced: reviewed Employee activation

- **Outcome:** a quarantined preview can become a new local Employee only through an explicit Owner
  command and immutable review receipt.
- **Start in:** `apps/server`, `packages/db`, `apps/web`.
- **Research first:** supply-chain review queues and transactional import patterns.
- **Acceptance:** fresh Employee id; imported skills disabled; no memory or Worker Host binding;
  idempotency key; audit receipt; concurrent/replayed activation fails closed.
- **Out of scope:** publisher trust automation, cloning an existing local identity, or ownership
  transfer.

## Advanced: proof-of-possession Node identity

- **Outcome:** replace the current individually revocable bearer credential with a rotatable,
  proof-of-possession Worker Host identity.
- **Start in:** `apps/server`, `apps/node`, `packages/protocol`, deployment docs.
- **Research first:** SPIFFE/SPIRE, mTLS bootstrap patterns, short-lived certificate rotation, and
  device enrollment threat models.
- **Acceptance:** preserve one-time enrollment and revocation; add non-exportable-key support,
  challenge/response, rotation, replay tests, Server audit, and no inbound public Node port.
- **Out of scope:** employee identity or OS account provisioning.

## Platform: native Windows, macOS, or Linux Provider

- **Outcome:** one narrowly scoped native Provider advances from Declared to Integrated with real
  target-platform evidence.
- **Start in:** `providers/<name>`, `packages/provider-sdk`, `docs/CROSS_PLATFORM.md`.
- **Research first:** use the Provider issue form and compare mature OS automation projects before
  writing an adapter.
- **Acceptance:** exact capability majors; hermetic negative cases; real-device report; local OS
  permission diagnostics; approval boundary; bounded artifacts; fail-closed cancellation.
- **Out of scope:** claiming other platforms, arbitrary administrator access, or bypassing Server
  routing and approval.
