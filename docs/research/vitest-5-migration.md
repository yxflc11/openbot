# Research: Vitest 5.0.0 migration

- Status: Accepted
- Date: 2026-09-11
- Owner: @yxflc11
- Related: Dependabot #27 (superseded); follows #42 ACL harness on `main` @ `3b010cf`
- Acceptance journey: full `npm run check` and three-platform Portable CI run green on Vitest
  **5.0.0** with existing assertions intact, durable Open-source research, and no unrelated
  Dependabot patch churn from #43.
- Security boundary: **development-only** root `devDependency` test runner. Vitest does not ship in
  the Server production image, Desktop native runtime packaging, or Worker Host archives. No change
  to production ACL, credential, or approval authority.

## Search evidence

- Search date: 2026-09-11 (Asia/Shanghai)
- Upstream:
  - [Vitest 5 migration guide](https://vitest.dev/guide/migration/)
  - [Vitest 5.0.0 blog](https://vitest.dev/blog/vitest-5.html)
  - [vitest `v5.0.0` / `f441c6fa`](https://github.com/vitest-dev/vitest/tree/f441c6fab25e579c5b7dd3dd50538416f415fbae)
  - npm `vitest@5.0.0` (MIT; engines `^22.12 || ^24 || >=26`; peer Vite `^6.4 || ^7 || ^8`)
- Repo audit artifact: `/workspace/openbot-dep-audit/vitest5-impact.md` (base `main` @ `3b010cf`)
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - Dependabot #27 (package.json + lock only; `research:check` fails; Windows ACL 60s red pre-#42)
  - #42 Windows native ACL test budget (merged; `NATIVE_TIMEOUT_MS = 120_000` + spawn hygiene)
  - #43 patch consolidation (hono/biome/types/filename) — **excluded** from this PR
  - Ledger rows pinning Vitest `4.1.11` (Provider conformance runner; Web jsdom tests)
  - `docs/research/windows-native-acl-test-budget.md`

## Repo impact vs Vitest 5 breaking changes

| Migration item | Repo evidence | Verdict |
| --- | --- | --- |
| Node ≥ 22.12 / Vite ≥ 6.4 | `engines.node` and Vite 8.2.2 already meet peers | N/A (prereq OK) |
| `clearMocks` default **true** | No `clearMocks` config; call-count suites already `resetAllMocks` / `mockReset` in hooks | WATCH — prefer suite proof over `clearMocks: false` |
| Hoisted `vi.mock` / `vi.hoisted` must be top-level | ~20 `vi.mock` + 1 `vi.hoisted`; all module top-level | N/A |
| Remove `test.sequential` | Zero matches | N/A |
| Unawaited `resolves` / `rejects` | Heavy `await expect(...).rejects\|resolves`; deferred patterns still awaited | WATCH |
| Artifact dirs → `.vitest/` | `.gitignore` lacked `.vitest/` | Optional — add ignore |
| Browser / coverage / poolOptions / projects | Not configured | N/A |
| `it.each` `$` title quoting | One `$name` in `execution-routing.test.ts` (cosmetic / `-t`) | WATCH |

### #27 Windows 60s vs #42

Portable Windows on Dependabot #27 timed out the Node native ACL test at **60000ms**. The **same**
timeout existed on Vitest **4.1.11** on `main` before #42. #42 raises the native deadline to
**120s** and fixes PowerShell spawn hang (`shell: false`, stdin `.end()`, 15s `execFile`). Vitest 5
did not invent that failure; #42 + Vitest 5 is the expected clear path, still verified by this PR’s
Windows Portable job.

## Candidate comparison

| Candidate | Exact release or commit | License | Fit | Decision |
| --- | --- | --- | --- | --- |
| Vitest **5.0.0** dedicated researched PR on `main` ≥ `3b010cf` | `5.0.0` / `f441c6fa` | MIT | Prerequisites met; small config surface; research gate satisfied | **Select** |
| Merge Dependabot #27 as-is | same pin, no research | MIT | Fails `research:check`; stale vs #42 | Reject / supersede |
| Stay on Vitest 4.1.11 | `4.1.11` | MIT | Blocks upstream maintenance without actual repo blocker | Reject |
| Bundle with #43 patch bumps | mixed | — | Unrelated runtime/dev patches; out of bounds | Reject |
| Preemptively set `clearMocks: false` | config escape hatch | — | Weakens isolation; prefer fixing real failures | Reject unless suite proves need |

## Reuse decision

- Selected option: dependency (exact root pin upgrade)
- Selected upstream: Vitest `5.0.0` / `f441c6fab25e579c5b7dd3dd50538416f415fbae` (MIT)
- Why this is the first viable option: already the repository test runner; Node/Vite floors match;
  API blast radius in **this** repo is small–moderate after the audit.
- Exact OpenBot-specific gap: bump root `package.json` + regenerate lockfile for Vitest/`@vitest/*`
  5.0.0 only; add durable research + EN/ZH reuse-ledger pins; optionally ignore `.vitest/`; keep
  assertions. Do **not** include #43 deps.
- Upgrade / exit plan: keep exact pins; future Vitest minors/patches follow the same research +
  ledger bump. Roll back by reverting the pin if a runner regression appears.
- Failure behavior: install/`npm test`/`npm run check` fail closed; no silent dual-version Vitest.

## Source incorporation

- Source copied or substantially adapted: no
- Files: npm-released `vitest` + transitive `@vitest/*` via lockfile only
- Notices: lockfile metadata; this note; `docs/OPEN_SOURCE_REUSE.md` /
  `docs/OPEN_SOURCE_REUSE.zh-CN.md`

## Verification plan

- Automated: `npm ci` then `npm run check` (docs, research gate unit tests, container/migrations/
  security/macos/release checks, lint, typecheck, turbo tests, build)
- Negative assertions: **unchanged** — no weakening/deleting fail-closed cases to go green; no
  `sleep` / flaky marks
- Platforms: Linux box full `check`; CI must also green Portable Windows/Linux/macOS (Windows ACL
  natives only prove on win32)
- Support level: Declared dependency pin with Integrated automated check; not a new Certified
  platform claim

## Unresolved questions

- Residual Windows host-load flake under the 120s budget remains possible; monitor Portable job —
  unrelated to rejecting Vitest 5 itself.
- Whether any suite needs `clearMocks: false` is deferred to first green suite evidence (prefer
  fixing assertions).
