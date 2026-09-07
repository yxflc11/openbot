# Research: Credential helper CI startup allowance

- Status: Accepted
- Date: 2026-09-07
- Owner: @yxflc11
- Acceptance journey: the portable Node credential-helper tests pass under hosted Windows load
  while still rejecting missing helpers, stalled processes, oversized output and invalid requests.
- Security boundary: test-only timing configuration; production helper limits and credential
  storage behavior remain unchanged.

## Search evidence

The [main CI failure](https://github.com/yxflc11/openbot/actions/runs/34129382500/job/101765563983)
failed the stdin/stdout round-trip at its test-selected 1,000 ms helper deadline. The fixture starts
`process.execPath`, not `/usr/bin/secret-tool`. An earlier local parallel run hit the same timeout;
the focused suite and the preceding PR's three-platform run passed. This points to a startup and
scheduling allowance problem, not an unsupported Windows credential backend.

Searches on 2026-09-07: `site.vitest.dev test-timeout test timeout per test`,
`site.nodejs.org api child_process spawn asynchronous timeout`, and the pinned Vitest GitHub release.
Reviewed the existing Linux service/Secret Service reuse entry, helper source, fixtures, and the
existing publisher-keyring suite's local timeout policy.

## Candidate comparison

| Candidate | Pin | License | Evidence and fit | Decision |
| --- | --- | --- | --- | --- |
| Existing Node child-process API | [v22.22.2](https://nodejs.org/download/release/v22.22.2/docs/api/child_process.html) | Node.js license | Maintained built-in API already used by production and all hosted runners; asynchronous spawn and pipe-close events do not guarantee a one-second round trip | Keep real subprocess tests; use the existing permitted 5,000 ms helper deadline for non-timeout cases |
| Existing Vitest local timeout | [4.1.11](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11), [API](https://vitest.dev/api/#test) | MIT | Reviewed release, installed runner timeout handling and existing suite-local usage; supports bounded per-suite/per-test allowances | Give only this describe block a 10,000 ms harness deadline, longer than its helper deadline |
| Global timeout, retries or skipping Windows | Existing test-runner mechanisms | MIT | Would affect unrelated tests or hide portable contract failures | Reject |

## Reuse decision and source incorporation

Reuse the existing runtime and test runner, with no dependency or production changes. Split the
combined missing/timeout/overflow test into individual cases so their budgets and failure reports
are independent. Normal I/O, missing executable and output-bound checks use 5,000 ms; the explicit
stalled-process check retains its 25 ms deadline. Invalid requests remain rejected before spawn.
No upstream source is copied or substantially adapted; no new notices are required.

## Verification plan

Run the focused helper suite, `npm run check`, and the hosted Linux/Windows/macOS matrix. Verify
that timeout and output-limit assertions still pass and that no production constants, workflow
retries, global timeouts, platform skips or dependencies changed. This is test stability evidence,
not a new native keyring or desktop-control support claim. No user-facing behavior changes, so
root README translations do not need changes.
