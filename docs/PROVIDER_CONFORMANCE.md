# Provider conformance

[English](PROVIDER_CONFORMANCE.md) · [简体中文](PROVIDER_CONFORMANCE.zh-CN.md)

OpenBot publishes executable checks before it describes a platform or Provider as supported. The
design adapts stable check ids and explicit expected-failure baselines from
[MCP Conformance `74edef34`](https://github.com/modelcontextprotocol/conformance/tree/74edef34d674f563537be8c6587cebaa58e830ca),
target metadata and reproducible evidence from
[Kubernetes Conformance `6fc6e660`](https://github.com/cncf/k8s-conformance/tree/6fc6e66092075b7443c9259629b607c15b7876b9),
and explicit OS/architecture
scoping from the [OCI runtime specification `6999a89a`](https://github.com/opencontainers/runtime-spec/tree/6999a89a76a0329f440d5740497bedb9dd431297).
The checks and JSON schema are OpenBot-specific; no upstream implementation code is copied.

## What is checked today

Protocol `0.8.0` carries both temporary legacy capability aliases and an authoritative versioned
manifest. Every Run offer contains exact capability-major requirements. Server routing and the
Worker Host independently verify the same requirements.

- A matching legacy alias cannot replace a missing versioned capability.
- `browser.observe@2` cannot silently satisfy a Run requiring `browser.observe@1`.
- A platform-specific profile cannot run on a different operating system.
- A full-capacity Worker Host cannot receive another Run.
- Declaration-only Providers are never advertised as executable.
- Provider declarations fail startup validation when ids, platforms, or capability ownership are
  internally inconsistent.
- `buildProviderConformanceReport` emits a strict, bounded JSON artifact tied to the Provider,
  protocol, suite, platform, architecture, OS version, and evidence level.
- A required prerequisite must fail; it cannot be hidden as skipped. A tracked expected failure
  stays failed and never grants a support label.

The current scenario matrix covers Linux x64 browser execution, Linux arm64 coding, Windows x64
browser execution, macOS arm64 browser execution, macOS arm64 Cua declarations, platform mismatch,
missing manifests, incompatible capability majors, and capacity exhaustion. These are simulated
contract fixtures; they are not a claim that every native Provider is implemented.

## Conformance stages

| Stage | Meaning | Required evidence |
| --- | --- | --- |
| Declaration | Static metadata is well formed | `inspectProviderDeclaration` passes |
| Routed | Server and Node accept only the declared platform and exact capability majors | Shared protocol and routing scenarios pass |
| Integrated | The Provider completes bounded hermetic tasks and emits valid progress, frames, approvals, and artifacts | Provider integration suite passes |
| Real device | The same scenarios run on a named OS version and architecture | `real-device` report with reproducible external evidence |
| Supported | Maintainers approve a pinned Provider release and publish known limitations | Reviewed real-device matrix and security evidence |
| Certified | A pinned release passes the full matrix with signed packages, upgrade/rollback checks, and no unapproved failures | Independent release review and attached reports |

`experimental`, `supported`, and `certified` are release support labels. Passing declaration or
routing tests alone never grants one of those labels.

## Current honest status

| Provider | Declaration | Routed | Integrated | Support claim |
| --- | --- | --- | --- | --- |
| Docker/browser adapter | Passes | Simulated Windows/macOS/Linux routes pass | Read-only navigate + PNG screenshot vertical slice | Pre-alpha development slice |
| Cua | Passes | macOS declaration scenario passes | Not implemented in this repository | None |
| Lume | Passes | Requirements are defined | Not implemented in this repository | None |
| Coder | Passes | Simulated Linux arm64 route passes | Not implemented in this repository | None |

## Machine-readable report

`@openbot/protocol` owns `openbot.provider-conformance/v1`, and `@openbot/provider-sdk` owns the
builder and deterministic serializer. The report deliberately contains no `supported` or
`certified` field: evidence is machine-readable, while release labels remain a maintainer review.

```ts
const report = buildProviderConformanceReport({
  provider,
  providerVersion: "0.1.0",
  stage: "integration",
  suiteVersion: "1.0.0",
  target: {
    platform: "linux",
    architecture: "x64",
    osVersion: "6.8.0",
    evidenceLevel: "hermetic",
  },
  checks: scenarioChecks,
});
```

Each check has a stable id, severity, status, timestamp, bounded references, and bounded evidence.
Raw logs are excluded because they can contain credentials or private content. Summary counts,
baseline findings, and conformance are recomputed by the strict schema so editing JSON cannot turn
a failed check into a passing report.

Expected failures require a tracking issue and expiry. A matching unexpired entry makes the CI
baseline current, but the check remains failed and `summary.conformant` remains `false`. An
unexpected failure, expired entry, missing check, or now-passing check makes the baseline stale.

## Run the current suite

```bash
npm run test --workspace @openbot/protocol
npm run test --workspace @openbot/provider-sdk
npm run test --workspace @openbot/node
npm run test --workspace @openbot/server
```

The full repository gate remains:

```bash
npm run check
```

## Adding a Provider

1. Research an existing maintained implementation and record its pinned version and license in
   [Open-source reuse](OPEN_SOURCE_REUSE.md).
2. Implement a narrow `ComputerProvider`; do not import identity, policy, or routing from the
   upstream project.
3. Declare only platforms that the adapter can actually execute on. Keep unfinished packages
   declaration-only by omitting `execute`.
4. Add positive and negative fixtures for platform, architecture where relevant, exact capability
   majors, capacity, reconnect, and fail-closed behavior.
5. Add hermetic integration tests, then real-device evidence before requesting a support label.
6. Convert scenario results with `buildProviderConformanceReport`, validate them with
   `providerConformanceReportSchema`, and publish the deterministic JSON as CI evidence.
7. Document optional licenses, privileged dependencies, and expected failures. An expected failure
   is visible debt, never silent success.

The schema and builder exist today. The next gap is a standalone runner that executes Provider
scenarios and publishes reports from hermetic and real Windows, macOS, and Linux workers. Until
that runner exists, the Vitest scenario tables remain the executable source of truth.
