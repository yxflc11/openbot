# Research: Owner skill review surface

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: An Owner opens an Employee's skill graph, inspects the candidate's source,
  version, requirements, dependencies, and evidence references, records a reason, then explicitly
  verifies, suspends, resumes, or permanently revokes it without granting Worker Host authority.
- Security boundary: The existing authenticated Server command remains authoritative. The Web
  cannot install or execute skill files, fabricate evidence payloads, or change host capabilities.
  Revocation is terminal and requires a distinct confirmation step. Conditional Server updates
  reject a decision made against a concurrently changed state.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `hermes-agent skill write approval approve diff dashboard`
  - `openclaw skill approval quarantine install review`
  - `backstage catalog dry run review form approve entity`
  - `letta skills approval candidate verify UI`
- Standards and primary documentation queries:
  - Agent Skills format and validation metadata;
  - native HTML disclosure and form semantics already selected by OpenBot's WAI-ARIA review.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - Employee skill domain types, strict protocol schemas, PostgreSQL conditional transition,
    skill/evolution HTTP tests, Employee profile skill graph, Agent Skills and Hermes rows in
    `docs/OPEN_SOURCE_REUSE.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Hermes write-approval gate | [`63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d) | MIT | Active project; persistent pending store, approve/reject commands, gist and full-diff paths | Direct product inspiration for a visible pending queue and review-before-apply; filesystem implementation is not OpenBot's Server authority model | Adopt review behavior and attribution, not source |
| OpenClaw skill safety/workshop | [`v2026.7.1-2`](https://github.com/openclaw/openclaw/tree/v2026.7.1-2) | MIT | Maintained; bounded pending proposals, scanning, quarantine, explicit lifecycle | Confirms that learning proposals should remain pending and executable installation is separate; no need to embed its gateway or registry | Adopt boundary, not runtime |
| Agent Skills | [`69ef37e9`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379) | Apache-2.0 code; CC-BY-4.0 documentation | Maintained specification with validator and fixtures | Exact future bundle format; current OpenBot records intentionally remain metadata-only | Keep existing metadata compatibility |
| OpenBot current Server lifecycle | commit `7998b0b` plus the current branch | MIT | Strict Zod input, PostgreSQL transactions, conditional transitions, evolution evidence tests | Already provides the authoritative commands and trust boundary; only the Owner-facing review surface is missing | Reuse directly |

## Reuse decision

- Selected option: reuse existing OpenBot lifecycle plus upstream-informed UI adapter
- Selected upstream or standard: Hermes visible pending review, OpenClaw pending/quarantine
  separation, Agent Skills metadata, and the current OpenBot Server command.
- Why this is the first viable option: another skill manager would duplicate identity, persistence,
  and approval state. The local gap is a thin authenticated Web surface over the already tested
  command.
- Exact OpenBot-specific gap: expose full stored metadata/evidence references and valid state
  transitions in the Employee profile; require reason and confidence; make permanent revocation a
  second explicit action; reload through the Server after success/conflict.
- Upgrade, replacement, or exit plan: replace metadata cards with the official Agent Skills bundle
  inspector once archive validation lands; keep the state command and Owner review semantics.
- Failure behavior when the upstream is missing, incompatible, or compromised: no new runtime
  dependency exists. The existing Server rejects invalid transitions and remains usable through its
  documented API.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no upstream source is copied; the UI uses existing OpenBot React,
  domain, API, and style primitives.
- Required copyright or license notice location: upstream links and licenses are recorded here and
  in the reuse ledger.

## Verification plan

- Automated tests: API request shape and response; static accessible skill details; valid actions
  for candidate, verified, suspended, and revoked states; full Web test/build and repository check.
- Negative and fail-closed tests: empty reason, invalid confidence, self-selected terminal restore,
  stale/concurrent transition, and accidental host-authority mutation remain rejected by Server
  schema/store tests.
- Platforms and devices: responsive authenticated Web Client. No native-client claim.
- User-visible documentation and translations: update English Employee/API/README status and
  matching Simplified Chinese documents.
- Support level that the evidence permits: Owner review of persisted skill metadata only, not
  executable Agent Skills installation or autonomous learning.

## Unresolved questions

- Full file diff, scanner findings, license review, evaluation execution, and bounded proposal
  queues remain required before models may propose executable skill bundles.
- A future proposal queue needs an explicit reject state distinct from terminal revocation of an
  already assigned skill.
