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

## Intermediate: machine-readable Provider report

- **Outcome:** a Provider can publish a bounded JSON conformance report tied to an exact platform,
  architecture, Provider version, protocol version, and scenario set.
- **Start in:** `packages/provider-sdk`, `docs/PROVIDER_CONFORMANCE.md`.
- **Research first:** pinned MCP Conformance and OCI conformance report patterns.
- **Acceptance:** strict schema; explicit expected failures; deterministic fixture; unsupported
  behavior lowers the support level; no self-certification.
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

## Advanced: signed Employee package design

- **Outcome:** an ADR and executable fixtures define publisher keys, signature envelope, rotation,
  revocation, expiry, and offline verification for `openbot.employee/v1` or its successor.
- **Start in:** `docs/decisions`, `apps/server/src/employee-package.ts`, `packages/domain`.
- **Research first:** Sigstore, in-toto, DSSE, TUF, and existing agent-package signing work.
- **Acceptance:** test vectors cover tampering, wrong publisher, revoked/expired keys, algorithm
  confusion, downgrade, and unsigned legacy packages; authority still never travels in the package.
- **Out of scope:** activation or ownership transfer.

## Advanced: reviewed Employee activation

- **Outcome:** a quarantined preview can become a new local Employee only through an explicit Owner
  command and immutable review receipt.
- **Start in:** `apps/server`, `packages/db`, `apps/web`.
- **Research first:** supply-chain review queues and transactional import patterns.
- **Acceptance:** fresh Employee id; imported skills disabled; no memory or Worker Host binding;
  idempotency key; audit receipt; concurrent/replayed activation fails closed.
- **Out of scope:** publisher trust automation, cloning an existing local identity, or ownership
  transfer.

## Advanced: per-Node enrollment

- **Outcome:** replace the shared Node token with individually revocable Worker Host credentials.
- **Start in:** `apps/server`, `apps/node`, `packages/protocol`, deployment docs.
- **Research first:** SPIFFE/SPIRE, mTLS bootstrap patterns, short-lived certificate rotation, and
  device enrollment threat models.
- **Acceptance:** one-time enrollment; proof of possession; rotation; revocation; replay tests;
  Server audit; no inbound public Node port.
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
