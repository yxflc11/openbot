# Research: Cross-platform Node CI baseline

- Status: Accepted for implementation; remote evidence pending
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pending
- Acceptance journey: every portable Worker Host protocol, Provider SDK, Node, configuration, and
  Web change installs from the lockfile, type-checks, tests, and builds on explicit Linux x64,
  Windows x64, and macOS arm64 hosted runner families before merge.
- Security boundary: hosted CI detects portable contract regressions. It does not prove GUI control,
  OS permission prompts, service recovery, native keyring isolation, hardware isolation, or
  real-device Provider support. Hosted runner output is untrusted evidence until the workflow and
  target identity are reviewed.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `actions runner images supported macos windows ubuntu labels 2026`, `Windows 2025
  macOS 15 runner images`, `actions setup-node matrix Node 22 cache npm`, and `GitHub Actions matrix
  fail-fast max-parallel`.
- Standards and primary documentation queries: GitHub-hosted runner hardware/architecture labels,
  runner-image GA and update policy, matrix failure behavior, least workflow permissions, and
  `setup-node` lockfile/cache behavior.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `.github/workflows/ci.yml`,
  `docs/PROVIDER_CONFORMANCE.md`, ADR-0015, `docs/CROSS_PLATFORM.md`, the CI/research entries in
  `docs/OPEN_SOURCE_REUSE.md`, and the current Node/config/Provider SDK package scripts.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| GitHub-hosted explicit GA runner labels | [`actions/runner-images@148c0a4a`](https://github.com/actions/runner-images/tree/148c0a4acb53bb2c7c853446a290aec86b61d3c3), plus the GitHub-hosted runners reference reviewed 2026-09-04 | MIT; GitHub service terms | Image source has thousands of commits, public image releases, weekly updates, and public issue/announcement tracking | Standard labels provide `ubuntu-24.04` x64, `windows-2025` x64, and `macos-15` arm64; explicit labels avoid an unannounced OpenBot claim change when `-latest` migrates | Select for the first portable matrix |
| Moving `*-latest` labels | Same runner-images review | MIT; GitHub service terms | Maintained, but GitHub intentionally migrates the aliases over time | Convenient but changes the OS/architecture evidence without a repository change; `macos-latest` has already moved across architecture families | Reject for conformance evidence |
| OpenBot's existing pinned actions | [`actions/checkout@11d5960a`](https://github.com/actions/checkout/tree/11d5960a326750d5838078e36cf38b85af677262) and [`actions/setup-node@49933ea5`](https://github.com/actions/setup-node/tree/49933ea5288caeca8642d1e84afbd3f7d6820020) | MIT | Already reviewed and exercised by the current Ubuntu jobs | Full-commit pins, `persist-credentials: false`, exact Node 22.22.2, committed npm lockfile, and read-only workflow permissions fit this slice without adding another action | Reuse unchanged |
| Self-hosted real-device matrix | GitHub Actions runner service documentation reviewed 2026-09-04 | GitHub service terms; runner source MIT | Maintained service, but machine enrollment, cleanup, secrets, physical security, and fleet operations belong to the repository owner | Required later for service/keyring/GUI evidence, but adding labels without enrolled controlled machines would leave jobs queued or expose an unsafe runner | Defer to the G2 real-device contract and owner-provided infrastructure |
| Repeat the full Ubuntu authority job three times | Current OpenBot branch | MIT | Existing full check is green on local macOS and hosted Ubuntu is pending observation | Would multiply docs, research, security-workflow, and Linux-oriented checks without improving their evidence; Windows cannot run the Docker-based history scanner | Keep the current Ubuntu authority jobs and add one narrower portable matrix |

## Reuse decision

- Selected option: open GitHub Actions matrix contract plus the existing released/pinned actions.
- Selected upstream or standard: explicit GitHub-hosted runner labels and
  `jobs.<job_id>.strategy.matrix`, with `fail-fast: false` so all platform outcomes remain visible.
- Why this is the first viable option: the repository already uses GitHub Actions and its pinned
  first-party actions. A small native matrix needs no dependency, adapter, service account, secret,
  or custom runner code.
- Exact OpenBot-specific gap: add a non-database `portable` job that performs `npm ci`, type checking,
  unit tests, and builds on `ubuntu-24.04`, `windows-2025`, and `macos-15`. Keep PostgreSQL and
  security scanning on their existing Ubuntu jobs.
- Upgrade, replacement, or exit plan: review GitHub's runner-image release/announcement before an
  explicit label reaches deprecation; change the label only in a focused commit after the
  replacement matrix is observed. A future self-hosted real-device fleet consumes the same package
  scripts but is a separate trust and operations design.
- Failure behavior when the upstream is missing, incompatible, or compromised: every matrix member
  is required and does not continue on error. Setup, install, test, or build failure blocks the gate;
  no platform is silently excluded or downgraded. GitHub outage leaves the gate incomplete rather
  than producing a support claim.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: no upstream workflow text is copied. The implementation uses the
  documented matrix keys and reuses OpenBot's existing pinned action invocations.
- Required copyright or license notice location: none; no upstream source is incorporated or
  distributed.

## Verification plan

- Automated tests: validate workflow policy locally, install from `package-lock.json`, then run
  `npm run typecheck`, `npm run test`, and `npm run build` on every matrix member.
- Negative and fail-closed tests: `fail-fast: false` preserves diagnostics from all members, while
  every member remains required. The repository security-workflow checker must assert exact runner
  labels, exact Node version, pinned actions, disabled checkout credential persistence, and absence
  of `continue-on-error`.
- Platforms and devices: hosted `ubuntu-24.04` x64, `windows-2025` x64, and `macos-15` arm64 only.
  macOS Intel, Linux arm64, Windows arm64, services, keyrings, and GUI behavior remain unproven.
- User-visible documentation and translations: update the English and Simplified Chinese execution
  plan and cross-platform evidence wording; do not raise any Provider support level.
- Support level that the evidence permits: hosted build/test compatibility only, after all three
  remote jobs are observed. It does not permit `Integrated`, `Supported`, or `Certified` labels.

## Unresolved questions

- The branch is not yet pushed, so the current Ubuntu baseline and proposed matrix cannot be observed
  remotely without explicit Owner authorization.
- Real-device runner ownership, enrollment, cleanup, network isolation, secret access, retention,
  and cost require the separate G2 research and infrastructure decision.
