# Repository engineering audit

[简体中文](REPOSITORY_AUDIT.zh-CN.md)

Date: 2026-09-10. Scope: the entire OpenBot monorepo, including apps, shared packages, Providers, docs, migrations, packaging and CI. This is an engineering/readability review, not a guarantee that every code path or external service is correct. It does not cover unrelated GitHub repositories.

## Assessment

The repository can be used and extended as an open-source project: it has an MIT license, maintained upstream notices, standard MCP extension entry points, typed Provider contracts, contribution templates, a reuse ledger and executable checks. Shared packages do not import the application layers in the inspected source. Server authority and generated/private data boundaries are explicit.

Readability had fallen behind feature growth. The main problems were stale architecture claims, missing module orientation, an important integration-test gap in CI and accumulated UI style generations. These are concrete maintainability problems; having many files is not itself a defect. A broad rename/rewrite would introduce risk without proving better boundaries.

## Findings and disposition

| Priority | Finding | Action and status |
| --- | --- | --- |
| P1 | PostgreSQL CI covered automation/direct tasks but collaboration tests could remain skipped; reactions/removal added another skipped-by-default suite | Added explicit collaboration and interactions CI steps with separate disposable databases. All four local PostgreSQL suites pass, 49 tests. Hosted CI result must still be observed after push. |
| P1 | `ARCHITECTURE.md` mixed early candidate/fork plans with implemented state; it claimed source-only Run uniqueness, AG-UI and cursor behavior absent from current code | Replaced it with current English architecture and maintained Chinese translation; documented actual composite uniqueness, REST/SSE snapshot behavior, extension boundaries and runtime limits. No duplicate stale architecture copy added. |
| P2 | Contributors had no focused server/web module README or repository map | Added English/Chinese repository maps and module READMEs showing extension ownership and focused tests. |
| P2 | Contribution setup said broad Node/npm versions and `npm install`, unlike the declared engine/locked CI environment | Aligned English/Chinese setup to Node 22.22.2 CI baseline, npm 10.9.9 and `npm ci`; other Node versions must satisfy `package.json`. |
| P2 | Web entrypoint loads several historical global style layers; selector order can defeat a local visual change | New message actions/reactions are isolated components. Global stylesheet consolidation and actual viewport checks remain part of integration review; no blanket “all CSS cleaned” claim. |
| P2 | Large orchestration files concentrate unrelated change points: Server `app.ts`/`postgres-store.ts`/`native-agent.ts`; Web `App.tsx`/`ChannelWorkspace.tsx`/`api.ts` | New interactions/steering/stream helpers/routes are separate modules. Further extraction should follow feature ownership with regression tests; a full legacy split is not claimed. |
| P2 | Historical milestone docs and multiple READMEs can drift while the product evolves | Canonical architecture/map/feature docs now identify current boundaries. Root README/site translation consistency must be included in release review; research notes remain dated decision history. |

## Controls already present

- Strict TypeScript, exact optional fields, unchecked-index protection and runtime schema validation.
- Ordered migration manifest with prefix-history validation; transactional task/approval/audit changes.
- Negative authority, cancellation, provider-boundary and concurrency tests; deterministic SDK tests distinguish mocks from paid-service evidence.
- Pinned major CI dependencies, dependency scanning and read-only secret scanning; generated builds/private profiles are ignored.
- Explicit Server, Node, Client and Provider roles; per-Bot plugin grants; no claim that an interface-only Provider executes.
- Bilingual contribution rules and current feature docs, issue/PR templates and upstream attribution.

## Verification and remaining work

This review ran document-link validation and the 26-file migration manifest check, focused action/reaction component tests, Server/Web type checks, the Server regression suite and all four isolated PostgreSQL suites. The release integrator subsequently passed full root `npm run check`, rendered-demo checks and independent website deployment. Hosted CI passed security, PostgreSQL, both container architectures and macOS. Windows native lifecycle evidence and final release remain required; this audit does not replace those gates.

Before extending an area, follow [REPOSITORY_MAP](REPOSITORY_MAP.md). Prefer a small feature module over adding another branch to an unrelated coordinator. Keep old behavior until the replacement has an actual regression check. Any further removal of files or styles should be based on confirmed references and rendered evidence, not filename age.
