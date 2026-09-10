# Research: Server-authorized third-party MCP plugins

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: OpenBot contributors
- Acceptance journey: An Owner previews an external MCP server, installs its exact tool declarations, enables it, grants selected tools to one Bot, then sees that Bot call a read tool and request approval before a write tool executes.
- Security boundary: Server owns endpoints, installation state, Bot grants and single-consumption approvals. Plugin declarations, annotations, results and model arguments are untrusted. No renderer code, process spawning or implicit authority.

## Search evidence

- Search date: 2026-09-10.
- GitHub queries: `modelcontextprotocol/typescript-sdk releases StreamableHTTPClientTransport security`; official repository release `1.30.0`, tree at `2d889f2b329e46680ec9bdd565de4616c497825a`, `test/client/streamableHttp.test.ts`, `test/integration-tests/stateManagementStreamableHttp.test.ts`, and issue [1708](https://github.com/modelcontextprotocol/typescript-sdk/issues/1708).
- Primary documentation: [MCP 2025-11-25 transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [annotation trust](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/), and [cross-client advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-345p-7cg4-v4c7).
- Reviewed the published npm tarball's ESM Client, StreamableHTTPClientTransport, AJV validator, package exports and MIT LICENSE. Registry metadata identifies version 1.30.0 and the commit above; its integrity is `sha512-xKd8OIzlqNzcqcNumGAa6g+PW2kjD5vrpcKOnfldAUPP3j7lnqMPwlTXQm8gF+UwH72z0lqaRbjr9hqGz0eITA==`.
- Existing OpenBot review: `OPEN_SOURCE_REUSE.md` Node protocol and native sources entries; current `native-agent.ts`, `agent-sources.ts`, `model-settings.ts` and approval policies. No existing general plugin runtime.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| MCP standard + official TypeScript SDK | 2025-11-25; @modelcontextprotocol/sdk 1.30.0 / 2d889f2b329e46680ec9bdd565de4616c497825a | MIT | July 27 release includes E2E suite, content-type and SSE lifecycle fixes; client/server and state-management tests; open issue 1708 records session expiry limitations | Node >=18 fits OpenBot; SDK supports custom fetch, typed client and JSON Schema validation; one new client per bounded operation avoids shared sessions | Select released v1 compatibility line, no protocol rewrite |
| MCP 2026-07-28 / split TypeScript SDK v2 | @modelcontextprotocol/server 2.0.0, released July 27 | MIT | Official maintained next protocol generation | Removes sessions/GET and changes negotiation; unnecessary compatibility migration for this narrow 2025 server ecosystem slice | Future adapter behind same service |
| OpenBot-specific JSON-RPC/stdio plugin host | Local | MIT | No existing implementation | Duplicates MCP or gives downloaded code the Server process environment | Reject |

## Reuse decision

- Selected option: open standard, released dependency, thin adapter.
- SDK owns MCP initialization, negotiation, tools/list, tools/call and message validation. OpenBot adds exact endpoint validation, DNS pinning, response limits, atomic Owner configuration, reviewed catalog digests, per-Bot grants and approval lifecycle.
- Declarations and readOnlyHint never grant permission. Owner chooses `read` for a trusted observational tool or `confirm` for approval on every invocation. Results cannot install plugins or approve calls.
- Remote endpoints use public HTTPS; explicit operator allowlist can admit literal loopback development endpoints. Redirects, cookies, arbitrary headers, OAuth auto-discovery, subprocesses, sampling and renderer resources are not exposed.
- New sessions per operation; no replay, retry or fallback on errors. Each call refreshes and compares the reviewed declaration digest. Disabled/revoked/changed grants abort pending and in-flight operations; unknown side-effect completion stays failed and is not retried.
- Single Server serialized atomic file writes with revision checks; no multi-process configuration claim. Exact call arguments are temporarily shown to Owner for approval and then discarded; audit stores identifiers, phases and decisions only.
- Upgrade/exit: keep plugin management and Run authority independent of SDK APIs. Move to v2 only after explicit compatibility research and regression tests.

## Source incorporation

- No upstream source copied or substantially adapted. SDK is a normal pinned dependency; its MIT license remains in the package and is recorded in THIRD_PARTY_NOTICES.md. OpenBot's own bounded HTTPS reader informs its plugin transport adapter.

## Verification plan

- Real local SDK MCP server: preview -> install -> enable -> Bot grant -> read -> pending write -> Owner approval -> exactly one external action -> disable/revocation blocks further calls.
- Negative tests: manifest changes, stale revisions, wrong Bot, tool arguments, no implicit annotations, rejected/expired/aborted approvals, config races, output size, private DNS and redirects; no paid model needed for the plugin service test.
- Bilingual author/runbook, runnable local example, UI integration through authenticated routes and native Run-scoped tool callbacks.
- Evidence permits local MCP tool integration only, not arbitrary plugin sandboxing, third-party service correctness, OAuth interoperability or every MCP feature.

## Unresolved questions

- Public marketplace, OAuth, signed packages, resources/prompts, stdio and plugin-rendered interfaces remain separate work.

## Verification results

- The plugin service suite passes 12 tests, including an actual local HTTP server using the pinned official SDK. The real journey discovers and installs the example, reads `42`, holds a write until Owner approval, appends exactly one note, and blocks calls after disabling. Other tests cover rejection, expiry, cancellation, authorization changes, concurrent decisions and revisions, schema/catalog changes, encrypted credential persistence, and route body-limit isolation.
- Server TypeScript checking and the documentation link check pass. Frontend and native-model integration are checked separately by their owning workstreams; the plugin service result alone does not establish deployed UI or model behavior.
- Public security review checked [GHSA-345p-7cg4-v4c7](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-345p-7cg4-v4c7) (patched in 1.26.0), the upstream [dependency advisory report](https://github.com/modelcontextprotocol/typescript-sdk/issues/2036), and [validator lifecycle report](https://github.com/modelcontextprotocol/typescript-sdk/issues/2605). The lockfile contains SDK 1.30.0, Hono 4.13.5, `@hono/node-server` 2.1.1, AJV 8.20.0, and fast-uri 3.1.7. The older fast-uri ranges reported upstream do not include that locked version. Clients are short-lived and the sample does not share a stateful server across clients.
- Installation reported four moderate vulnerabilities without details. A complete production `npm audit` was not run: automatic approval review rejected sending the dependency tree to the npm audit endpoint. The public package/advisory review above is narrower and does not establish a clean dependency audit or attribute those four findings to the new dependency.
