# Research: Reviewed knowledge in native Agent execution

- Status: Implemented and locally verified
- Date: 2026-09-08
- Owner: OpenBot maintainers
- Acceptance journey: a task proposes one bounded reusable lesson; the Owner reads and edits it,
  accepts or rejects it, explicitly chooses model use, and a later task reads approved memory with
  its revision and source Run. Existing private memories remain unavailable to models by default.
- Security boundary: only Server can retrieve this Bot's explicitly shared records and commit an
  Owner review. Model proposals never modify active memory or authorize new tools.

## Research and candidates

Reviewed GitHub and official sources on 2026-09-07/08, before implementation. Existing ledger entries
for Owner-managed memory, skill review and dependency closure are reviewed and remain applicable.

| Candidate | Exact reviewed version | Evidence and fit | Decision |
| --- | --- | --- | --- |
| Hermes Agent | 63279301bcbdc185c1b07b98a9312eb0c862f26d, after v2026.8.31, MIT | Reviewed tools/memory_tool.py and tools/write_approval.py; staged pending writes, review UX and bounded memory. Issues 55147, 84189 and 84488 expose approval authority/UI gaps; Python file persistence cannot own OpenBot state | Preserve Hermes inspiration; adopt the visible proposal/review journey, not its runtime or default-off gate |
| Letta | 0.16.7 / f33324768950e6752f80d6c725873cc92d22f8b2, Apache-2.0 | Reviewed letta/schemas/block.py: limits, read_only, metadata and typed updates; existing maintained service would duplicate Server authority | Reuse bounded read-only concepts; no added service |
| Agent Skills | specification / 69ef37e9424c0a7ea9dd2293b559e43ec8176379, Apache-2.0 code / CC-BY-4.0 docs | Official specification requires SKILL.md content. OpenBot currently holds skill metadata without executable instructions | Do not claim full skill execution from a description; defer standard body loading |
| PostgreSQL 17 and existing OpenBot memory store | Existing pinned runtime; current OpenBot 4a39d5c | Transactions, row locks, revision checks, Owner-only audit and sensitive text scanner already exist | First viable implementation: thin adapter over existing persistence, no dependency |

Sources: [Hermes approval source](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/tools/write_approval.py),
[Letta block source](https://github.com/letta-ai/letta/blob/f33324768950e6752f80d6c725873cc92d22f8b2/letta/schemas/block.py),
[Agent Skills specification](https://agentskills.io/specification), and
[PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html).

## Narrow local gap and policy

- Add an explicit model-use flag, default false, separate from portability. Only public/internal
  non-secret-reference memory is eligible; no legacy record becomes shared automatically.
- A scoped read tool returns bounded records for the assigned Bot only, plus IDs and revisions.
  Memory remains untrusted data, never tool authority. Content-free Run events retain references.
- One proposal per successfully completed task, at most 50 pending per Bot, strict kind/title/body
  limits and existing credential detection. Failed/cancelled tasks publish no proposal.
- Server-generated proposal/source IDs, atomic task completion and proposal insertion. Owner-only
  review locks the immutable proposal; accept creates one memory and content-free audit in the same
  transaction; reject removes proposed text. Repeated/concurrent reviews cannot create duplicates.
- Review presents the full editable text and an unchecked model-use checkbox. No automatic
  acceptance, background self-modification, secret access, other-Bot read or skill-code execution.
- Disabling/deleting memory prevents later retrieval. Bytes already sent upstream cannot be recalled;
  task evidence records exactly which revision was retrieved. Model usage stays within existing
  tool/step/time limits. Selection is bounded recent records, not semantic search or FTS.

## Verification and replacement

Complete the project before grouped protocol/runtime/store/API/UI tests and npm run check. Verify
old-data defaults, cross-Bot isolation, secret denial, pending invisibility, review races, cancellation
rollback, source provenance, bounded read output and actual built browser approve-to-next-task flow.
Future retrieval providers may replace selection without changing Owner authority or stored IDs.

Source copied or substantially adapted: no. Existing dependency notices apply. Hermes attribution
is preserved; this bounded reviewed-memory loop is not full autonomous skill learning.

## Completed verification

- Full npm run check passed. Server suite with disposable PostgreSQL enabled passed all 273 tests,
  including 22 database integration tests. Review races, pending cap, cross-Bot isolation, private
  defaults, source provenance and cancellation/revocation rollback were exercised.
- Built Web with real Server/database and deterministic model fixtures passed full-text editing,
  default-off opt-in, acceptance, next-task use, revoked-memory exclusion, private-memory exclusion,
  reload retention and 1280x900 / 390x844 layouts with zero page errors.
- Actual skill execution, semantic retrieval and live paid model quality remain unverified.
