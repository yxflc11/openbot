# Research: Portable Employee skill dependency closure

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: When an Owner previews an Employee template, every dependency declared by an
  exported verified skill is present in the same package; otherwise OpenBot names the affected
  skill and blocks download.
- Security boundary: Dependency metadata never grants tools or Worker Host authority. Export must
  fail closed when a verified skill points to a missing, candidate, suspended, or revoked skill.
  The finding must not expose internal skill ids, evidence, memory, or credentials.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/agentskills/agentskills dependency skill metadata SKILL.md requirements`
  - `site:github.com/openclaw/openclaw "requires" "bins" skill eligibility metadata dependencies`
  - `site:github.com/helm/helm chart dependency missing validation package fail`
  - `site:github.com/helm/helm/blob/v4.1.3 "chart metadata is missing these dependencies"`
- Standards and primary documentation queries:
  - Agent Skills specification at commit `69ef37e9`, including its required discovery metadata,
    optional compatibility text, and absence of a standardized skill-to-skill dependency field;
  - Agent Skills distribution discussion #210, reviewed only as an unaccepted proposal for a
    package manifest and lock file;
  - Helm v4.1.3 dependency linter and tests, which compare declared and packaged dependencies in
    both directions and report missing entries;
  - OpenClaw's documented `requires` readiness gate and issue #94727, which demonstrates that an
    incomplete requirement declaration can mark a skill ready until execution fails.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `docs/research/portable-employee-skill-disclosure.md`;
  - `docs/research/employee-export-content-preview.md`;
  - Employee/API specifications, `openbot.employee/v1` schema, package builder, and package tests.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Agent Skills | [`69ef37e9`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379) | Apache-2.0 code; CC-BY-4.0 docs | Maintained specification and reference validator | Defines portable skill discovery metadata and environment compatibility, but not an accepted skill-to-skill dependency contract. Discussion [#210](https://github.com/agentskills/agentskills/discussions/210) is a proposal, not a standard OpenBot can claim to implement | Keep `dependencySlugs` an explicit OpenBot v1 extension |
| Helm dependency lint | [`v4.1.3`](https://github.com/helm/helm/tree/v4.1.3), especially [`dependencies.go`](https://github.com/helm/helm/blob/v4.1.3/internal/chart/v3/lint/rules/dependencies.go) and [`dependencies_test.go`](https://github.com/helm/helm/blob/v4.1.3/internal/chart/v3/lint/rules/dependencies_test.go) | Apache-2.0 | Maintained package manager with direct missing/extra dependency tests | Its two-sided closure rule matches the safety property, but Helm charts, aliases, repositories, and Go implementation do not match Employee packages | Adapt the fail-closed closure invariant |
| OpenClaw skill eligibility | [`v2026.7.1-2`](https://github.com/openclaw/openclaw/tree/v2026.7.1-2) plus source-reproduced issue [`#94727`](https://github.com/openclaw/openclaw/issues/94727) | MIT | Active agent project with skill readiness checks | Shows the concrete failure caused when declared requirements omit something needed at runtime. OpenClaw requirements describe binaries/env/config rather than other skills | Adapt the no-silent-readiness principle |
| Existing OpenBot package builder | commits through `141c364` | MIT | Strict package schema, deterministic verified-skill selection, checksum, scan, quarantine, and tests | Already owns the only safe place to resolve internal skill ids to portable slugs, but silently drops dependency ids that are outside the verified export set | Reuse and close the local projection gap |

## Reuse decision

- Selected option: reuse the existing OpenBot builder and add the missing fail-closed invariant.
- Selected upstream or standard: Agent Skills for the disclosed skill metadata boundary, Helm for
  package dependency closure, and OpenClaw for readiness consistency.
- Why this is the first viable option: no accepted Agent Skills field or compatible package
  resolver can replace OpenBot's Server-owned skill assignment graph. The current builder already
  has the verified set and is the narrow place where source ids become portable slugs.
- Exact OpenBot-specific gap: detect every dependency id of every exported verified skill that
  cannot resolve to another exported verified skill; return a bounded finding keyed by the
  dependent skill slug and block download.
- Upgrade, replacement, or exit plan: if Agent Skills adopts a stable distribution/dependency
  manifest, write a versioned adapter and migration ADR. Keep v1 parsing unchanged until then.
- Failure behavior when the upstream is missing, incompatible, or compromised: no upstream runtime
  participates. OpenBot builds no downloadable package when closure is incomplete; the Owner must
  verify the dependency or remove the relationship locally and preview again.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no Agent Skills, Helm, or OpenClaw source is copied. OpenBot adds a
  domain finding code, a local graph check in its own package builder, tests, and documentation.
- Required copyright or license notice location: citations and licenses are recorded here and in
  `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: a verified skill with a verified dependency exports the dependency slug and
  round-trips unchanged.
- Negative and fail-closed tests: a verified skill depending on a candidate or unknown local skill
  produces one bounded `excluded-skill-dependency` finding and blocks export/download.
- Platforms and devices: pure Server graph validation shared by every Web Client and Worker Host.
- User-visible documentation and translations: update English canonical Employee/API/reuse docs
  and matching Simplified Chinese documents.
- Support level that the evidence permits: dependency-closed metadata-only
  `openbot.employee/v1` templates; no resolver, executable bundle, or Agent Skills package-manager
  compatibility claim.

## Unresolved questions

- `dependencySlugs` is an OpenBot extension until an accepted portable skill distribution standard
  supplies equivalent version and integrity semantics.
- Version ranges, optional dependencies, conflict resolution, cycles, and executable skill archives
  remain outside v1.
