# Provider conformance

[English](PROVIDER_CONFORMANCE.md) · [简体中文](PROVIDER_CONFORMANCE.zh-CN.md)

OpenBot publishes executable checks before it describes a platform or Provider as supported. The
shape follows the scenario-driven approach used by the MCP conformance suite and the explicit
platform claims used by the OCI runtime specification, but the fixtures are OpenBot-specific. No
MCP or OCI implementation code is copied.

## What is checked today

Protocol `0.7.0` carries both temporary legacy capability aliases and an authoritative versioned
manifest. Every Run offer contains exact capability-major requirements. Server routing and the
Worker Host independently verify the same requirements.

- A matching legacy alias cannot replace a missing versioned capability.
- `browser.observe@2` cannot silently satisfy a Run requiring `browser.observe@1`.
- A platform-specific profile cannot run on a different operating system.
- A full-capacity Worker Host cannot receive another Run.
- Declaration-only Providers are never advertised as executable.
- Provider declarations fail startup validation when ids, platforms, or capability ownership are
  internally inconsistent.

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
| Supported | Maintainers run the integration suite on named real OS versions and publish known limitations | Real-device CI evidence and security review |
| Certified | A pinned release passes the full matrix with signed packages, upgrade/rollback checks, and no unapproved expected failures | Release-attached conformance report |

`experimental`, `supported`, and `certified` are release support labels. Passing declaration or
routing tests alone never grants one of those labels.

## Current honest status

| Provider | Declaration | Routed | Integrated | Support claim |
| --- | --- | --- | --- | --- |
| Docker/browser adapter | Passes | Simulated Windows/macOS/Linux routes pass | Read-only navigate + PNG screenshot vertical slice | Pre-alpha development slice |
| Cua | Passes | macOS declaration scenario passes | Not implemented in this repository | None |
| Lume | Passes | Requirements are defined | Not implemented in this repository | None |
| Coder | Passes | Simulated Linux arm64 route passes | Not implemented in this repository | None |

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
6. Document optional licenses, privileged dependencies, and expected failures. An expected failure
   is visible debt, never silent success.

Future releases will emit a machine-readable report and support an explicit expected-failures file
for platform defects. Until that runner exists, the Vitest scenario tables are the executable
source of truth.
