# Research: reviewed Agent Skills content

- Status: Accepted for implementation
- Date: 2026-09-08
- Owner: @yxflc11
- Related issue: follow-up to PR #19
- Acceptance journey: Owner imports a single SKILL.md, reviews its full immutable content, verifies it, and a native task discovers/reads it; suspension prevents subsequent use and publication.
- Security boundary: Server owns assignment, review, tool availability and publication. Skill text is untrusted model context; it cannot grant a tool, read a file or add a network target.

## Search evidence

GitHub and primary-documentation queries: `agentskills SKILL.md specification integration security allowed-tools`, `agentskills skills-ref validation`, `eemeli yaml releases issues`. Reviewed existing reuse-ledger rows for portable format, skill write review and reviewed memory, plus `employee-package.ts`, `postgres-store.ts`, `native-agent.ts` and the Owner skill review surface.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| [Agent Skills](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379) | 69ef37e9424c0a7ea9dd2293b559e43ec8176379 | Apache-2.0 code / CC-BY-4.0 documentation | Specification, skills-ref tests; issue #144 discusses experimental allowed-tools typing | Standard frontmatter and progressive discovery; no authority protocol | First viable open standard, single-file subset |
| [skills-ref](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref/README.md) | same commit | Apache-2.0 | Upstream explicitly labels it demonstration-only, not for production | Python subprocess is unnecessary for this Node Server boundary | Reference only |
| [yaml](https://github.com/eemeli/yaml/tree/ddb21b04cb889722cec8f89dc1b67f19d62d7f7d) | 2.9.0 / ddb21b04cb889722cec8f89dc1b67f19d62d7f7d | ISC | Released May 11; YAML/JSON suites, parser/alias tests, no runtime dependencies; inspected Document.toJS and open issues #703, #704, #708, #709 | Node >=14.6; AST permits rejection of aliases, anchors, tags and complex keys before conversion | Released parser with a narrow validation adapter |
| Existing OpenBot review/runtime | f26a3c3e28486ba2989f54839c278406a00388c8 | MIT | PostgreSQL lifecycle and bounded ToolLoopAgent tests | Already owns identity, verification, cancellation and publication | Extend this adapter, no second skill executor |

## Reuse decision

Use the standard plus yaml 2.9.0. Reject raw CR (normalize CRLF), U+2028/U+2029 and C0 controls before parsing to avoid upstream #709/#703 paths. Frontmatter is at most 4 KiB; reject directives, tags, aliases, anchors, duplicate/unknown fields and non-string metadata. The whole immutable single file is at most 12 KiB and JSON-encoded tool output stays below 16 KiB. No archive, scripts, references or filesystem import. Optional allowed-tools remains descriptive and grants nothing.

Store immutable content/hash on the versioned definition. Existing metadata-only records remain unchanged. Verification of content requires its exact SHA-256; each assignment state transition increments a revision, so pause/resume cannot revive an old task snapshot. Native tools offer at most eight bounded descriptors and load at most two full files. Only verified, digest-reviewed assignments without Worker capability or inter-skill dependency requirements are eligible. Snapshot references are checked before/after tools, before model steps and under database locks at final publication. Portability remains metadata-only and explicitly excludes content.

Source copied or substantially adapted: no. Standard concepts and existing local authority are reused; yaml is installed unchanged with its ISC license in dependency notices. New local code is limited to Server storage/review and bounded model integration, which the format/parser do not supply. Keep parser pinned and run negative fixtures before upgrades.

## Verification plan

Parser corruption/bounds/alias/tag tests; stale or missing review digest; other-Bot/candidate/paused/revoked exclusion; pause/resume revision invalidation and completion rollback in real PostgreSQL; official SDK tool-loop fixtures; Owner full-text review UI; complete npm run check and hosted CI. A deterministic model fixture proves routing, not real model skill quality. Maintain English and Chinese documentation. Live public-source acceptance is separate.

## Unresolved questions

Executable scripts, skill-directory resources, skill-body portability and new Worker capabilities remain future milestones. This milestone executes a reviewed instruction workflow through existing tools, not arbitrary code.

## Hosted source acceptance

Retain the existing reviewed source reader unchanged. A separately invoked CI acceptance test reads only `https://example.com/` with real DNS/TLS and the existing bounds; no credentials or inference are used. It is opt-in and skipped by ordinary offline checks. It fails on network or content failure instead of counting fixture output as public-network evidence. Local proxy DNS still maps this target to a reserved range and is rejected.

## Verification completed

Full `npm run check` passed. Direct Server tests with a disposable loopback PostgreSQL passed all
304 tests at the first grouped database checkpoint (25 database cases). Actual built Web at
1280×900 and 390×844 with real Server/database verified candidate import, full-text review consent,
Agent read and completion through an SDK fixture, reload retention and pause invalidation, with
zero page errors and no horizontal overflow. Model inference was deterministic; public HTTPS
remains a separate hosted acceptance test. Production dependency audit reported zero advisories.
