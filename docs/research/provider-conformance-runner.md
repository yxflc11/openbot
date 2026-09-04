# Research: Provider conformance scenario runner

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pending
- Acceptance journey: a Provider maintainer runs one bounded suite outside the Server process; every
  scenario finishes, fails, or times out; the runner emits one deterministic
  `openbot.provider-conformance/v1` report and a fail-closed process outcome suitable for hermetic or
  named real-device evidence.
- Security boundary: scenario and Provider code execute as untrusted test workloads in a dedicated
  process and OS account. The runner does not sandbox arbitrary native code, grant Server authority,
  certify a platform, upload artifacts, or make raw exceptions safe. Real-device operators must use
  disposable or dedicated hosts with no Owner browser profile or unrelated credentials.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `modelcontextprotocol conformance runner CLI report expected failures source`,
  `opencontainers runtime-tools validation command conformance report source`, `Sonobuoy plugin
  results conformance runner source releases`, and `Vitest programmatic runner timeout reporter`.
- Standards and primary documentation queries: stable scenario/check identifiers, suite selection,
  lifecycle cleanup, per-scenario timeout, expected-failure exit behavior, target metadata,
  deterministic machine-readable results, and real-device reproduction evidence.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0015,
  `docs/PROVIDER_CONFORMANCE.md`, `openbot.provider-conformance/v1`,
  `buildProviderConformanceReport`, the Provider SDK declaration checks, the existing Vitest
  scenarios, and the MCP/Kubernetes/OCI conformance entries in `docs/OPEN_SOURCE_REUSE.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| MCP Conformance runner | [`74edef34`](https://github.com/modelcontextprotocol/conformance/tree/74edef34d674f563537be8c6587cebaa58e830ca) | New code Apache-2.0; remaining historical code MIT; docs CC-BY-4.0 | Active scenarios, stable check ids, suite filtering, timeouts, result files, and expected-failure baselines | Strong lifecycle and regression model, but its transports, wire schema, subprocess contract, and checks are MCP-specific | Adapt patterns only; do not depend on or copy it |
| OCI runtime-tools validation | [`8a4db579`](https://github.com/opencontainers/runtime-tools/tree/8a4db579f5c88af5a0d036fad34bddc9c1f703f3) | Apache-2.0 | Large executable validation suite with selectable tests, TAP output, and non-zero failure behavior; project remains public but evolves slowly | Good proof that target-scoped executable checks should be independently consumable; tightly coupled to the OCI runtime CLI and Linux privileges | Adapt platform-scoped executable evidence only |
| Sonobuoy plugin runner | [`v0.57.2` / `cc22d58`](https://github.com/vmware-tanzu/sonobuoy/tree/v0.57.2) | Apache-2.0 | Released cross-platform CLI with plugin lifecycle, progress, result retrieval, and Kubernetes conformance use | Strong remote collection model, but requires a Kubernetes cluster, admin credentials, images, and cleanup resources far beyond a Worker Host test | Reject as a runtime dependency; retain as future fleet-collection prior art |
| Vitest custom runner/reporters | [`4.1.11`](https://github.com/vitest-dev/vitest/tree/v4.1.11) | MIT | Already pinned and used throughout OpenBot with active upstream tests | Excellent for repository unit/integration tests, but a Vitest result is not the public Provider report and its worker lifecycle does not describe real-device target identity | Keep for testing the runner, not as its public runtime contract |
| Existing Provider SDK plus Node.js primitives | Current OpenBot branch; Node.js `22.22.2` baseline | MIT | Existing strict schema, deterministic builder/serializer, declaration tests, `AbortController`, and timers are already in the supported runtime | Smallest boundary; keeps OpenBot authority and report semantics local, adds no dependency, and can run in a dedicated process on all target OSes | Select; implement only the missing orchestration gap |

## Reuse decision

- Selected option: OpenBot-specific local gap on top of the existing released/pinned runtime and SDK.
- Selected upstream or standard: adapt MCP's stable scenario/lifecycle/timeout and expected-failure
  behavior, OCI's target-scoped executable checks, and Sonobuoy's separation between execution and
  evidence collection. Keep OpenBot's existing report schema authoritative.
- Why this is the first viable option: no reviewed runner executes the `ComputerProvider` contract
  or produces `openbot.provider-conformance/v1`. Adapting any candidate would import a second
  protocol, deployment control plane, or privileged cluster dependency. The missing code is narrow
  orchestration around existing typed APIs.
- Exact OpenBot-specific gap: define a strict bounded suite/scenario API; execute isolated scenarios
  sequentially with per-scenario deadlines and abort signals; always attempt bounded cleanup; map
  only allowlisted outcomes into report checks; suppress raw thrown values; and return a deterministic
  report plus a baseline-derived exit decision.
- Upgrade, replacement, or exit plan: scenario/report contracts stay in OpenBot packages. If an
  upstream adopts the `ComputerProvider` API or a protocol-neutral runner becomes viable, replace
  the orchestrator behind the same suite interface after a pinned compatibility/security review.
- Failure behavior when the upstream is missing, incompatible, or compromised: there is no runtime
  upstream. Invalid suite/provider/target input stops before execution. Setup, timeout, thrown value,
  invalid outcome, and cleanup failure become required failures or a harness error; none are skipped.
  Failure to serialize or persist evidence exits without a passing result.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: no source or test text will be copied. The implementation uses the
  patterns described above and the existing OpenBot SDK/report contracts.
- Required copyright or license notice location: none; no upstream source is incorporated.

## Verification plan

- Automated tests: deterministic scenario order; successful report; explicit scenario failure;
  thrown non-Error values; timeout and abort; cleanup after success/failure/timeout; cleanup failure;
  duplicate/reserved ids; bounded suite inputs; expected and stale failures; and deterministic
  serialization.
- Negative and fail-closed tests: a missing executable Provider, unsupported target, invalid target
  evidence, scenario timeout, malformed returned result, or cleanup failure cannot produce a passing
  required check. Raw exception text must not appear in report JSON.
- Platforms and devices: unit fixtures run in the hosted Linux x64, Windows x64, and macOS arm64
  matrix after G1 is observed. Hermetic Provider suites come next. Real-device reports require named
  OS version, architecture, hardware identity reference, Worker Host/Provider version, and a
  dedicated account; this record does not provision that fleet.
- User-visible documentation and translations: update the English and Simplified Chinese Provider
  conformance guide, execution plan, research index, and contributor task when the runner lands.
- Support level that the evidence permits: a runner unit test proves only runner behavior. A
  hermetic report proves only the named integration. A real-device report remains evidence requiring
  maintainer review; none of these automatically grants `Supported` or `Certified`.

## Unresolved questions

- Real-device runner ownership, enrollment, physical security, network isolation, wipe/restore,
  evidence retention, signing, and cost need Owner-provided infrastructure and a separate threat
  model before remote machines are attached.
- Process-level isolation cannot contain a malicious native Provider on its own. Executable skill
  sandboxing and production Provider containment remain later milestones; conformance hosts must be
  dedicated and treated as disposable.
