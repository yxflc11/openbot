# Browser and model tools acceptance — 2026-09-08

[English](2026-09-08-browser-model-tools.md) · [简体中文](2026-09-08-browser-model-tools.zh-CN.md)

The employee browser, model services, and shared public web tools passed the checks below before
push. This report describes the feature changes on top of `5fdd99ced126509e702fc4ad00314bf06f3d50c3`
on `feat/cross-platform-employees`; it supersedes the implementation status in the earlier
[baseline report](2026-09-08-kimi.md). The containing commit identifies the tested source.

## Final local checks

Host: macOS arm64, Node.js `v22.23.2`. Database: disposable `postgres:17.11-bookworm` on loopback
port `55439`, using an in-memory data directory and a database name ending in `_test`.

| Check | Result |
| --- | --- |
| `npm run check` | Passed: documentation, research fixtures, migration manifest, lint, types, tests, and builds. Turbo reused valid cache entries. The PR-event research check is skipped outside a PR event. |
| `npm run test -- --force` | Passed: 352 tests in 49 files; all 23 Turbo tasks executed without cache. Includes 228 Server, 50 Web, 29 protocol, and 16 Node tests. |
| `npm run db:verify` with the isolated database URL | Passed: 19 applied migrations, concurrent/idempotent migration startup, existing control-plane checks, model Run ownership/claims, atomic replies, bounded isolated context, recovery, encrypted connection persistence, revisions, disabled access, content-free tool audit, and concurrent connection capacity. |
| `git diff --check` | Passed. |

## Feature evidence and limits

- The real browser journey and persistent employee profiles passed on the pinned Linux ARM64
  Chromium runtime hosted by Docker on macOS. Desktop and mobile UI evidence and its limits are
  recorded in [Employee browser](../EMPLOYEE_BROWSER.md#verification-on-2026-09-08).
- All 12 registered presets have tool-continuation contract coverage: 11 OpenAI-compatible presets
  including custom, plus native Anthropic. Tests preserve opaque reasoning state in memory and
  cover credential routing, input/output limits, validation, aborts, and sanitized failures.
- The real Kimi retrieval bridge completed one Formula search and two chat completions, returning
  readable evidence and source URLs without encrypted markers. Details are recorded in the
  [shared web tools research](../research/shared-model-web-tools.md#verification-outcome).
- Tavily and other chat providers have contract coverage; this does not claim live API acceptance
  for accounts without an authorized key. Browser evidence does not certify native desktop
  Providers or autonomous multi-step browsing.

Temporary test services and files are removed after verification. Credentials, private transcripts,
and local screenshots are excluded from the commit. Local checks do not imply production deployment
or a successful GitHub-hosted CI run.
