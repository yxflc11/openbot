# Research: Dependabot patch consolidation (Hono, Biome, @types/react-dom, filename-reserved-regex)

- Status: Accepted
- Date: 2026-09-11
- Owner: @yxflc11
- Related issues / PRs: Dependabot #24, #25, #26, #28 (Vitest major #27 explicitly excluded)
- Acceptance journey: Owner HTTP, lint/format, Web/Desktop TypeScript, and Employee export
  filenames continue to work on the exact-pinned patch releases already proposed by Dependabot,
  with durable research and reuse-ledger pins updated so CI research gates pass.
- Security boundary: Hono remains the Server HTTP framework behind Server identity and policy.
  Biome and `@types/react-dom` are development-only and are not shipped in the Server image.
  `filename-reserved-regex` may influence only advisory export filenames; package bytes and
  reviewed-download validators stay Server-owned.

## Search evidence

- Search date: 2026-09-11
- GitHub queries / upstream:
  - https://github.com/honojs/hono/releases/tag/v4.13.7
  - https://github.com/honojs/hono/compare/v4.13.5...v4.13.7
  - GHSA-hxh3-vqpv-xpqv (`hono/jsx` XSS in Suspense / ErrorBoundary / Context.Provider and
    server render paths)
  - https://github.com/biomejs/biome/releases/tag/%40biomejs%2Fbiome%402.5.12
  - DefinitelyTyped `types/react-dom` 19.2.7 on npm (MIT)
  - https://github.com/sindresorhus/filename-reserved-regex/releases/tag/v4.0.1
  - https://github.com/sindresorhus/filename-reserved-regex/compare/v4.0.0...v4.0.1
- Standards and primary documentation queries:
  - Existing RFC 6266 + export filename research
  - Existing Hono secureHeaders / SSE / ETag reuse entries in `docs/OPEN_SOURCE_REUSE.md`
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - Dependabot PRs #24–#28 and local audit under `/workspace/openbot-dep-audit/`
  - `docs/research/cross-platform-employee-export-filenames.md` (Accepted; pinned 4.0.0)
  - Multiple ledger rows pinning Hono 4.13.5 / `e2740d5a`
  - Vitest 5 Dependabot #27 deferred (major migration + Windows ACL timeout)

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| hono | [`4.13.7` / `eebdf7be`](https://github.com/honojs/hono/tree/eebdf7be39abf0a872671835ccce0c4f03ea497a) | MIT | Upstream release + security advisory; compare includes v4.13.6 client/`$url`/`$path`, WebSocket root URL, Context symbol keys | Exact Server runtime pin; jsx XSS fix is compatible patch for the existing framework | Select over 4.13.5 |
| Stay on hono 4.13.5 | `e2740d5a` | MIT | Prior pin | Leaves GHSA-hxh3-vqpv-xpqv unpatched while a compatible release exists | Reject |
| @biomejs/biome | [`2.5.12`](https://github.com/biomejs/biome/releases/tag/%40biomejs%2Fbiome%402.5.12) / tag commit `0a31d7c4` | MIT OR Apache-2.0 | CLI patch: Astro parser fixes, nursery `useFlatMathMinMax`, Bun builtin `noUnresolvedImports` false-positive fix | DevDependency lint/format only; no runtime ship | Select over 2.5.11 |
| @types/react-dom | `19.2.7` (DefinitelyTyped) | MIT | Types-only npm patch on the React 19.2 line | Aligns with runtime `react-dom` **19.2.8**; no runtime change | Select over 19.2.5 |
| filename-reserved-regex | [`4.0.1` / `d267eb9`](https://github.com/sindresorhus/filename-reserved-regex/tree/d267eb977513e8137062ecca53a15fd78d5b6c92) (fix `7555d54`) | MIT | AVA-tested zero-dependency predicate; release notes: fix Windows reserved name matching | Matches parent research upgrade plan (“recheck device-name set during dependency upgrades”) | Select over 4.0.0 |
| vitest 5.0.0 (#27) | `5.0.0` | MIT | Major: Node floor, `clearMocks` default, mock hoist rules, Windows ACL 60s timeout under v5 | Out of bounds for this consolidation | **Defer / exclude** |

## Reuse decision

- Selected option: dependency (existing exact pins; patch bumps only)
- Selected upstream or standard:
  - Hono `4.13.7` / `eebdf7be39abf0a872671835ccce0c4f03ea497a`
  - `@biomejs/biome` `2.5.12`
  - `@types/react-dom` `19.2.7`
  - `filename-reserved-regex` `4.0.1` / `d267eb977513e8137062ecca53a15fd78d5b6c92` (plus existing `@types/filename-reserved-regex` `3.0.0`; see types re-verify below)
- Why this is the first viable option: each change is a Dependabot semver-patch (or types patch) on
  already-reviewed packages. No API migration is required. Vitest 5 is a separate major.
- Exact OpenBot-specific gap: update exact `package.json` pins + lockfile, refresh EN/ZH reuse
  ledger Hono and filename pins, and keep Durable research linked from the consolidating PR.
  No OpenBot source adaptation of upstream.
- Upgrade, replacement, or exit plan: keep exact pins. Future patches follow the same research +
  ledger bump. Hono can be replaced only with a researched HTTP framework that preserves Server
  policy boundaries. Filename predicate can revert to a standards-equivalent local check without
  changing the public filename shape. Biome / `@types/react-dom` can roll back by reverting the
  exact pin.
- Failure behavior when the upstream is missing, incompatible, or compromised: install, lint,
  typecheck, or Server tests fail closed; no silent fallback to unpinned ranges.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: npm-released packages only via the lockfile
- Required copyright or license notice location: lockfile metadata; this note and
  `docs/OPEN_SOURCE_REUSE.md` / `docs/OPEN_SOURCE_REUSE.zh-CN.md`

## Verification plan

- Automated tests: `npm run check` on the consolidation branch (docs, research gate skip outside
  `pull_request`, lint/format via Biome 2.5.12, typecheck with `@types/react-dom` 19.2.7, Server
  tests covering Hono routes and export filenames, Server container contract covering nested
  production `apps/server/node_modules` + advisory export filename smoke).
- Negative and fail-closed tests: existing Employee export reserved-name cases; existing Server
  security-header / SSE / auth route coverage.
- Platforms and devices: Linux CI check job; no new platform claim.
- User-visible documentation and translations: reuse ledger EN/ZH pin text only; no product claim
  change.
- Support level that the evidence permits: Declared dependency pins with Integrated automated check;
  not a new Certified platform claim.

## Types re-verify (`filename-reserved-regex` 4.0.1)

- Re-checked the published npm tarball for **4.0.1** (not carried forward from 4.0.0 by habit):
  - `package.json` still declares `"exports": { "types": "./index.d.ts", "default": "./index.js" }`.
  - `"files": ["index.js"]` still omits `index.d.ts`; `npm pack` contents are only
    `index.js`, `license`, `package.json`, `readme.md`.
  - Therefore DefinitelyTyped `@types/filename-reserved-regex` **3.0.0** remains required as a
    Server **devDependency** for strict TypeScript; it must not ship in the production image.
- Container packaging follow-up: 4.0.1 nests under `apps/server/node_modules` in the lockfile
  (Desktop nests v3). Runtime packaging now copies that nested omit-dev closure; see
  [server-node24-production-container.md](server-node24-production-container.md).

## Unresolved questions

- None for these four patches. Vitest 5 (#27) remains a separate migration with its own Windows ACL
  timeout investigation.
