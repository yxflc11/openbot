# Research: actions/setup-node v7

- Status: Accepted for implementation
- Date: 2026-09-05
- Owner: @yxflc11
- Related issue: pull request #1 (conflicting predecessor; this slice supersedes it from current
  `main`)
- Acceptance journey: every current CI job selects exact Node.js `22.22.2`, restores the explicit
  npm cache keyed by the committed lockfile, and reaches its existing install and verification
  steps without using the deprecated Node.js 20 Action runtime.
- Security boundary: setup-node runs before repository scripts, receives the workflow's read-only
  GitHub token to obtain Node distributions, and can read or write the npm cache. OpenBot keeps an
  immutable full-commit pin, exact project Node and npm versions, an explicit `cache: npm` input, a
  committed lockfile, and fail-closed setup/install behavior. This review does not authorize
  registry credentials, a mirror, moving Node versions, or broader workflow permissions.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `repo:actions/setup-node is:issue is:open v7`, `Node 24`, `cache security`, the
  `v7.0.0` release and exact commit, its Action manifest, source workflows, commit checks, license,
  and relevant open issues. [#959](https://github.com/actions/setup-node/issues/959) asks the Action
  to control package lifecycle scripts; OpenBot controls those in its separate `npm ci` commands.
  [#1613](https://github.com/actions/setup-node/issues/1613) reports `node-gyp` discovery on a newer
  Windows runner image; OpenBot's exact lock tree completed on `windows-2025` in the prior v7 PR,
  and the new current-main matrix remains required.
- Standards and primary documentation queries: GitHub's
  [Node.js 20 Action runtime deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/),
  [secure use of third-party Actions](https://docs.github.com/en/actions/reference/security/secure-use),
  [dependency cache security](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching),
  the official [setup-node v7.0.0 release](https://github.com/actions/setup-node/releases/tag/v7.0.0),
  and the runner, cache, token, registry, and mirror inputs at the pinned commit.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: conflicting pull request #1,
  `.github/workflows/ci.yml`, `.github/workflows/node-linux-release.yml`, ADR-0020,
  `docs/research/cross-platform-node-ci.md`, and both open-source reuse ledgers. Main run
  `33906423917` passed all seven jobs but identified setup-node v4 as the remaining Node 20 Action;
  predecessor PR run `33877239948` passed all seven jobs with v7 before later main changes.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| GitHub `actions/setup-node` v7.0.0 | [`820762786026740c76f36085b0efc47a31fe5020`](https://github.com/actions/setup-node/commit/820762786026740c76f36085b0efc47a31fe5020), published 2026-07-14 with a verified commit signature | MIT | Official, active, non-archived repository; the pinned tree contains cross-platform validation, cache, distribution, license, and CodeQL workflows, and the release commit's visible checks passed | Uses the Node.js 24 Action runtime. v7 migrates internals to ESM, updates Action dependencies, adds cache-key outputs, and removes a dummy registry token fallback. OpenBot does not set `registry-url` and keeps an explicit npm cache, so those changes do not widen credentials or alter cache selection | Select and retain the full SHA |
| GitHub `actions/setup-node` v5.0.0 or v6.0.0 | [`a0853c24544627f65ddf259abe73b1d18a591444`](https://github.com/actions/setup-node/tree/a0853c24544627f65ddf259abe73b1d18a591444) or [`2028fbc5c25fe9cf00d9f06a71cc4710d4507903`](https://github.com/actions/setup-node/tree/2028fbc5c25fe9cf00d9f06a71cc4710d4507903) | MIT | Released official versions with the Node.js 24 Action runtime | Either removes the immediate Node 20 warning, but v7 is the current reviewed immutable release and carries newer official Action dependencies. v6's automatic npm-cache detection does not replace OpenBot's explicit cache input | Reject older forward baselines |
| Retain `actions/setup-node` v4.4.0 | [`49933ea5288caeca8642d1e84afbd3f7d6820020`](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020) | MIT | Previously reviewed and exercised by OpenBot | Targets the deprecated Node.js 20 Action runtime. GitHub currently forces it onto Node.js 24 and plans to remove Node 20 from runners on 2026-09-23 | Reject as the forward baseline |
| Local shell bootstrap and cache implementation | OpenBot-specific code, not an upstream release | OpenBot license | OpenBot would own download integrity, archive extraction, tool-cache discovery, cross-platform behavior, authentication, and cache lifecycle | Duplicates the official Action, expands the supply-chain and credential surface, and provides no OpenBot-specific authority benefit | Reject |

## Reuse decision

- Selected option: dependency.
- Selected upstream or standard: GitHub `actions/setup-node` v7.0.0 at exact commit
  `820762786026740c76f36085b0efc47a31fe5020`.
- Why this is the first viable option: OpenBot already depends on the official released Action. The
  reviewed current release removes the deprecated Action runtime while preserving the exact
  project Node version, explicit npm cache, package manager, permissions, and install commands.
- Exact OpenBot-specific gap: update the immutable workflow pin and strengthen local workflow
  policy checks so every current setup-node reference must use that exact commit.
- Upgrade, replacement, or exit plan: let Dependabot propose later releases, then repeat the release,
  source, issue, license, runner, cache, and hosted-matrix review before changing this SHA. If an
  upstream incident affects the pin, stop affected jobs and select another reviewed immutable
  commit; do not fall back to a moving tag.
- Failure behavior when the upstream is missing, incompatible, or compromised: Action download,
  exact Node selection, cache restoration, or cache cleanup failure fails the job. Existing
  `npm ci`, audit, build, and test gates remain required, while repository checks reject missing,
  additional, moving, or unreviewed setup-node references.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: no upstream source or workflow text is copied; OpenBot invokes the
  public Action contract from its local workflows.
- Required copyright or license notice location: none for invocation-only use; the MIT upstream and
  exact commit remain recorded here and in the reuse ledger.

## Verification plan

- Automated tests: run `npm run security:config-check` and `npm run check`; require pull-request
  `check`, `security`, database, Windows Worker Host, Linux x64, Windows x64, and macOS arm64 jobs.
- Negative and fail-closed tests: replace setup-node with a moving `v7` reference or remove one
  current invocation and require the local CI/release validators to reject the workflow; retain
  required npm install and audit behavior.
- Platforms and devices: GitHub-hosted `ubuntu-24.04` x64, `windows-2025` x64, and `macos-15` arm64.
  The tag-only Linux release workflow is configuration-checked here but remains unexecuted until a
  separately reviewed `node-v*` tag. No real device, service, keyring, or GUI claim is added.
- User-visible documentation and translations: update the English and Simplified Chinese reuse
  ledgers; no product behavior or support claim changes.
- Support level that the evidence permits: not applicable; this is CI tooling compatibility, not an
  OpenBot platform-support promotion.

## Unresolved questions

- None. The new current-main PR must still demonstrate all seven hosted jobs and a warning-free
  combined checkout/setup-node Action runtime before this checkpoint is ready for Owner review.
