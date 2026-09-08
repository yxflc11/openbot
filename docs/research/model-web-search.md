# Research: Model web search and URL reading

- Status: Accepted
- Date: 2026-09-08
- Owner: @yxflc11
- Related issue: Owner screenshot showing an Employee refusing to research current RTX 5090 prices.
- Acceptance journey: A configured Kimi Employee searches current public information, reads sources,
  and returns a sourced answer instead of claiming no internet tool or requiring individual URL grants.
- Security boundary: Server permits only bounded official search/read formulas on the selected Kimi
  connection. Models cannot select an API host, formula, credential, shell, memory or browser input.
  Public web results are untrusted evidence. No personal browser session is exposed.

## Search evidence

- Search date: 2026-09-08.
- GitHub queries: `MoonshotAI web_search`, `openai/openai-node tool_calls`,
  `openclaw kimi search arguments replay`.
- Existing reviews: model services and Kimi chat entries in OPEN_SOURCE_REUSE.md; employee browser.
- Primary documentation: [official tools](https://platform.kimi.com/docs/guide/use-official-tools),
  [search](https://platform.kimi.com/docs/guide/use-web-search),
  [K3](https://platform.kimi.com/docs/guide/kimi-k3-quickstart),
  [pricing](https://platform.kimi.com/docs/pricing/tools).
- Rechecked installed OpenAI SDK tool types/client and Apache-2.0 license; retained its reviewed
  release/tests and response-timeout issue [#1825](https://github.com/openai/openai-node/issues/1825).
  Upstream search compatibility issue [#52407](https://github.com/openclaw/openclaw/issues/52407)
  and the Kimi forum K3 builtin echo failure were discovery evidence, not locally reproduced bugs.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Existing OpenAI SDK | `7.10.0` / `c22b09bc8bd5feed4ebd02b9f363a1a8b479b5ab` | Apache-2.0 | Reviewed released SDK, tool types, tests, timeout history | Existing abortable Node client; ordinary function tool messages | Reuse |
| Kimi Formula API | v1 contract observed 2026-09-08; `moonshot/web-search:latest`, `moonshot/fetch:latest` | Hosted API; no runtime source copied | Official K3 example and live declaration inspection | Existing regional key; fixed remote search/read boundary | Thin adapter, selected |
| Kimi builtin `$web_search` | v1 contract observed 2026-09-08 | Hosted API | Official guide, mixed older documentation and K3 echo reports | Official K3 guidance prefers Formula | Not selected |
| Existing employee browser | CopilotKit/OpenBot `257c1280d684089be9adb0b35cce262efc7064bf` | MIT | Existing real-browser tests | Persistent account state and human-control boundary; screenshot does not itself give a model search results | Retain human browser; not needed for public search |

## Reuse decision

- Selected option: existing released SDK plus official Formula API adapter; no new dependency.
- The Formula tag is mutable hosted infrastructure, not a reproducible release. Only the reviewed
  search/read names and bounded input schemas are accepted locally; new official tools are not
  automatically granted. Never claim an immutable remote implementation.
- Exact gap: tool declarations, bounded multi-step completions, ephemeral assistant reasoning replay,
  trusted endpoint dispatch, source-oriented prompt and content-free Run tool audit.
- Each Run has a total deadline, call/round/context bounds and no automatic paid retry. Failure of
  an invoked tool fails visibly rather than silently substituting stale model knowledge.
- Other provider adapters retain existing behavior; no undocumented universal search compatibility.

## Source incorporation

- Source copied or substantially adapted: no. Local adapter follows the documented wire contract.
- Existing dependency retains its Apache-2.0 notice. No Formula implementation is distributed.

## Verification plan

- Contract tests: search/read execution and final reply, matched call IDs, K3 reasoning kept only
  in current in-memory tool turns, cancellation, unknown tools, malformed and oversized responses,
  total call limits, audit failure before execution, and no credential/input bodies in audit.
- Live: use the configured Kimi service with synthetic public research; record tool invocation and
  sourced output, without saving private reasoning or credentials.
- Full `npm run check`; maintain Chinese/English user-facing documentation and ledger.

## Unresolved questions

- Native tool support for other providers and authenticated browser automation remain separate.

## Live declaration evidence

Both Formula `/tools` reads succeeded on the configured China endpoint on 2026-09-08.
SHA-256 of the returned declarations: search
`61e3d868d59dd712c8ad4b2156aba5eebd616e657a33a84e544c164eb41226b6`, fetch
`4b5679b23e458e4d33d0b32f9dfdcc18c527a955d0a628719127e7d9dccbfe48`.
The local adapter narrows those schemas rather than executing mutable remote definitions.
A live K3 continuation with previous "no internet" context completed three real `web_search`
executions and returned source URLs. This verifies tool availability, not every price claim.

## Verification outcome

`npm run check` passed. The focused model/client/scheduler suite passed 77 tests. A disposable
PostgreSQL integration verified active-Run-only, content-free tool audit and rejection after completion.
A real K3 `fetch` Run read the NVIDIA product source, persisted the final Bot reply, published its
message event, and recorded exactly `fetch:started` and `fetch:completed`, with no argument/result
body. The temporary database and scripts were removed after verification.
