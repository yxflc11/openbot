# ADR-0031: Provider scenarios run outside the Server and bind real-device evidence

- Status: Accepted
- Date: 2026-09-04

## Context

ADR-0015 introduced a strict `openbot.provider-conformance/v1` report, but contributors still have
to construct scenario results manually. The current real-device target identifies an operating
system version and architecture, which is not enough to reproduce evidence across a changing Worker
Host binary or distinguish a physical test target from an anonymous hosted runner.

A test runner executes Provider code that may be incomplete, compromised, or intentionally failing.
It must not run in the authoritative Server process or turn thrown values and raw logs into public
evidence. At the same time, an expected-failure baseline must remain useful without converting a
known failure into a conformance or support claim.

The upstream comparison and exact pins are recorded in
[Provider conformance scenario runner research](../research/provider-conformance-runner.md).

## Upstream review

- [MCP Conformance `74edef34`](https://github.com/modelcontextprotocol/conformance/tree/74edef34d674f563537be8c6587cebaa58e830ca)
  (Apache-2.0/MIT transition) provides maintained scenario lifecycle, timeouts, stable checks, and
  expiring expected-failure behavior, but its transport and wire contract are MCP-specific.
- [OCI runtime-tools `8a4db579`](https://github.com/opencontainers/runtime-tools/tree/8a4db579f5c88af5a0d036fad34bddc9c1f703f3)
  (Apache-2.0) demonstrates selectable executable checks and target-scoped failure evidence, but is
  coupled to the OCI runtime CLI and Linux privileges.
- [Sonobuoy `v0.57.2`](https://github.com/vmware-tanzu/sonobuoy/tree/v0.57.2)
  (Apache-2.0) is a released plugin runner with progress and result retrieval, but requires a
  Kubernetes control plane, cluster credentials, images, and cleanup resources.
- [Vitest `4.1.11`](https://github.com/vitest-dev/vitest/tree/v4.1.11) (MIT) remains the maintained
  repository test framework; its result protocol is not an OpenBot Provider evidence contract.

## Reuse decision

Implement the precise OpenBot orchestration gap on the existing Provider SDK and Node runtime.
Adopting a reviewed runner would import an unrelated protocol or privileged deployment control
plane. The local package adapts stable scenario ids, lifecycle deadlines, visible expected failures,
and separate evidence collection without copying those implementations.

## Source incorporation

No source or test text is copied or substantially adapted. No new third-party notice is required.

## Verification plan

- Unit tests cover deterministic ordering, success, explicit failure, timeout/abort, generic thrown
  values, cleanup, invalid outcomes, input bounds, expected/stale failures, and serialization.
- Negative tests prove raw exception text cannot enter report JSON and real-device metadata cannot
  be omitted.
- Hosted matrix evidence remains limited to runner portability. Hermetic and real-device Provider
  reports are separate later evidence, and support labels still require maintainer review.
- English conformance and execution documents receive matching Simplified Chinese updates.

## Decision

1. Add a dedicated `@openbot/provider-conformance-runner` package. It depends only on the existing
   OpenBot protocol and Provider SDK contracts and is never imported by the Server.
2. A suite has a stable name/version, target, stage, Provider version, bounded default timeout,
   optional expected-failure baseline, and one to 256 uniquely identified scenarios.
3. Scenarios execute sequentially in stable id order. Each receives an abort signal and has bounded
   setup, execution, and cleanup. Cleanup is attempted after success, failure, or timeout.
4. A thrown value, timeout, malformed result, or cleanup failure becomes a generic required failure.
   Raw exception text and stacks are discarded and never enter the report.
5. Invalid suite configuration is a harness error and stops before Provider execution. The CLI uses
   a distinct non-zero exit from a valid report with unexpected or stale failures.
6. A valid expected failure can keep the regression baseline current, but the underlying check
   remains failed and `summary.conformant` remains false. The runner exit decision follows baseline
   freshness, not a release support label.
7. Extend the report target with optional `workerHostVersion`, `hardwareModel`, and
   `hardwareEvidenceId`. A `real-device` stage requires all three plus real-device evidence level,
   known architecture, and concrete OS version.
8. `hardwareEvidenceId` is an opaque, bounded reference to controlled inventory or an evidence
   bundle. Raw serial numbers, UDIDs, machine credentials, and private inventory data do not belong
   in the public report. The reference cannot grant identity or authority.
9. The runner emits deterministic JSON to a new output file. It does not overwrite evidence,
   upload artifacts, enroll machines, sign claims, or grant `Supported`/`Certified` labels.
10. Dynamic Provider/scenario modules are executable code. The CLI loads them only in its dedicated
    process; operators must use a disposable or dedicated OS account and a separately controlled
    real-device runner. This package is orchestration, not a native-code sandbox.

## Consequences

- Provider maintainers receive one shared, testable path from executable scenarios to the existing
  bounded report format.
- A real-device report becomes reproducible across Worker Host and hardware changes without
  publishing a machine serial number.
- Timeout is cooperative at the library boundary: the abort signal asks Provider code to stop, but
  a malicious native module may ignore it. CI or the device supervisor remains responsible for
  terminating and cleaning the dedicated runner process.
- Existing declaration, routing, and hermetic reports remain compatible because the three new target
  fields are optional outside the real-device stage.
- Real-device evidence still requires maintainer review. Passing the runner cannot certify a
  platform, authorize a Run, or change Server routing.
