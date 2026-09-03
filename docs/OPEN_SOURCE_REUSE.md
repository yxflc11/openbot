# Open-source-first engineering

[English](OPEN_SOURCE_REUSE.md) · [简体中文](OPEN_SOURCE_REUSE.zh-CN.md)

## Policy

OpenBot researches established open-source implementations before designing a non-trivial feature.
The goal is to reuse maintained standards, libraries, protocols, and narrow services instead of
building another incompatible subsystem.

Research does not mean copying the first repository that looks similar. Every feature intake must
record:

1. the user outcome and security boundary;
2. relevant upstream repositories or open standards;
3. maintenance activity, platform fit, API fit, and test quality;
4. the license of every candidate and any transitive license concern;
5. the chosen action: depend, adapt, contribute upstream, port with attribution, or implement the
   documented gap locally;
6. an upstream version or commit and a replacement/upgrade plan.

When compatible code already solves the problem, OpenBot should use it through its public contract.
Local implementation is appropriate only for OpenBot-specific policy, orchestration, persistence,
or an integration gap that the research note makes explicit.

Unknown, source-available, non-commercial, or otherwise incompatible licenses block incorporation.
Copied or substantially adapted MIT/Apache-licensed code must preserve the required copyright and
license text in `THIRD_PARTY_NOTICES.md` or the relevant vendored directory. Ideas, public APIs, and
interoperability work are still cited so future contributors can understand the design lineage.

## Decision order

Use the first option that meets the acceptance and security requirements:

1. adopt an open standard;
2. use a released dependency or standalone service;
3. write a thin, pinned adapter;
4. contribute a missing general capability upstream;
5. maintain a narrow fork;
6. implement only the remaining OpenBot-specific gap.

No upstream may become a second source of truth for Employee identity, authorization, audit, or
routing. External code executes behind the Server policy boundary and a typed Provider contract.

## Current implementation audit

Audit date: 2026-09-04. Commit pins are research baselines, not automatic dependencies.

This table is also the retroactive review ledger for non-trivial code already present on this
branch. A feature that is not mapped here, in an ADR, or in its issue is blocked from further
expansion until its upstream and license review is recorded.

| OpenBot area | Researched source | License | Decision and current status |
| --- | --- | --- | --- |
| Employee evolution and learning graph | [NousResearch/hermes-agent `63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), especially `agent/learning_graph.py` and its skills/memory model | MIT | Adopt the product concepts: skills and memory are distinct, learned skills have provenance and usage evidence, and the profile visualizes their relationships. OpenBot's TypeScript/PostgreSQL implementation is local; no Hermes source has been copied. |
| Skill write review | [Hermes write-approval gate](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/tools/write_approval.py) | MIT | Adapt the pending-review behavior to Server-owned records: new skills are candidates and an authenticated Owner must explicitly verify, suspend, or revoke them. Full skill diffs and queue lifecycle remain planned. |
| Portable skill format | [Agent Skills specification `69ef37e9`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379) and its `skills-ref` validator | Apache-2.0 code; CC-BY-4.0 docs | Adopt the standard rather than invent a skill bundle. Current metadata uses its name and description limits. Executable `SKILL.md` archives and official-validator integration are not implemented yet. |
| Third-party skill safety | [OpenClaw `428fa8e0`](https://github.com/openclaw/openclaw/tree/428fa8e0d3dac835628f6ac6466bb65ce175b249), including quarantined/scanned skill installation guidance | MIT | Adopt default-untrusted import, inspection before activation, containment, and explicit grants. OpenBot currently has read-only employee-package inspection; it cannot activate imported content. |
| Browser computer | [CopilotKit/OpenBot `agent-computer` `257c1280`](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer) | MIT | Use the token-protected HTTP surface through a thin Provider adapter. The upstream process stays separate; no control plane is copied. |
| Cross-platform computer use | [Cua `986b6f25`](https://github.com/trycua/cua/tree/986b6f257b1afddef0cbd4815bb2744eab7eadba) | MIT; optional components have separate terms | Plan a Provider integration for Windows, macOS, and Linux. Do not enable optional AGPL or model components without a separate distribution review. |
| Provider conformance scenarios | [MCP Conformance `74edef34`](https://github.com/modelcontextprotocol/conformance/tree/74edef34d674f563537be8c6587cebaa58e830ca) | License transition: new code Apache-2.0, remaining historical code MIT, documentation CC-BY-4.0 | Adopt named executable scenarios, version-frozen requirements, visible expected failures, and independent checks on both ends of a connection. OpenBot uses local Vitest fixtures for its own protocol; no MCP code or documentation has been copied. |
| Platform conformance claims | [OCI runtime-spec `6999a89a`](https://github.com/opencontainers/runtime-spec/tree/6999a89a76a0329f440d5740497bedb9dd431297) | Apache-2.0 | Adopt the principle that conformance is scoped to an explicit OS/architecture and that a failed required behavior blocks the claim. OpenBot does not implement or copy the OCI runtime contract here. |
| Conformance evidence packaging | [CNCF Kubernetes Conformance `6fc6e660`](https://github.com/cncf/k8s-conformance/tree/6fc6e66092075b7443c9259629b607c15b7876b9) and [OCI runtime-tools `8a4db579`](https://github.com/opencontainers/runtime-tools/tree/8a4db579f5c88af5a0d036fad34bddc9c1f703f3) | Apache-2.0 | Adapt explicit product/target metadata, human-reproducible evidence, machine-readable results, and platform-scoped validation. OpenBot defines a bounded JSON report rather than adopting JUnit or TAP as its public Provider contract; no upstream code is copied. |
| Agent/UI event protocol candidate | [AG-UI `faee4b13`](https://github.com/ag-ui-protocol/ag-ui/tree/faee4b13eabee191d9974f6b19a91b5668268995) | MIT | Evaluated for future agent-to-user event interoperability. Deferred: current work is the security-sensitive Server/Worker Host protocol, not an agent UI transport migration. No dependency or source was added. |
| Accessible profile navigation and modal review | [WAI-ARIA APG `7e4034b2`](https://github.com/w3c/aria-practices/tree/7e4034b262bc0d25332e330d8a582aaf34113829), [React Spectrum `50279a10`](https://github.com/adobe/react-spectrum/tree/50279a10ab998572e240e44aa36f84a15c7c4f99), and [WCAG technique H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102) | W3C Software and Document License; Apache-2.0 | Adopt the standard tab roles/keyboard model and the native modal dialog lifecycle. Keep a thin local React bridge because these fixed controls do not justify a second component/style stack. No upstream source was copied. |
| Contributor intake and review evidence | [OpenClaw `41344e0b`](https://github.com/openclaw/openclaw/tree/41344e0b7dbd5629f797c535c985fd87a323abe5), [Hermes Agent `63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), [MCP `d4a6fc63`](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/d4a6fc63648798ad6dc6daab6f79e73c9df14699), and [GitHub Issue Forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) | MIT; Apache-2.0/CC-BY-4.0; documentation reference | Adapt issue-first routing, priority guidance, platform evidence, structured forms, and AI-assistance disclosure to OpenBot's security boundaries. No template text or source was copied. |
| Research-before-implementation gate | [Rust RFC template `f17e8623`](https://github.com/rust-lang/rfcs/blob/f17e8623ee2e2854570dcdb936a9f4ab08c0fcd4/0000-template.md), [Kubernetes KEP template `6ab9bf71`](https://github.com/kubernetes/enhancements/blob/6ab9bf717d1228928740bdbfe761b6e62b870902/keps/NNNN-kep-template/README.md), [OpenSSF Scorecard workflow `54d8e4d3`](https://github.com/ossf/scorecard-action/blob/54d8e4d3c579f74e35c422a0a18e16bb58ad9426/.github/workflows/scorecards.yml), [actions/checkout `11d5960a`](https://github.com/actions/checkout/tree/11d5960a326750d5838078e36cf38b85af677262), and [actions/setup-node `49933ea5`](https://github.com/actions/setup-node/tree/49933ea5288caeca8642d1e84afbd3f7d6820020) | Apache-2.0/MIT; Apache-2.0; Apache-2.0; MIT; MIT | Adapt checked-in prior art, alternatives, verification, compatibility, and lifecycle evidence to a smaller OpenBot research record. Add a repository instruction and local PR-body gate; pin existing CI actions by commit. No upstream template or source was copied. |
| Employee package authenticity | [DSSE `1d3370f6`](https://github.com/secure-systems-lab/dsse/tree/1d3370f62565bca041e97c8310b873ac340edc2e), [Sigstore JS `769a53d8`](https://github.com/sigstore/sigstore-js/tree/769a53d8713248a8bf49edfc2a5d1955b0dcc24d), and [in-toto Attestation `2dcd055e`](https://github.com/in-toto/attestation/tree/2dcd055e9f72e746687c306e35f4e59720ff45be) | Apache-2.0 | Adopt DSSE and pin `@sigstore/core` 4.0.1 for pre-authentication encoding. OpenBot implements only the package-specific Ed25519 key boundary and strict employee parsing. in-toto/Sigstore provenance and TUF-based distribution remain separate future adapters. No upstream source was copied. |
| Browser control-plane security | [Hono `e2740d5a`](https://github.com/honojs/hono/tree/e2740d5a1bd0b4254e517e3af8b60789284bc7bd) and [OWASP Cheat Sheet Series `b8586414`](https://github.com/OWASP/CheatSheetSeries/tree/b8586414a5c47ae68911edb97d4e7b7bc6301035) | MIT; documentation CC BY-SA 4.0 | Reuse Hono 4.13.5 `secureHeaders`; apply OWASP's Secure/HttpOnly/SameSite, exact-Origin, TLS, and `__Host-` guidance. Remote misconfiguration now fails at startup. No upstream source or text was copied. |
| Realtime overload recovery | [Hono streaming `e2740d5a`](https://github.com/honojs/hono/blob/e2740d5a1bd0b4254e517e3af8b60789284bc7bd/src/utils/stream.ts) | MIT | Keep Hono's backpressure-aware writer and add only the missing OpenBot per-subscriber policy: a 128-event bound, abort on overflow, and authoritative snapshot recovery. No upstream source was copied. |
| Node channel authority and liveness | [`ws` 8.21.3 `c791e707`](https://github.com/websockets/ws/tree/c791e707eab3c13dd9a261d2479c3cc4a49a6fed), [Kubernetes node-heartbeat KEP `e849163a`](https://github.com/kubernetes/enhancements/blob/e849163ac4a0a5241ba626bd9a99820bf1dcd279/keps/sig-node/589-efficient-node-heartbeats/README.md), and [Nomad `482b49bf`](https://github.com/hashicorp/nomad/tree/482b49bf1aec006f089bcfc7e632d8f6ac303e5e) | MIT; Apache-2.0; MPL-2.0 | Reuse `ws` limits and ping/pong; separate liveness reports from Server-owned assignment state. Messages and enrollment time are bounded, duplicate hello is rejected, and silent sockets are terminated. No upstream source was copied. |
| Future per-Node workload identity | [SPIFFE `99470b9a`](https://github.com/spiffe/spiffe/tree/99470b9abc825f14aa364dfa2c3b53b02ba5db5b) and [Tailscale `92ec1026`](https://github.com/tailscale/tailscale/tree/92ec102673bf46d72bab64b0a278b93c01a47f34) | Apache-2.0; BSD-3-Clause | Reviewed for proof-of-possession identity, rotation, and revocation. Deferred until OpenBot defines persisted one-time enrollment and an operator recovery path; the shared development token is not relabeled as production identity. |
| Atomic artifact files | [`npm/write-file-atomic` 8.0.0](https://github.com/npm/write-file-atomic/tree/v8.0.0) | ISC | Use the released dependency for fsync, atomic rename, per-destination serialization, and temporary-file cleanup instead of maintaining those mechanics locally. Final artifact mode remains `0600`; no upstream source was copied. |
| Untrusted PNG validation candidates | [`image-js/fast-png` 8.0.0](https://github.com/image-js/fast-png/tree/v8.0.0) and [`sharp` 0.35.0](https://github.com/lovell/sharp/tree/v0.35.0) | MIT; Apache-2.0 | Defer full decode-and-normalize validation. `fast-png` does not expose an input-pixel resource limit; `sharp` does, but its native package must pass the Server's Linux x64/arm64 packaging matrix first. The current signature check is explicitly not a well-formedness claim. |
| Node protocol input validation | [Zod 4.5.4 `e8e206fa`](https://github.com/colinhacks/zod/tree/e8e206fa33ac5fe7ce20a2beb12d57b1cb3df653), [OWASP Cheat Sheet Series `b8586414`](https://github.com/OWASP/CheatSheetSeries/tree/b8586414a5c47ae68911edb97d4e7b7bc6301035), and [MCP TypeScript SDK `5119ee7f`](https://github.com/modelcontextprotocol/typescript-sdk/tree/5119ee7fd7790e335a3fb60ef36f85334e2a6326) | MIT; documentation CC BY-SA 4.0; MIT | Reuse the existing pinned Zod dependency for strict envelopes and field bounds, and apply OWASP's allowlist/range guidance. OpenBot keeps only the protocol-specific bounded approval-evidence walk; MCP was reviewed as prior art but does not share the Node authority contract. No upstream source was copied. |
| Login rate-limit candidates | [hono-rate-limiter `d593af13`](https://github.com/rhinobase/hono-rate-limiter/tree/d593af1315184fdbd172eb9c90fe9021c134596c) and [express-rate-limit `c8b3c7ff`](https://github.com/express-rate-limit/express-rate-limit/tree/c8b3c7ff26cc285692f275f26624ad8bfa48f2d7) | MIT | Deferred. Neither package can establish a trustworthy remote identity without an authenticated proxy contract. The current small limiter is documented as deployment-scoped; a later adapter must normalize IPv4/IPv6, use shared storage, and fail closed. |
| Office visualization | Public Tencent Marvis product imagery supplied by the project owner | No reusable source-code license identified | Visual inspiration only. No Marvis code or assets are incorporated; the office remains a deferred optional plugin. |

## Retroactive coverage map

The current branch was inventoried on 2026-09-04. “Reviewed” means that the mechanism is mapped to
a pinned entry above; it is not a production-readiness claim. “Partial” blocks expansion of the
named boundary until the missing review is completed.

| Existing code boundary | Coverage | Audit result |
| --- | --- | --- |
| Employee domain, profile, evolution, skills, memory, and package primitives | Reviewed | Hermes, Agent Skills, OpenClaw, DSSE, Sigstore, in-toto, WAI-ARIA, and React Spectrum decisions are recorded. Evolution attribution is explicit in the root README and Employee specification. |
| Server browser sessions, Origin policy, realtime projection, and file artifacts | Reviewed | Hono/OWASP, Hono streaming, `write-file-atomic`, and PNG decoder candidates are recorded; distributed login identity and full PNG normalization remain documented gaps. |
| Node protocol, capability routing, liveness, and configuration | Reviewed | MCP/OCI conformance, `ws`, Kubernetes/Nomad liveness, SPIFFE/Tailscale identity, and strict Zod input decisions are recorded. Per-Node identity remains planned. |
| Provider SDK and current Docker browser adapter | Reviewed | CopilotKit/OpenBot `agent-computer`, Cua, MCP conformance, OCI evidence, and platform claim levels are recorded. Native Provider claims remain limited to their evidence. |
| GitHub contribution and CI surface | Reviewed | Issue forms and RFC/KEP evidence are adapted locally. Existing checkout/setup actions are pinned to reviewed commits with credentials persistence disabled. |
| PostgreSQL store and migration lifecycle | Partial | Application-specific transactions have tests, but migration rollback, backup/restore, and schema-tool replacement require a focused upstream review before expansion. |
| Multi-Server scheduling and event distribution | Partial | The single-process boundary is explicit; a shared queue/event-system comparison is required before adding another Server replica. |
| Office visualization plugin | Deferred | Only public product imagery was supplied; no reusable code license was identified, and this release does not expand the plugin. |

## Findings applied to the current code

- Skill names now use the Agent Skills-compatible lowercase, hyphenated, 64-character subset; skill
  descriptions use the standard 1,024-character limit.
- Candidate, verified, suspended, and revoked are explicit Server-owned states. A client cannot
  create a skill directly as verified.
- Verification requires an authenticated Owner review, produces an append-only evolution event,
  and does not modify Worker Host capabilities, policy, or grants.
- Concurrent creation and state transitions fail as conflicts instead of silently overwriting a
  review.
- The current evidence snapshot is bounded; immutable evolution events retain the review trail.
- Employee imports remain checksum-checked, strict-schema, read-only, and quarantined.
- The Server has a tested DSSE/Ed25519 signing and verification primitive that authenticates the
  exact bytes later parsed as an Employee package. It is not exposed until Owner key lifecycle and
  trust policy are implemented.
- Protocol `0.8.0` now sends exact capability-major requirements in each Run offer. Both Server and
  Worker Host reject missing or incompatible versions; legacy aliases cannot silently downgrade the
  contract.
- Provider declarations are checked before a Node starts, and packages without `execute` are not
  advertised as executable.
- Named Windows, macOS, and Linux routing scenarios distinguish simulated contract coverage from
  real-device support. See [Provider conformance](PROVIDER_CONFORMANCE.md).
- Provider reports now use a strict shared schema and deterministic builder. They bind results to
  an exact target and keep expected failures visible, expiring, and non-conformant; they contain no
  field that can self-grant a support or certification label.
- Employee profile tabs now expose the WAI-ARIA relationships and horizontal keyboard behavior;
  create/import/export dialogs use native modality, Escape handling, focus containment, and focus
  restoration. See [Accessibility baseline](ACCESSIBILITY.md).
- Browser sessions now fail closed for insecure remote origins, reuse Hono security headers, use a
  `__Host-` cookie under HTTPS, and bound every SSE subscriber with snapshot recovery.
- Node WebSockets now have explicit payload and enrollment bounds, compression disabled, ping/pong
  liveness, and fail-closed socket errors. A heartbeat cannot mutate Server-owned Run assignments.
- File-backed artifacts reuse `write-file-atomic` for fsync, rename, and failed-temporary cleanup;
  final files retain verified `0600` permissions.
- Node protocol `0.8.0` rejects unknown message fields, malformed or oversized identity metadata,
  duplicate capabilities, unbounded approval evidence, short/example enrollment secrets, and remote
  plaintext WebSocket configuration.
- Repository instructions, feature-research templates, future-ADR checks, and a tested pull-request
  body gate now require pinned upstream, license, reuse choice, local gap, and source-incorporation
  evidence before a behavior-changing contribution is accepted.
- GitHub Actions in the existing CI workflow are pinned to full reviewed commits and checkout no
  longer persists repository credentials.

## Known gaps from the audit

- Current skill records describe an employee capability; they do not yet store or execute a
  standards-compliant skill directory.
- The skill proposal queue needs expiry/supersession, notification, and full-diff review before
  autonomous learning is enabled.
- A skill archive needs path-traversal, symlink, decompression-size, executable-content, license,
  provenance, signature, and static-analysis checks.
- The official `skills-ref` validator requires Python 3.11+. Integration should run in an isolated
  inspection Worker, not inside the authoritative Server process.
- Provider integrations still need a standalone scenario runner, hermetic execution suites, and
  repeatable real-device CI before a platform is marked supported or certified.
- `npm audit --omit=dev` reports zero production vulnerabilities. The full audit reports four
  moderate findings in the development-only `drizzle-kit -> @esbuild-kit/esm-loader -> esbuild`
  path. OpenBot does not expose Drizzle Studio, and will not apply npm's breaking forced downgrade;
  the migration tooling must be upgraded or replaced after an upstream review.
- Accessibility still needs real screen-reader, forced-colors, zoom/reflow, and custom-overlay
  evidence before OpenBot can make a conformance claim.
- Login throttling is not yet a trusted per-device or distributed boundary. Proxy identity,
  IPv4/IPv6 normalization, shared storage, and lockout-notification semantics remain open.
- Node enrollment still uses one deployment-wide secret. One-time enrollment, per-Node
  proof-of-possession identity, rotation, revocation, replay protection, and persisted
  reconciliation remain open.
- PNG artifacts are size- and signature-checked but are not yet decoded and normalized. The future
  decoder must bound pixels/channels and pass the release architecture matrix. The local artifact
  root is still a trusted operator boundary, not a safe directory shared with untrusted writers.

## Pull-request evidence

Every non-trivial feature pull request must link its research note or ADR and answer:

- What upstream implementation or standard was evaluated?
- Why is dependency, adapter, fork, or local gap implementation the right choice?
- Which version and license were reviewed?
- Was any source copied or substantially adapted, and where is its notice?
- How does the change fail closed if the upstream is missing, incompatible, or compromised?
