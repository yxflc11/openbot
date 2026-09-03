# Research: Employee export content preview

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: Before downloading a portable Employee template, an authenticated Owner can
  review the exact descriptive profile and every verified skill that will leave the Server, beside
  the already-visible exclusions, integrity result, and publisher-signature status.
- Security boundary: Preview is read-only and Server-generated from the same canonical package
  builder used by download. It exposes only content already selected for export and never grants
  authority. A sensitive-content finding blocks download. Memories, history, credentials, sessions,
  Worker Host identity, bindings, approvals, and grants remain structurally absent.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `site:github.com/npm/cli "npm pack --dry-run" json files preview source`
  - `site:github.com/NousResearch/hermes-agent profile export inspect before sending contents`
  - `site:github.com/openclaw/openclaw export agent profile preview package contents`
- Standards and primary documentation queries:
  - Hermes profile export/distribution guidance at commit `63279301`, particularly its explicit
    included/excluded data lists and warning to inspect snapshot exports before sharing;
  - OpenClaw's fixed-version npm release check, which reads the `files` inventory returned by
    `npm pack --json --dry-run --ignore-scripts` and fails closed when it cannot inspect it;
  - npm CLI pack command implementation at v11.6.0, which builds one tarball value and derives the
    reported contents from those same bytes;
  - existing OpenBot single package builder, blocking content scanner, export exclusions, checksum,
    DSSE status, and download route.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `docs/research/portable-employee-profile-review.md`;
  - `docs/research/portable-employee-skill-disclosure.md`;
  - ADR-0024, Employee/API specifications, export dialog, package builder, and package/route tests.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Hermes profile export and distributions | [`63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), especially [`profile-distributions.md`](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/website/docs/user-guide/profile-distributions.md) | MIT code; repository documentation | Active project with documented sharing, install, and update journeys | Separates curated distributions from snapshot exports, names included/excluded state, and tells senders to inspect personal content. Its filesystem archive cannot replace OpenBot's Server-owned package | Adapt the sender review boundary |
| OpenClaw package release inspection | [`v2026.7.1-2`](https://github.com/openclaw/openclaw/tree/v2026.7.1-2), especially [`scripts/openclaw-npm-release-check.ts`](https://github.com/openclaw/openclaw/blob/v2026.7.1-2/scripts/openclaw-npm-release-check.ts) | MIT | Active, tested release tooling in a high-adoption agent project | Runs `npm pack --json --dry-run --ignore-scripts`, reads the returned file inventory, and fails when the package cannot be inspected. Its release-file rules are not OpenBot Employee policy | Adapt fail-closed same-package inventory review |
| npm pack command | [`v11.6.0`](https://github.com/npm/cli/tree/v11.6.0), especially [`lib/commands/pack.js`](https://github.com/npm/cli/blob/v11.6.0/lib/commands/pack.js) | Artistic-2.0 | Mature package manager with packlist and command tests | Builds one tarball value with `libnpmpack`, then derives the reported contents from those exact bytes. npm package files are not OpenBot Employee data | Adapt build-once preview semantics |
| Existing OpenBot export preview | commits through `4db13fa` | MIT | Canonical package builder, sensitive-content scanning, exclusions, checksum/DSSE, authenticated route, and tests | Already creates the exact outgoing payload, but its public preview collapses the profile to a name and the skills to a count. The Owner therefore cannot inspect exact outgoing descriptive content from the export confirmation itself | Reuse directly and close the projection gap |

## Reuse decision

- Selected option: reuse the existing canonical OpenBot package builder and expose a bounded copy of
  its already-selected profile and skill metadata in the export preview.
- Selected upstream or standard: Hermes sender inspection plus OpenClaw/npm's same-package
  inventory behavior.
- Why this is the first viable option: adopting another packer would create a second serialization
  and trust path. OpenBot already builds the complete schema-valid payload before returning preview;
  the missing work is only an Owner-facing projection.
- Exact OpenBot-specific gap: add role, optional biography, appearance, and the selected verified
  skill summaries to `EmployeeExportPreview`, then render them alongside exclusions and integrity.
- Upgrade, replacement, or exit plan: derive future preview fields from the same package builder and
  add contract tests whenever the portable schema changes. Never maintain a UI-only selection list.
- Failure behavior when the upstream is missing, incompatible, or compromised: no upstream runtime
  is loaded. If OpenBot cannot build, scan, or sign the package, preview/download fails; blocked
  findings keep the download action disabled.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no Hermes, OpenClaw, or npm source is copied. OpenBot changes its own
  domain projection, package result, existing React dialog, tests, and docs.
- Required copyright or license notice location: citations and licenses are recorded here and in
  `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: export builder returns the exact role, optional biography, appearance, and
  verified skill summaries in deterministic package order; the Web preview renders those fields,
  exclusions, checksum, and signature status.
- Negative and fail-closed tests: candidate/suspended/revoked skills remain absent; secret-like
  profile or skill content blocks download; zero verified skills and absent biography render
  truthful empty states.
- Platforms and devices: Server response and responsive Web dialog shared across Windows, macOS,
  Linux, and mobile browsers; no native-client claim.
- User-visible documentation and translations: update English canonical Employee/API/reuse docs
  and matching Simplified Chinese documents.
- Support level that the evidence permits: preview of one-time `openbot.employee/v1` template
  content. It is not a diff, release channel, or update subscription.

## Unresolved questions

- Future package versions need a content diff and signed source/update metadata before an Owner can
  safely accept upgrades to an already-imported Employee.
- Appearance asset files, executable skills, optional memories, and licensing are not part of v1.
