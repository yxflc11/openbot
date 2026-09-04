# Research: Portable Employee skill disclosure

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: Before activating a transferred Employee, an authenticated Owner can read
  every included skill's name, version, required description, dependency slugs, and requested host
  capabilities while the package remains quarantined and the skills remain disabled.
- Security boundary: Skill metadata is untrusted input, not executable content and not a permission
  grant. Preview remains read-only and digest-bound. Activation may create only candidate skills;
  it cannot install `SKILL.md`, execute scripts, approve dependencies, or grant a Worker Host
  capability. Invalid, changed, sensitive, or incompatible packages fail closed.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/agentskills/agentskills skill metadata description dependencies specification`
  - `site:github.com/openclaw/openclaw skill install review permissions dependencies security source`
  - `site:github.com/NousResearch/hermes-agent profile distribution install preview skills cron env manifest`
- Standards and primary documentation queries:
  - Agent Skills format and client guidance at commit `69ef37e9`, especially required `name` and
    `description`, optional compatibility/license metadata, and documented dependencies;
  - OpenClaw skill security guidance at release `v2026.7.1-2`, especially treating third-party
    skills as untrusted code, reading before enablement, and applying policy before install;
  - Hermes profile-distribution manifest review at commit `63279301`;
  - existing OpenBot package schema, quarantine projection, candidate skill lifecycle, and Owner
    skill-review surface.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `docs/research/owner-skill-review-surface.md`;
  - `docs/research/portable-employee-profile-review.md`;
  - `docs/research/reviewed-employee-import-activation.md`;
  - Employee/API specifications, Agent Skills reuse entry, import UI, package inspector, and tests.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Agent Skills specification | [`69ef37e9`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379), especially [`specification.mdx`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/specification.mdx) | Apache-2.0 code; CC-BY-4.0 documentation | Public specification with reference validator and client guidance | The required description is the standard discovery disclosure; compatibility and dependencies inform activation. Its experimental `allowed-tools` field is not an authority model and is not adopted | Adopt required name/description semantics |
| OpenClaw skill review boundary | [`v2026.7.1-2`](https://github.com/openclaw/openclaw/tree/v2026.7.1-2), especially [`docs/tools/skills.md`](https://github.com/openclaw/openclaw/blob/v2026.7.1-2/docs/tools/skills.md) | MIT | Active project with upload/install tests and documented security policy | Explicitly treats third-party skills as untrusted code and requires review before enabling. Its installer and host policy cannot replace OpenBot Server authority | Adapt untrusted-before-enable behavior |
| Existing OpenBot import and skill review | commits through `9c4733b` | MIT | Strict schema, checksum/DSSE, dependency/capability validation, disabled candidate import, and Owner transition tests | Already validates and stores the skill description and dependency graph. The import projection discards the description and the UI hides dependencies, making the confirmation incomplete | Reuse directly and close the projection gap |

## Reuse decision

- Selected option: adopt Agent Skills disclosure semantics and reuse the existing OpenBot
  quarantine, adding only missing fields to its typed projection and review UI.
- Selected upstream or standard: Agent Skills `name`/`description` metadata and OpenClaw's
  untrusted-before-enable security boundary.
- Why this is the first viable option: no new parser, registry, dependency resolver, or installer is
  needed. The canonical OpenBot package already contains the validated data, and activation already
  imports it disabled.
- Exact OpenBot-specific gap: preserve each validated skill description in
  `EmployeeImportPreview` and visibly render it with version, required capabilities, and dependency
  slugs before the Owner checkbox can be used.
- Upgrade, replacement, or exit plan: keep metadata aligned with the pinned Agent Skills format.
  License, compatibility, source URL, executable archive, file diff, scan result, and lockfile need
  their own versioned package-schema review before becoming supported fields.
- Failure behavior when the upstream is missing, incompatible, or compromised: no upstream runtime
  is loaded. OpenBot's strict schema and Server-owned lifecycle remain authoritative; incomplete or
  invalid package metadata fails parsing, and imported skills stay disabled.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no Agent Skills, OpenClaw, or Hermes source is copied. OpenBot
  changes its own domain projection, package inspector, existing React list, tests, and docs.
- Required copyright or license notice location: citations and license decisions are recorded here
  and in `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: package inspection preserves descriptions and dependencies; the import review
  renders description, version, capabilities, dependencies, disabled state, and zero-authority
  language.
- Negative and fail-closed tests: missing/empty/oversized descriptions, duplicate or missing
  dependencies, capability-set mismatch, sensitive text, and changed package bytes remain blocked.
- Platforms and devices: common Server response for Windows, macOS, Linux, and mobile Web clients;
  no native-client or executable-skill claim.
- User-visible documentation and translations: update English canonical Employee/API/reuse docs
  and matching Simplified Chinese documents.
- Support level that the evidence permits: metadata-only skill disclosure for
  `openbot.employee/v1`; no executable skill installation.

## Unresolved questions

- A future package version must define portable license, compatibility, publisher source, file
  digest, and resolved dependency data before executable skills can be considered.
- Full file/source inspection and security scan results remain required before Owner verification.
