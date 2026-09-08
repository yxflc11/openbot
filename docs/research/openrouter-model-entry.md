# Research: OpenRouter model entry

- Status: Implemented and locally verified
- Date: 2026-09-08
- Owner: OpenBot maintainers
- Acceptance journey: choose OpenRouter in existing model settings, verify an inference key and a
  concrete tool-capable model, retain encrypted settings, and use the same bounded Agent loop.
- Security boundary: Server owns the key, model selection, tools and task state. Credentials go
  only to fixed OpenRouter API paths. No arbitrary base URL, gateway plugin tools or model fallback.

## Research before implementation

Reviewed official documentation and GitHub on 2026-09-07/08. Existing model-settings and native-loop
reuse records are complete. Inspected pinned package metadata, Apache license, src/provider.ts,
src/types/openrouter-chat-settings.ts and src/tests/provider-options.test.ts. The maintained release
has Node/edge and end-to-end suites; issue 512 documents retired-model fixtures, and issues 491/504
show reasoning/tool replay compatibility remains model-specific. No universal model-support claim.

| Candidate | Exact release/commit | License and fit | Decision |
| --- | --- | --- | --- |
| OpenAI-compatible HTTP with the current OpenAI adapter | @ai-sdk/openai 4.0.60, existing AI SDK 7.0.93 | Apache-2.0; standard chat shape works, but router-specific reasoning and provider-policy fields need adaptation | Prefer the released maintained router adapter for its existing tested fields |
| OpenRouter AI SDK provider | 3.0.0 / c1ce69ab9dfe9ca87a57e1db5faf35ee78f6fa1a | Apache-2.0; Node >=22, ESM, peers ai ^7 and Zod 3/4, compatible with this repository | Select released dependency, exact version pinned |
| General OpenRouter SDK or separate Agent runtime | Not selected | Duplicates existing model-loop abstraction and expands tools/runtime ownership | No added runtime |

Official contracts: [key metadata](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key),
[model endpoints](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model),
[provider routing](https://openrouter.ai/docs/guides/routing/provider-selection),
[released adapter](https://github.com/OpenRouterTeam/ai-sdk-provider/releases/tag/3.0.0).

## Narrow adapter policy

- Owner selects one explicit author/model slug. Verify `/api/v1/key`, then bounded metadata from
  `/api/v1/models/{author}/{slug}/endpoints`; no completion is generated during verification.
  Reject management/provisioning keys, mismatched model identity and enabled Agent models without
  a declared tool-capable endpoint. Metadata does not prove generation availability or quality.
- Inference is only POST `https://openrouter.ai/api/v1/chat/completions`, using the released chat
  adapter and existing 30-second/512-KiB request, 90-second task, step/tool/token/cancellation limits.
- Set `provider.require_parameters=true`, `allow_fallbacks=false`, `data_collection=deny`; request
  policy is verified in HTTP fixture tests. This is a routing request, not independent certification
  of third-party retention. UI explains that OpenRouter routes content to its model providers.
- No provider-hosted tools, web search plugins, BYOK key injection, dynamic endpoints or automatic
  model selection. Private reasoning/raw bodies do not enter persisted progress or Owner responses.
- Existing encrypted storage remains v1 and backward compatible; summaries expose no key. Model
  changes retain explicit opt-in and interrupt active requests as before.

## Verification

Complete the slice before grouped settings, released-adapter HTTP-loop, usage, UI and full repository
checks. Exercise two-step tool feedback, exact credentials/endpoint/routing body, invalid paths,
rejected keys, metadata limits, persistence and zero extra network requests. No paid inference.
Revisit adapter compatibility before upgrades or adding model-specific reasoning options.

Source copied or substantially adapted: no. Use the released public API; retain Apache-2.0 notice
in THIRD_PARTY_NOTICES.md and the packaged dependency license.

Integration inspection found that the Web sidebar omitted its model-settings entry despite the
existing Owner API. Expose the same Server-owned settings component through the Web sidebar,
while preserving the mounted workspace behind settings. This adds no new authority or API.

## Completed evidence

- Full npm run check passed; production dependency audit reports zero vulnerabilities. The real
  released adapter completed two HTTP-fixture model steps, including tool feedback, exact routing
  parameters, credential confinement and normalized usage without raw reasoning persistence.
- Public metadata GET for openai/gpt-4o-mini returned HTTP 200, matching ID, three endpoints and
  declared tool support on 2026-09-08. No credential or inference request was sent.
- Actual built Web/Server/database with metadata fixtures passed settings navigation, OpenRouter
  selection/save, opt-out, secret-free summary, reload retention, preserved unsent workspace draft,
  1280x900 / 390x844 layouts and zero page errors. Paid inference remains unverified.
