# Research: Employee evolution archive

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: An Owner opens an Employee's evolution profile, narrows the immutable history
  by change type, moves through the dated record, and inspects every source and evidence reference
  without exposing raw model chain-of-thought or mutable evidence payloads.
- Security boundary: The authenticated Server profile remains authoritative. The Web only filters
  the returned append-only events and stable references; it cannot manufacture evolution, fetch
  evidence content implicitly, grant Worker Host authority, or reinterpret an installed skill as
  learned.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/NousResearch/hermes-agent evolution skill graph learning UI source`
  - `repo:NousResearch/hermes-agent path:apps/desktop learning_graph`
  - `site:github.com/NousResearch/hermes-agent/blob/main/apps/desktop/src learning graph`
  - `site:github.com/openai/openai-agents-js tracing events timeline source`
- Standards and primary documentation queries:
  - Hermes Desktop Learning Journey and Star Map source;
  - OpenAI Agents JS trace/span hierarchy and sensitive-data controls;
  - native HTML range, select, details, time, and ordered-list semantics already permitted by the
    OpenBot accessibility baseline.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - Employee evolution domain types and PostgreSQL append-only checks;
  - `docs/EMPLOYEE.md`, `docs/OPEN_SOURCE_REUSE.md`, ADR-0026, the current profile timeline, and
    Owner skill review.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Hermes learning graph and Desktop Star Map | [`63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), especially `agent/learning_graph.py`, `apps/desktop/src/app/starmap/time-axis.ts`, and `timeline.tsx` | MIT | Active project with graph, rendering, mutation, and Desktop tests | The explicit inspiration requested by OpenBot's owner. Its truthful time mapping, stable ordering, playback/scrub interaction, and separate skill/memory provenance fit; its filesystem and profile authority do not | Adapt the dated archive interaction and preserve attribution; do not copy the graph runtime |
| OpenAI Agents JS tracing | [`main` inspected 2026-09-04](https://github.com/openai/openai-agents-js/tree/main) | MIT | Maintained SDK with tracing tests and redaction controls | Its trace/span hierarchy and sensitive-data switch are strong future run-record prior art, but traces are not immutable Employee evolution events | Defer to the runtime records phase |
| OpenBot current Employee profile | commit `363d703` plus the current branch | MIT | Typed append-only events, evidence references, strict authenticated profile, Web tests | Already owns identity, audit history, and source references. Only archive exploration is missing | Reuse directly |

## Reuse decision

- Selected option: reuse OpenBot's authoritative events and adapt Hermes' dated journey interaction.
- Selected upstream or standard: Hermes Agent `63279301`, explicitly credited as the inspiration
  for Employee evolution.
- Why this is the first viable option: Hermes already demonstrates that learning should be visible
  as a truthful dated journey with provenance. Adding its runtime or D3 graph would create a second
  profile store and an unnecessary rendering stack, while OpenBot already has the exact immutable
  events to present.
- Exact OpenBot-specific gap: a compact archive with stable chronological ordering, type filters,
  a native dated scrubber, full event timestamp, source identifier, and inspectable evidence
  references. The overview keeps the existing short timeline.
- Upgrade, replacement, or exit plan: when OpenBot adds real skill/memory graph edges, evaluate a
  narrow Hermes Star Map adapter behind the Employee profile contract. Keep this archive as the
  accessible non-canvas fallback.
- Failure behavior when the upstream is missing, incompatible, or compromised: no upstream
  runtime is loaded. Invalid or empty local filters fall back to the complete Server snapshot; no
  filtered view writes state.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no upstream source is copied. OpenBot implements a smaller native
  HTML archive against its own types and existing design system; the Hermes interaction and
  provenance model are cited here and in the public reuse ledger.
- Required copyright or license notice location: citations and the MIT license are recorded in this
  note and `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required for this slice.

## Verification plan

- Automated tests: stable event ordering; all/type filtering; dated cutoff; evidence disclosure;
  empty-result reset; static Employee profile rendering; full Web and repository checks.
- Negative and fail-closed tests: an unknown filter is not accepted by the typed control; missing
  source ids and evidence render without links or implicit network fetches; raw reasoning is never
  added to evolution events.
- Platforms and devices: responsive authenticated Web Client on the existing browser surface. No
  native-client support claim.
- User-visible documentation and translations: update the English canonical README, Employee
  specification, roadmap/reuse ledger, research index, and matching Simplified Chinese documents.
- Support level that the evidence permits: inspect and filter Server-owned evolution history only;
  no autonomous learning or graph relationship claim.

## Unresolved questions

- Evidence-reference navigation needs authenticated, type-specific destinations before references
  can become links.
- Skill/memory graph edges, playback animation, and derived learning scores remain future work and
  must not be inferred from event counts.
