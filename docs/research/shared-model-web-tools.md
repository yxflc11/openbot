# Research: Shared web tools across model providers

- Status: Accepted
- Date: 2026-09-08
- Owner: @yxflc11
- Related issue: Owner correction that web access must not be limited to Kimi Employees.
- Acceptance journey: Any configured tool-capable chat model can search/read through one Server-owned
  retrieval service, continue with readable evidence and return sources, preserving its selected model.
- Security boundary: The Server separately selects inference and retrieval credentials/endpoints.
  Only bounded public search/read is granted. Full chat history never goes to a retrieval bridge.
  Search results are untrusted; no browser login, input, local network or shell authority is added.

## Search evidence

- Search date: 2026-09-08.
- GitHub: `tavily-ai/tavily-js releases`, `anthropics/anthropic-sdk-typescript tool_use tool_result`.
- Primary contracts: [Tavily search](https://docs.tavily.com/documentation/api-reference/endpoint/search),
  [extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract),
  [Claude tool results](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls),
  [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai),
  [DeepSeek thinking](https://api-docs.deepseek.com/guides/thinking_mode/),
  and the already reviewed Kimi Formula API.
- Existing ledger and research: model-service-presets and model-web-search. SDK types and local
  source were rechecked; current tool execution and abort/response bounds are reused.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Existing OpenAI and Anthropic SDKs | OpenAI `7.10.0` / `c22b09bc`; Anthropic `0.124.0` / `ba14b1f4` (full pins in model-service-presets) | Apache-2.0; MIT | Existing reviewed source/releases/tests; maintained tool-call APIs | Standard function messages and native tool_use/tool_result, including opaque reasoning state | Reuse both |
| Tavily hosted search/extract | API contract observed 2026-09-08 | Hosted API, no source distributed | Official schemas and service documentation; local adapter contract tests required | Plaintext source results independent of chat provider; separate key | Optional shared retrieval backend |
| Existing Kimi Formula plus Kimi text bridge | v1 observed 2026-09-08; existing pinned SDK | Hosted API; Apache-2.0 SDK | Live Formula search/read proven in preceding research | Formula search may be encrypted for Kimi; another provider cannot consume it directly | Reuse configured Kimi only through a bounded plaintext bridge |
| Per-provider proprietary built-in search | Provider API contracts observed 2026-09-08 | Hosted APIs | Uneven model/protocol availability | Would duplicate authority, accounting and retrieval behavior per model | Not needed for shared tools |

## Reuse decision

- Selected: existing SDKs, a common allowlisted tool executor, optional Tavily REST adapter, and a
  Kimi retrieval bridge for existing installations. No new dependency or source copy.
- Retrieval preference: explicit Tavily key, explicit saved Kimi retrieval connection, then the
  configured legacy Kimi service. Never guess another saved account or substitute the Employee model.
- Native Kimi can keep its direct Formula path when no shared override exists. Other models receive
  readable retrieval evidence; Kimi ciphertext is never passed across providers.
- A bridge receives only the validated tool request, performs at most one Formula call, and returns
  plaintext using at most two Kimi completions. Four outer tool calls and one total deadline remain.
- Preserve complete OpenAI-compatible assistant state (including Gemini signatures and DeepSeek
  reasoning) and Claude thinking/signatures in memory for tool turns, never in persisted history.
- Fail visibly for unavailable search services, unsupported model tool calling, invalid/duplicate
  calls, output limits or timeout. Never silently retry a paid request or use stale facts as fallback.

## Source incorporation

- No source copied or substantially adapted. Existing SDK licenses remain intact.
- Hosted API tags are mutable and are not described as reproducible runtime releases.

## Verification plan

- Contract matrix for all registered OpenAI-compatible presets plus native Anthropic and custom.
- Shared executor routing, separate credentials, plaintext bridge, complete opaque state replay,
  batch validation before effects, call/context/deadline limits and sanitized failures.
- Live existing Kimi bridge and available authorized provider checks; no claim of live testing
  providers without an available key. Full `npm run check` and bilingual documentation.

## Unresolved questions

- Individual model IDs may lack function calling even when their provider API supports it.
  Native UI/account capabilities are not evidence of API compatibility.

## Verification outcome

- `npm run check` passed after the final compatibility fix. Every registered preset exercises a
  complete tool continuation (11 OpenAI-compatible presets and native Anthropic), with separate
  credential-routing, privacy, validation, bounded output and failure tests.
- The live Kimi bridge completed exactly one Formula search and two chat completions, returning
  readable evidence with source URLs and no encrypted markers. A first live attempt identified
  `tool_choice: specified` as incompatible with Kimi thinking; the bridge now exposes only the
  requested tool and requires observed completion without forcing that parameter.
- Tavily and other chat-provider integrations have contract coverage. No live account claim is
  made for a provider without a corresponding authorized test key.
