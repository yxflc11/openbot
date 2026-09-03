# Research: Portable Employee profile review

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: Before activating a transferred Employee, an authenticated Owner can review
  its name, role, biography, skills, requested capabilities, publisher trust, host compatibility,
  and zero-authority boundary from the Server-generated quarantine preview.
- Security boundary: The preview is descriptive and read-only. Biography text is untrusted package
  content, grants no authority, and cannot change the package digest reviewed by the Owner. Import
  still creates a new identity with no credentials, memories, history, host binding, or enabled
  skills. A blocked, changed, or untrusted package fails closed.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/NousResearch/hermes-agent "profile distribute" manifest credentials memories sessions`
  - `site:github.com/backstage/backstage catalog import preview entity description source`
  - `site:github.com/home-assistant/core config flow import confirm preview source`
- Standards and primary documentation queries:
  - Hermes profile commands and profile-distribution documentation at commit `63279301`, including
    the install manifest preview and the distribution-owned/user-owned separation;
  - Backstage catalog entity description semantics and catalog import analysis at v1.51.0;
  - existing OpenBot strict employee-package schema, quarantine projection, DSSE trust check,
    digest-bound activation receipt, and sensitive-content scan.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `docs/research/reviewed-employee-import-activation.md`;
  - `docs/research/owner-employee-profile-details.md`;
  - ADR-0024, ADR-0026, Employee specification, API reference, package tests, import dialog, and
    retroactive reuse ledger.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Hermes profile distributions | [`63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), especially [`profile-distributions.md`](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/website/docs/user-guide/profile-distributions.md) and [`profile-commands.md`](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/website/docs/reference/profile-commands.md) | MIT code; repository documentation | Active project with a documented profile lifecycle and install confirmation | Directly supports the Hermes-inspired Employee direction: show a human-readable manifest before install, list required capabilities, and keep credentials, memories, and sessions outside durable distributions. Hermes' filesystem profile is not OpenBot's Server authority | Adapt the review information architecture, not source |
| Backstage catalog import and entity model | [`v1.51.0`](https://github.com/backstage/backstage/tree/v1.51.0), especially catalog import analysis and [descriptor format](https://github.com/backstage/backstage/blob/v1.51.0/docs/features/software-catalog/descriptor-format.md) | Apache-2.0 | Mature project with typed import analysis and catalog processing tests | Separates a short, human-readable entity description from stable machine identity and analyzes before registration. It does not define Employee authority or portable skills | Adopt the descriptive-preview distinction |
| Existing OpenBot quarantine preview | commits through `4b6c55f` | MIT | Strict Zod package parsing, content scanning, checksum/DSSE verification, compatibility analysis, atomic receipt, and negative tests | Already owns the exact Server trust boundary and UI journey. The package includes a bounded biography, but its public preview type and UI omit that field | Reuse directly and close the narrow projection gap |

## Reuse decision

- Selected option: reuse the existing OpenBot quarantine and adapt the Hermes manifest-review and
  Backstage descriptive-metadata patterns.
- Selected upstream or standard: Hermes profile-distribution preview and user-data separation;
  Backstage short entity descriptions.
- Why this is the first viable option: another installer or profile store would duplicate identity,
  trust, and activation. OpenBot already validates the exact bytes and constructs a safe preview;
  only one already-validated descriptive field is missing from that projection.
- Exact OpenBot-specific gap: add the optional Employee biography to the typed import preview and
  render it as untrusted descriptive content beside the role before Owner confirmation. Preserve
  compatibility with older `openbot.employee/v1` packages that omit the biography.
- Upgrade, replacement, or exit plan: keep the preview derived exclusively from the canonical
  package schema. Future scheduled jobs, MCP connections, executable skill contents, or update
  channels each require a separate review and cannot be smuggled into this field.
- Failure behavior when the upstream is missing, incompatible, or compromised: no upstream runtime
  is loaded. The local strict schema, integrity check, trust store, sensitive-content scan, and
  activation digest remain authoritative and fail closed.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no Hermes or Backstage source is copied. OpenBot changes its own
  domain projection, React review view, tests, and documentation.
- Required copyright or license notice location: citations and license decisions are recorded here
  and in `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: the Server quarantine preview preserves a present biography and remains
  compatible when it is absent; the Web review renders biography, role, skills, capabilities,
  trust, and zero-authority language before activation.
- Negative and fail-closed tests: unexpected package fields, oversized or secret-like biography,
  changed bytes, untrusted signature, incompatible host, and missing Owner confirmation continue to
  block activation.
- Platforms and devices: Server-generated preview shared by Windows, macOS, Linux, and mobile Web
  clients; no native-client claim.
- User-visible documentation and translations: update the English canonical Employee/API/reuse
  documentation and matching Simplified Chinese documents.
- Support level that the evidence permits: one-time `openbot.employee/v1` quarantine review. Git
  distribution, subscriptions, differential updates, and shared memory are not implemented.

## Unresolved questions

- A durable Git-backed Employee distribution channel needs version pinning, update ownership,
  rollback, dependency diffing, and provenance review before implementation.
- Executable skill contents need a separate archive and sandbox review; this preview remains
  metadata-only.
