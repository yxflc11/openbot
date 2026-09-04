# Research: actions/checkout v7

- Status: Accepted for implementation
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pull request #2
- Acceptance journey: every current CI job checks out the event-selected OpenBot revision with its
  existing fetch-depth contract and without persisting the workflow token, while no longer relying
  on the deprecated Node.js 20 Action runtime.
- Security boundary: checkout runs before repository scripts, receives `GITHUB_TOKEN`, writes the
  workspace, and temporarily changes Git configuration. OpenBot keeps read-only workflow
  permissions, `persist-credentials: false`, an immutable full-commit pin, default-disabled LFS and
  submodules, strict SSH host checking, and the v7 default that refuses unsafe fork PR checkout in
  privileged event contexts. This review does not authorize another repository, an SSH key, a PAT,
  credential persistence, or `allow-unsafe-pr-checkout: true`.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `repo:actions/checkout is:issue is:open v7`, `Node 24`,
  `allow-unsafe-pr-checkout`, the `v7.0.1` release, exact commit checks, manifest, source, dependency
  boundary, license, and open issues. [#2563](https://github.com/actions/checkout/issues/2563)
  affects a custom external-repository mirroring script that removes auth headers and pushes with a
  PAT; OpenBot neither mirrors nor pushes from these workflows. The unanswered
  [#2539](https://github.com/actions/checkout/issues/2539) means this review does not classify
  v7.0.1 itself as a security release beyond its documented changes.
- Standards and primary documentation queries: GitHub's
  [Node.js 20 Action runtime deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/),
  [secure use of third-party Actions](https://docs.github.com/en/actions/reference/security/secure-use),
  the official [checkout v7.0.1 release](https://github.com/actions/checkout/releases/tag/v7.0.1),
  and the pinned source for credential handling and privileged fork PR rejection.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: pull request #2,
  `.github/workflows/ci.yml`, `.github/workflows/node-linux-release.yml`, ADR-0020,
  `docs/research/cross-platform-node-ci.md`, and both open-source reuse ledgers.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| GitHub `actions/checkout` v7.0.1 | [`3d3c42e5aac5ba805825da76410c181273ba90b1`](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1), published 2026-07-20 with a verified commit signature | MIT | Official, active, non-archived repository; build, checked distribution, license, CodeQL, container/proxy, and Ubuntu/macOS/Windows tests passed at the pinned commit. One separate Dependabot job could not update a transitive development Babel dependency without downgrading Jest; Babel is not a published runtime dependency | Uses Node.js 24 and requires runner `2.327.1` or later. The current hosted run used `2.337.0`; existing fetch depth and disabled credential persistence remain unchanged. v7 also rejects unsafe privileged-event fork checkout by default | Select and retain the full SHA |
| Retain `actions/checkout` v4.4.0 | [`11d5960a326750d5838078e36cf38b85af677262`](https://github.com/actions/checkout/commit/11d5960a326750d5838078e36cf38b85af677262) | MIT | Previously reviewed and exercised by OpenBot | Still targets the deprecated Node.js 20 Action runtime and lacks v7's default privileged-event fork PR refusal | Reject as the forward baseline |
| Local Git/REST checkout implementation | OpenBot-specific code, not an upstream release | OpenBot license | OpenBot would own event-ref resolution, auth cleanup, Git-version fallbacks, submodule/LFS behavior, retries, and cross-platform tests | Duplicates the official Action, expands credential-handling code, and provides no OpenBot-specific authority benefit | Reject |

## Reuse decision

- Selected option: dependency.
- Selected upstream or standard: GitHub `actions/checkout` v7.0.1 at exact commit
  `3d3c42e5aac5ba805825da76410c181273ba90b1`.
- Why this is the first viable option: OpenBot already depends on the official released checkout
  Action. The reviewed upgrade removes the deprecated Action runtime, preserves all explicit local
  inputs, and adds a safer default for privileged fork PR contexts without adding a new dependency.
- Exact OpenBot-specific gap: update the immutable workflow pin and all local workflow policy checks
  that deliberately reject checkout-version drift.
- Upgrade, replacement, or exit plan: let Dependabot propose later releases, then repeat the release,
  source, issue, license, runner, and hosted-matrix review before changing this SHA. If an upstream
  incident affects the pin, stop affected jobs and select another reviewed immutable commit; never
  opt into unsafe PR checkout or fall back to a moving tag without a separate security review.
- Failure behavior when the upstream is missing, incompatible, or compromised: Action download,
  repository resolution, checkout, or cleanup failure fails the job. Policy checks reject moving or
  unreviewed checkout references and keep credential persistence disabled.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: no upstream source or workflow text is copied; OpenBot invokes the
  public Action contract from its local workflows.
- Required copyright or license notice location: none for invocation-only use; the MIT upstream and
  exact commit remain recorded here and in the reuse ledger.

## Verification plan

- Automated tests: run `npm run security:config-check` and `npm run check`; require the pull-request
  `check`, `security`, database, Windows Worker Host, Linux x64, Windows x64, and macOS arm64 jobs.
- Negative and fail-closed tests: mutate each policy-covered checkout SHA to a moving `v7` reference
  and require the portable, release, and Windows Worker Host validators to reject it; continue
  requiring `persist-credentials: false`.
- Platforms and devices: GitHub-hosted `ubuntu-24.04` x64, `windows-2025` x64, and `macos-15` arm64.
  The tag-only Linux release workflow is configuration-checked here but remains unexecuted until a
  separately reviewed `node-v*` tag. No real device, service, keyring, or GUI claim is added.
- User-visible documentation and translations: update the English and Simplified Chinese reuse
  ledger; no product behavior or support claim changes.
- Support level that the evidence permits: not applicable; this is CI tooling compatibility, not an
  OpenBot platform-support promotion.

## Unresolved questions

- None. The upstream development-only Babel advisory remains visible in its repository and is not
  hidden by this invocation-only upgrade; OpenBot relies on the reviewed bundled distribution and
  does not install checkout's development graph.
