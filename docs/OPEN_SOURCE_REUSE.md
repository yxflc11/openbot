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
| Agent/UI event protocol candidate | [AG-UI `faee4b13`](https://github.com/ag-ui-protocol/ag-ui/tree/faee4b13eabee191d9974f6b19a91b5668268995) | MIT | Evaluated for future agent-to-user event interoperability. Deferred: current work is the security-sensitive Server/Worker Host protocol, not an agent UI transport migration. No dependency or source was added. |
| Office visualization | Public Tencent Marvis product imagery supplied by the project owner | No reusable source-code license identified | Visual inspiration only. No Marvis code or assets are incorporated; the office remains a deferred optional plugin. |

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
- Protocol `0.7.0` now sends exact capability-major requirements in each Run offer. Both Server and
  Worker Host reject missing or incompatible versions; legacy aliases cannot silently downgrade the
  contract.
- Provider declarations are checked before a Node starts, and packages without `execute` are not
  advertised as executable.
- Named Windows, macOS, and Linux routing scenarios distinguish simulated contract coverage from
  real-device support. See [Provider conformance](PROVIDER_CONFORMANCE.md).

## Known gaps from the audit

- Current skill records describe an employee capability; they do not yet store or execute a
  standards-compliant skill directory.
- The skill proposal queue needs expiry/supersession, notification, and full-diff review before
  autonomous learning is enabled.
- A skill archive needs path-traversal, symlink, decompression-size, executable-content, license,
  provenance, signature, and static-analysis checks.
- The official `skills-ref` validator requires Python 3.11+. Integration should run in an isolated
  inspection Worker, not inside the authoritative Server process.
- Provider integrations still need hermetic execution suites, machine-readable reports, and
  repeatable real-device CI before a platform is marked supported or certified.

## Pull-request evidence

Every non-trivial feature pull request must link its research note or ADR and answer:

- What upstream implementation or standard was evaluated?
- Why is dependency, adapter, fork, or local gap implementation the right choice?
- Which version and license were reviewed?
- Was any source copied or substantially adapted, and where is its notice?
- How does the change fail closed if the upstream is missing, incompatible, or compromised?
