# Research: actions/setup-node v7

- Status: Accepted for implementation
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pull request #1
- Acceptance journey: every current CI job selects exact Node.js `22.22.2`, restores the npm
  cache keyed by the committed lockfile, and proceeds to its existing install and verification steps
  without relying on the deprecated Node.js 20 Action runtime.
- Security boundary: the Action runs before repository scripts, receives the workflow's read-only
  GitHub token to obtain Node distributions, and can read or write the npm cache. OpenBot keeps an
  immutable full-commit pin, an exact Node version, an explicit `cache: npm` input, a committed
  lockfile, and fail-closed setup/install behavior. This review does not authorize registry
  credentials, a mirror, moving Node versions, or broader workflow permissions.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `repo:actions/setup-node is:issue is:open v7`, `Node 24`, `cache security`, the
  `v7.0.0` release, exact commit checks, action manifest, source tree, license, and open issues.
  The open results reviewed included [#959](https://github.com/actions/setup-node/issues/959),
  which asks setup-node itself to control lifecycle scripts; OpenBot controls its separate `npm ci`
  invocations, so that request is not a blocker for this Action use.
- Standards and primary documentation queries: GitHub's
  [Node.js 20 Action runtime deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/),
  [secure use of third-party Actions](https://docs.github.com/en/actions/reference/security/secure-use),
  the official [setup-node v7.0.0 release](https://github.com/actions/setup-node/releases/tag/v7.0.0),
  and its runner, cache, token, and mirror inputs at the pinned commit.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: pull request #1,
  `.github/workflows/ci.yml`, `.github/workflows/node-linux-release.yml`, ADR-0020,
  `docs/research/cross-platform-node-ci.md`, and both open-source reuse ledgers.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| GitHub `actions/setup-node` v7.0.0 | [`820762786026740c76f36085b0efc47a31fe5020`](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020), published 2026-07-14 with a verified commit signature | MIT | Official, active, non-archived repository; the pinned tree includes the test suite, and the release commit reports successful build, platform, `check-dist`, and CodeQL checks | Uses Node.js 24 and requires runner `2.327.1` or later. The current hosted run used `2.337.0`; exact Node `22.22.2` and the existing explicit npm cache contract are preserved | Select and retain the full SHA |
| Retain `actions/setup-node` v4.4.0 | [`49933ea5288caeca8642d1e84afbd3f7d6820020`](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020) | MIT | Previously reviewed and exercised by OpenBot | Still targets the deprecated Node.js 20 Action runtime; GitHub is forcing it onto Node.js 24 temporarily and has scheduled Node.js 20 removal | Reject as the forward baseline |
| Local shell bootstrap and cache implementation | OpenBot-specific code, not an upstream release | OpenBot license | OpenBot would own download integrity, archive extraction, tool-cache discovery, cross-platform behavior, and cache lifecycle | Adds a larger supply-chain and platform surface while duplicating the official Action and providing no required OpenBot authority boundary | Reject |

## Reuse decision

- Selected option: dependency.
- Selected upstream or standard: GitHub `actions/setup-node` v7.0.0 at exact commit
  `820762786026740c76f36085b0efc47a31fe5020`.
- Why this is the first viable option: OpenBot already depends on the official released Action; the
  reviewed upgrade removes the deprecated Action runtime without changing the selected project
  Node version, package manager, cache type, permissions, or install commands.
- Exact OpenBot-specific gap: update the immutable workflow pin and the local workflow policy tests
  that deliberately reject action-version drift.
- Upgrade, replacement, or exit plan: let Dependabot propose later releases, then repeat the release,
  source, issue, license, runner, and hosted-matrix review before changing this SHA. If an upstream
  incident affects the pin, stop the affected jobs and select another reviewed immutable commit;
  do not fall back to a moving tag.
- Failure behavior when the upstream is missing, incompatible, or compromised: Action download,
  Node selection, or cache failure fails the job. Existing `npm ci` and audit gates remain required,
  and the repository checks reject a moving or unreviewed setup-node reference.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: no upstream source or workflow text is copied; OpenBot invokes the
  public Action contract from its local workflows.
- Required copyright or license notice location: none for invocation-only use; the MIT upstream and
  exact commit remain recorded here and in the reuse ledger.

## Verification plan

- Automated tests: run `npm run security:config-check` and `npm run check`; require the pull-request
  `check`, `security`, database, Windows Worker Host, Linux x64, Windows x64, and macOS arm64 jobs.
- Negative and fail-closed tests: mutate the setup-node SHA to a moving `v7` reference and require the
  local security workflow validator to reject it; retain required npm install and audit behavior.
- Platforms and devices: GitHub-hosted `ubuntu-24.04` x64, `windows-2025` x64, and `macos-15` arm64.
  The tag-only Linux release workflow is configuration-checked here but remains unexecuted until a
  separately reviewed `node-v*` tag. No real device, service, keyring, or GUI claim is added.
- User-visible documentation and translations: update the English and Simplified Chinese reuse
  ledger; no product behavior or support claim changes.
- Support level that the evidence permits: not applicable; this is CI tooling compatibility, not an
  OpenBot platform-support promotion.

## Unresolved questions

- None. The release workflow's first real tag execution remains a release-readiness checkpoint, not
  an unresolved dependency-selection question.
