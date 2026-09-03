# Research: Cross-platform Node CI baseline

- Status: Proposed
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: pending
- Acceptance journey: every Worker Host protocol or portable file-adapter change is compiled and
  unit-tested on pinned Linux, Windows, and macOS runner families before merge.
- Security boundary: hosted CI detects portable contract regressions; it does not prove GUI control,
  OS permission prompts, service recovery, hardware isolation, or real-device Provider support.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `actions runner images supported macos windows ubuntu labels 2026`, `Windows 2025
  macOS 15 runner images`, and `Node system keychain Windows Credential Manager macOS Keychain
  Linux Secret Service`.
- Existing OpenBot surface checked: `.github/workflows/ci.yml` currently runs the complete suite and
  PostgreSQL verification on Ubuntu only; Provider conformance deliberately distinguishes contract,
  integration, and real-device evidence.

## Candidate comparison

| Candidate | Exact release or commit | License | Fit | Decision |
| --- | --- | --- | --- | --- |
| GitHub runner images | [`148c0a4a`](https://github.com/actions/runner-images/tree/148c0a4acb53bb2c7c853446a290aec86b61d3c3) | MIT | Documents GA `ubuntu-24.04`, `windows-2025`, and `macos-15` images and their architectures | Use explicit labels, not moving `-latest` aliases |
| Existing OpenBot CI actions | `actions/checkout@11d5960a` and `actions/setup-node@49933ea5` | MIT | Already reviewed, full-commit pinned, and configured not to retain repository credentials | Reuse unchanged in a matrix job |
| Current Ubuntu-only full check | current branch | MIT | Exercises PostgreSQL and the entire monorepo but cannot validate Windows path/mode branches | Keep as authority; add a smaller portable matrix rather than tripling the database job |

## Proposed decision

- Add one non-database matrix job for `ubuntu-24.04`, `windows-2025`, and `macos-15` using the
  repository's exact Node.js 22.22.2 and npm lockfile.
- Run protocol, config, Provider SDK, Node, and Web type checks/tests that do not require native GUI
  access. POSIX-only assertions remain explicit skips on Windows.
- Do not label an operating system `Supported` from hosted CI alone. A platform earns that label only
  after its real Worker Host installer, service lifecycle, credential storage, permission boundary,
  and Provider conformance evidence pass on declared hardware.
- Implementation is deferred until the branch can be pushed and all three hosted jobs observed;
  adding an unobserved green badge would be a false portability claim.

## Source incorporation and exit plan

No upstream source or workflow text is copied. The implementation will reuse the already-pinned
actions and standard runner labels. If a runner image is deprecated, update the explicit label only
after reviewing the replacement image announcement and passing the matrix.
