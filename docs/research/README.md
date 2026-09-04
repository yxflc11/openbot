# Feature research records

[English](README.md) · [简体中文](README.zh-CN.md)

Every behavior-changing OpenBot feature starts with evidence that maintained open-source code and
standards were considered before local implementation. This directory stores a lightweight record
when an issue or full ADR is not the better home.

Use [the template](TEMPLATE.md) before implementation. One record should cover one acceptance
journey and should remain useful after the original author leaves. The record is a decision aid,
not a star-count contest: activity, tests, platform fit, permission model, API stability, and
license compatibility matter more than popularity alone.

An issue is sufficient when it contains every template field and remains permanently linkable. Use
an ADR when the choice changes a public contract, trust boundary, persistence format, dependency,
or long-lived architecture. Tiny spelling, translation, and mechanical formatting changes do not
need a record.

Implementation may start only after the record identifies one of these decisions:

1. adopt an open standard;
2. depend on a released package or separate service;
3. write a thin adapter pinned to an upstream contract;
4. contribute the general gap upstream;
5. maintain a narrow fork with an update plan;
6. implement the precisely documented OpenBot-specific gap.

No-result research must include the date, actual queries, repositories inspected, and the gap that
made them unsuitable. It must not be used to avoid attribution or license review.

Accepted records include [Owner-managed Employee memory](owner-managed-employee-memory.md), which
attributes the evolution/memory direction to Hermes and compares Letta, Mem0, and LangMem before
selecting the existing OpenBot PostgreSQL boundary, and
[Employee profile realtime invalidation](employee-profile-realtime-invalidation.md), which reuses
the current Hono SSE transport while keeping profile content behind authenticated REST. The
[Owner skill review surface](owner-skill-review-surface.md) then maps the already-authoritative
skill lifecycle into an inspectable profile workflow without installing executable code. The
[Employee evolution archive](employee-evolution-archive.md) explicitly credits Hermes and adapts
its truthful dated-journey interaction to OpenBot's append-only Server records. The
[Owner-managed Employee profile details](owner-employee-profile-details.md) review then reuses the
existing revision mutation path and Hermes/Kubernetes conflict semantics for descriptive fields.
The [Portable Employee profile review](portable-employee-profile-review.md) closes the matching
transfer-safety gap by showing that biography inside the existing digest-bound quarantine before
activation.
The [Portable Employee skill disclosure](portable-employee-skill-disclosure.md) then applies the
Agent Skills and OpenClaw review boundary so descriptions and dependencies are visible while every
imported skill remains disabled.
The [Employee export content preview](employee-export-content-preview.md) applies the corresponding
sender-side rule: the exact profile and selected skill metadata are visible before download.
The [Portable Employee skill dependency closure](portable-employee-skill-dependency-closure.md)
then prevents that package from silently dropping a dependency outside the verified export set.
The [Employee export review binding](employee-export-review-binding.md) finally applies HTTP strong
validators so download can serve only the exact package instance the Owner just inspected.
The [Cross-platform Employee export filename](cross-platform-employee-export-filenames.md) review
then applies RFC 6266 and a focused maintained device-name predicate so the advisory download name
remains safe and usable across Windows, macOS, and Linux.
The [POSIX Node credential permission](posix-node-credential-permissions.md) audit then applies
OpenSSH's fail-closed private-key invariant to the existing atomic file adapter, while explicitly
leaving Windows ACLs and native keyrings outside the claim.
The [Artifact read integrity](artifact-read-integrity.md) audit applies OCI descriptor verification
to the already-stored size and SHA-256 so changed screenshot bytes fail before delivery.
The proposed [Cross-platform Node CI baseline](cross-platform-node-ci.md) records explicit hosted
runner families and the evidence boundary before a Windows/macOS/Linux matrix is introduced.
The accepted [Provider conformance scenario runner](provider-conformance-runner.md) then compares
MCP, OCI, Sonobuoy, and the existing Vitest/Provider SDK boundary before adding bounded orchestration
outside the authoritative Server process.
The accepted [Linux Worker Host service and Secret Service](linux-worker-host-service-and-secret-service.md)
review separates headless system service credentials from login-session Secret Service, selecting
a bounded `secret-tool` adapter without a silent backend fallback.
The accepted [Linux Worker Host verifiable archive](linux-worker-host-archive.md) review then fixes
the application bundler, official Node runtime hashes, production SBOM, deterministic manifest,
checksums, and authorized release-provenance boundary before installation scripts are added.
The accepted [Linux Worker Host recoverable install transaction](linux-worker-host-install-transaction.md)
review now fixes the versioned layout, provenance gate, atomic activation, health-bound rollback,
credential separation, and crash-recovery evidence before a privileged installer is exposed.
The accepted [Linux Worker Host privileged bootstrap boundary](linux-worker-host-privileged-bootstrap.md)
then selects a private archive import and one fail-closed shared lease so user-writable path swaps
cannot separate the bytes proved from the bytes extracted or activated.
The accepted [Windows Worker Host service boundary](windows-worker-host-service.md) next selects the
first-party .NET Service lifetime over generic WinSW and `node-windows` wrappers, while keeping
LocalService identity, fixed-child supervision, and native x64 evidence as explicit fail-closed
gates.
The implemented-local [Windows Worker Host build lane](windows-worker-host-build-lane.md) pins the
first-party setup action, exact .NET 10 SDK, locked NuGet restore, explicit Windows x64 runner, and
non-uploading artifact-shape gate around the experimental host source. Hosted and native Windows
execution remain required before any support claim.
The accepted-platform [Windows Worker Host installer](windows-worker-host-installer.md) review then
selects Windows Installer 5.0 standard transactions and prohibits credentials, downloads, custom
actions, mutable paths, or pre-enrollment auto-start. WiX v7 is technically viable but remains
unused until the Owner explicitly decides its OSMF EULA and any fee obligation.
The accepted [macOS Worker Host launchd boundary](macos-worker-host-launchd.md) next selects a
user-approved macOS 13+ `SMAppService` LaunchAgent for the dedicated standard account. A narrow
app-relative native Host remains responsible for Keychain and child containment. The follow-on
[macOS Worker Host configuration and Keychain](macos-worker-host-config-and-keychain.md) review
selects direct Apple Security plus existing Node core/Zod, and replaces immediate `exec` with a
private credential handoff and bounded fixed-child supervisor. Signing, packaging, registration,
TCC, and real-device evidence remain separate gates.
