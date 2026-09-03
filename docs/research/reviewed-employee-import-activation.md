# Research: Reviewed Employee import activation

- Status: Accepted for implementation
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: not filed yet
- Acceptance journey: an Owner previews one portable Employee package, reviews its exact digest and
  trust state, explicitly accepts any unsigned-package risk, and activates one new local Employee
  whose imported skills remain disabled until separately verified.
- Security boundary: preview and activation validate the same package bytes. Activation creates a
  new identity and candidate skill assignments only; it never imports credentials, memory, work
  history, host bindings, sessions, approvals, or authority.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `Backstage software template dry run preview review create`, `Kubernetes server
  dry run no side effects`, `OpenClaw third party skill quarantine approval`, and `agent skill
  import quarantine disabled until trust`.
- Standards and primary documentation queries: Backstage Software Templates authoring and dry-run
  behavior; Kubernetes API dry-run semantics; OpenClaw third-party skill installation policy.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0014, ADR-0020, ADR-0024,
  Employee package schemas and DSSE tests, quarantine preview, PostgreSQL transaction helpers,
  Employee skill state transitions, and `docs/OPEN_SOURCE_REUSE.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Backstage Software Templates | [`v1.51.0`](https://github.com/backstage/backstage/tree/v1.51.0), especially [`writing-templates.md`](https://github.com/backstage/backstage/blob/v1.51.0/docs/features/software-templates/writing-templates.md) | Apache-2.0 | Mature CNCF project with maintained template preview, review, create, and dry-run flows | Strong user-journey model; its catalog/scaffolder runtime is much larger than OpenBot's portable Employee transaction | Adopt preview → review → create; do not embed Backstage |
| Kubernetes API dry-run | [`v1.36.2`](https://github.com/kubernetes/kubernetes/tree/v1.36.2) and [`api-concepts.md`](https://github.com/kubernetes/website/blob/main/content/en/docs/reference/using-api/api-concepts.md) | Apache-2.0 | Mature, heavily tested API semantics | Strong contract that preview performs validation without persistence or side effects; Kubernetes admission machinery is out of scope | Adopt no-side-effect preview semantics |
| OpenClaw third-party skills | [`v2026.7.1-2`](https://github.com/openclaw/openclaw/tree/v2026.7.1-2), especially [`docs/tools/skills.md`](https://github.com/openclaw/openclaw/blob/v2026.7.1-2/docs/tools/skills.md) | MIT | Active multi-platform agent project with explicit skill-discovery and install policy | Strong default-untrusted and pending-approval behavior; OpenClaw skill installation does not create an OpenBot Employee | Adopt disabled/pending-review default; keep the existing OpenBot skill schema |
| OmniScientist-V2 compatibility policy | [`main`](https://github.com/tsinghua-fib-lab/OmniScientist-V2/blob/master/cli/docs/compatibility.md), reviewed 2026-09-04 | Apache-2.0 | Public research project but low adoption and no stable release selected | Its quarantined, non-executable external-skill behavior corroborates the boundary but is not mature enough to lead the design | Corroborating evidence only |
| `skill-suitcase` | GitHub repository reviewed 2026-09-04 | repository-specific | Small project with transaction journal, receipt, and idempotency ideas, but insufficient adoption/release evidence | Some vocabulary fits; importing its implementation would add risk rather than reduce it | Reject as an implementation source |
| Existing OpenBot PostgreSQL control plane | Current branch, ADR-0005 and migration `0013` | MIT | Existing transactional store, ordered advisory-lock usage, strict schemas, uniqueness constraints, and repository tests | Exact domain and security fit | Extend with one atomic, serialized OpenBot-specific activation transaction |

## Reuse decision

- Selected option: adopt mature workflow and safety contracts, then implement the narrow local gap on
  OpenBot's existing PostgreSQL store.
- Selected upstream or standard: Backstage preview/review/create, Kubernetes no-side-effect dry run,
  and OpenClaw default-untrusted third-party skills.
- Why this is the first viable option: the reviewed projects supply proven interaction and trust
  semantics, but none implements OpenBot's signed `openbot.employee/v1` package, fresh local Bot
  identity, skill graph, audit log, or Owner-authenticated self-hosted control plane.
- Exact OpenBot-specific gap: atomically bind one reviewed package digest to one new local Employee,
  candidate-only skill assignments, an append-only import event, and an idempotent receipt.
- Upgrade, replacement, or exit plan: keep parsing, inspection, and persistence behind protocol and
  store interfaces. A future registry or policy engine may replace trust distribution without
  changing the package format or candidate-only import rule.
- Failure behavior when the upstream is missing, incompatible, or compromised: OpenBot has no
  runtime dependency on the reviewed projects. Invalid, changed, blocked, untrusted, revoked, or
  previously activated packages fail before any Employee is created.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: only public documentation and behavioral contracts were reviewed;
  implementation extends OpenBot's existing strict schemas and PostgreSQL transaction patterns.
- Required copyright or license notice location: exact links and licenses are recorded here and in
  `docs/OPEN_SOURCE_REUSE.md`; no third-party source notice is required.

## Verification plan

- Automated tests: preview digest binding, signed activation, unsigned explicit acceptance, fresh
  identity, candidate-only skills, dependency graph, audit event, and idempotent replay.
- Negative and fail-closed tests: changed digest or package id, `ownerReviewed` absent, unsigned risk
  not accepted, blocked compatibility, reused idempotency key with different input, duplicate
  package activation, conflicting skill definition, untrusted or revoked publisher, and malformed
  body.
- Platforms and devices: portable Server behavior in Linux CI and local macOS PostgreSQL; activation
  grants no Worker Host authority and therefore makes no Windows GUI-execution claim.
- User-visible documentation and translations: API, Employee, security, roadmap, and reuse-ledger
  updates in English with Simplified Chinese counterparts where the repository maintains one.
- Support level that the evidence permits: experimental reviewed activation for a single self-hosted
  Server; public Employee registry, transferable trust, and automatic skill enabling remain future.

## Unresolved questions

- Registry-level publisher identity, transparency, package updates, revocation propagation, and
  repeated installation of the same logical package require a separate distribution protocol.
- A future policy may allow activation without a currently compatible connected host, but this
  phase preserves preview's existing fail-closed compatibility rule.
