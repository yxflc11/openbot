# ADR-0015: Provider conformance reports are evidence, not certification

Status: Accepted — 2026-09-04

## Context

OpenBot intends to run Worker Hosts on Windows, macOS, Linux, and later mobile or managed devices.
A Provider declaration and a simulated routing test prove useful contracts, but neither proves that
the Provider can safely operate a real target. Contributors need one bounded artifact that records
what ran, where it ran, and what failed without letting a Provider certify itself.

## Upstream review

- [MCP Conformance `74edef34`](https://github.com/modelcontextprotocol/conformance/tree/74edef34d674f563537be8c6587cebaa58e830ca)
  gives checks stable ids, preserves failure/warning/skip distinctions, and keeps expected failures
  in a separate baseline. Unexpected failures and stale baseline entries both fail CI.
- [CNCF Kubernetes Conformance `6fc6e660`](https://github.com/cncf/k8s-conformance/tree/6fc6e66092075b7443c9259629b607c15b7876b9)
  publishes product metadata, human reproduction instructions, logs, and machine-readable JUnit
  results. A verification bot checks the submission, while certification still requires review.
- [OCI runtime-spec `6999a89a`](https://github.com/opencontainers/runtime-spec/tree/6999a89a76a0329f440d5740497bedb9dd431297)
  scopes behavior to explicit platforms, and
  [OCI runtime-tools `8a4db579`](https://github.com/opencontainers/runtime-tools/tree/8a4db579f5c88af5a0d036fad34bddc9c1f703f3)
  demonstrates machine-consumable TAP results and platform-specific validation.

All reviewed code is Apache-2.0 except the documented MCP repository license transition. OpenBot
adopts the reporting patterns, not upstream source or test contracts.

## Decision

1. `@openbot/protocol` defines a strict, bounded `openbot.provider-conformance/v1` JSON schema.
2. Every report binds the Provider and suite versions to a protocol version, operating system,
   architecture, OS version, stage, and evidence level.
3. Checks have stable ids, severity, status, timestamp, bounded references, and bounded evidence.
   Raw logs are not accepted because they can contain credentials or private user content.
4. The SDK always adds declaration and target-platform checks. Integration also requires an
   executable Provider and non-simulated evidence. Real-device reports require a real-device
   evidence level, known architecture, and concrete OS version.
5. A missing prerequisite for a required check is a failure, not a skip. Required checks can only
   succeed, fail, or warn.
6. Expected failures require an issue URL and expiry. They do not change the check status or
   `summary.conformant`; they only state whether a CI baseline has unexpected or stale debt.
7. The schema recomputes counts, baseline findings, and conformance. Edited JSON cannot make an
   inconsistent passing claim.
8. Reports contain no `supported` or `certified` property. Those remain release labels granted only
   after maintainer or independent review of the required evidence.
9. Serialization is deterministic for reviewable CI artifacts.

## Consequences

- Provider authors can generate a shared artifact now, before a standalone scenario runner exists.
- A known failing check can keep a branch regression baseline current without being described as
  conformant.
- Fixing a baselined failure makes the entry stale, forcing the debt record to be removed.
- Simulated routing evidence remains useful but cannot be mistaken for native platform support.
- The next implementation step is a runner that turns hermetic and real-device scenario execution
  into this report and publishes it with reproduction metadata.
