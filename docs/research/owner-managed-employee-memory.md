# Research: Owner-managed Employee memory lifecycle

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: not yet filed
- Acceptance journey: an authenticated Owner opens an Employee profile, creates a bounded typed
  memory, edits it without losing a concurrent change, and deletes it only after a second explicit
  confirmation; the profile retains a content-free lifecycle audit and no memory enters an Employee
  package.
- Security boundary: OpenBot Server remains the only memory authority. Models and Worker Hosts
  cannot call this Owner API. Requests are origin-checked and bounded, stale writes fail closed,
  deletion removes memory content, and audit rows never retain memory titles or content.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `Hermes Agent memory_tool MEMORY learning graph`, `Letta memory block update
  delete API`, `Mem0 memory history update delete API`, and `LangMem semantic episodic procedural
  memory delete`.
- Standards and primary documentation queries: PostgreSQL conditional update and transaction
  behavior already selected by ADR-0005; no separate wire standard covers an Owner-managed agent
  memory lifecycle.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0005, ADR-0016, ADR-0020,
  `EMPLOYEE.md`, the Employee profile schema and store, the Hermes attribution, and the employee
  domain row in `OPEN_SOURCE_REUSE.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Hermes Agent | [`63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), after [`v2026.8.31`](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.31) | MIT | Highly active multi-platform agent with memory, learning graph, desktop UI, and extensive tests | Its bounded `add`/`replace`/`remove`, visible memory cards, frozen prompt snapshot, promptware scan, and memory-provider boundary are strong product and safety references. Its Python file store is not an OpenBot Server store. | Adopt visible bounded entries, explicit mutation, and provider separation as behavior; do not copy code or embed the runtime. |
| Letta | [`0.16.7` / `f3332476`](https://github.com/letta-ai/letta/tree/f33324768950e6752f80d6c725873cc92d22f8b2) | Apache-2.0 | Released self-hosted memory-first server with maintained block APIs and tests | Manual block edits are first-class and trigger context recompilation. Its Python service, agent runtime, and block model would create a second authority. | Use as corroboration for Owner-visible editing; reject as a runtime dependency. |
| Mem0 | [`ts-v3.0.5` / `75a37ec9`](https://github.com/mem0ai/mem0/tree/75a37ec93db7278e3bd9aaf2aa3d6e5139e6789d) | Apache-2.0 | Released memory platform and SDK with scoped CRUD, history, and linked deletion | The ID-based update/delete surface and history model fit, but the hosted API or memory engine would duplicate OpenBot persistence and add a new trust boundary. | Adopt stable IDs and lifecycle history as API behavior; reject the runtime dependency. |
| LangMem | [`f8c7ebd6`](https://github.com/langchain-ai/langmem/tree/f8c7ebd6110c124a36995dab645a8cb0eb0b8210) | MIT | Active and tested, but no GitHub release was published at review time | Its semantic, episodic, and procedural taxonomy matches the existing OpenBot schema; automatic deletion is disabled by default. Python/LangGraph coupling does not fit the TypeScript control plane. | Keep the existing typed taxonomy and default-off autonomous mutation; do not import code. |
| Existing OpenBot PostgreSQL store | Current branch after ADR-0025 | MIT | Already covered by migrations, store tests, HTTP tests, and real PostgreSQL verification | It already owns Employee identity and typed memory rows. It lacks bounded commands, optimistic concurrency, and content-free lifecycle audit. | Reuse directly and implement only the local lifecycle gap. |

## Reuse decision

- Selected option: local gap after existing dependency reuse.
- Selected upstream or standard: Hermes visible bounded memory and provider separation, Letta
  Owner-visible editing, Mem0 stable IDs and history, LangMem typed categories/default-off deletion,
  and OpenBot's existing PostgreSQL transaction layer.
- Why this is the first viable option: an external memory runtime would become a second source of
  truth for Employee state. The existing Server schema and database already cover persistence;
  only the safe Owner lifecycle is missing.
- Exact OpenBot-specific gap: strict create/update/delete commands, revision-checked writes,
  reuse of the existing credential/private-key scanner, content-free audit events, and an
  accessible profile editor that never exports memory.
- Upgrade, replacement, or exit plan: a future memory Provider may supply retrieval and autonomous
  proposals behind an adapter. Owner records and policy remain Server-owned, so the provider can be
  replaced without migrating Employee identity or authority.
- Failure behavior when the upstream is missing, incompatible, or compromised: this slice has no
  runtime upstream. Invalid or stale requests return validation/conflict errors without changing
  memory; unavailable storage fails the whole transaction.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: upstream source and documentation were reviewed for behavior only;
  OpenBot uses its existing TypeScript, Zod, Drizzle, Hono, React, and PostgreSQL abstractions.
- Required copyright or license notice location: none beyond links in this record and the reuse
  ledger because no upstream source is incorporated.

## Verification plan

- Automated tests: strict protocol parsing, store create/update/delete, profile projection, HTTP
  status and payloads, and Web memory editor interaction helpers.
- Negative and fail-closed tests: unknown fields, oversized content, illegal portability,
  credential values, cross-Employee memory IDs, stale revisions, repeated delete, and no content
  in lifecycle events.
- Platforms and devices: Server behavior is platform-neutral. This does not raise any Worker Host
  or Provider support level.
- User-visible documentation and translations: update the canonical English Employee, API,
  roadmap, execution plan, and reuse ledger documents with matching Simplified Chinese content
  where a translation exists.
- Support level that the evidence permits: experimental Owner-managed memory metadata and content;
  autonomous model writes, retrieval, prompt injection, selective export, synchronization, and
  Provider adapters remain planned.

## Unresolved questions

- Memory retrieval and autonomous write proposals need a separate upstream review, threat model,
  approval queue, and prompt-injection tests.
- Selective memory export needs per-entry review, redaction, provenance, and recipient policy. This
  lifecycle deliberately keeps every memory out of `openbot.employee/v1`.
