# Research: provider presets in the installed Desktop

- Status: Accepted
- Date: 2026-09-08
- Scope: integrate the reviewed eleven-provider catalog into the installed Desktop settings and native Agent; preserve its local identity, encrypted settings and existing Kimi implementation.

## Evidence and reuse decision

The current Desktop comes from `e22658b`, not the older `5fdd99c` service checkout. Reuse the Desktop Owner model-settings service and native ToolLoopAgent entry in OPEN_SOURCE_REUSE, rather than transplanting the older database or introducing a second settings authority. The [provider investigation](model-service-presets.md) records official endpoints, regions and model suggestions for all eleven providers. Its database-connection design applies to the older service experiment; this Desktop uses its existing single encrypted default.

Existing `@ai-sdk/openai@4.0.60`, `@ai-sdk/anthropic@4.0.49`, `ai@7.0.93` (Apache-2.0), OpenRouter provider and `@ai-sdk/moonshotai@3.0.45` are pinned by the lockfile. Their reviewed source, tests, maintenance and open issues are in [native Agent research](native-agent-loop.md), [Kimi review](kimi-desktop-model.md) and the reuse ledger. Inspected the installed OpenAI chat source, model capabilities and parameter mapping. [Official OpenAI SDK provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/openai) confirms explicit `.chat()` and baseURL; [DeepSeek thinking documentation](https://api-docs.deepseek.com/guides/thinking_mode/) requires reasoning continuation when thinking tools are enabled. GitHub/search queries: `vercel/ai @ai-sdk/openai@4.0.60`, `createOpenAI chat baseURL`, `DeepSeek thinking disabled tool calls`.

First viable choice: existing released SDKs plus a thin catalog/endpoint adapter. No new dependency or upstream source copying. Preserve native OpenAI Responses, Anthropic Messages, Kimi reasoning continuation and OpenRouter routing restrictions; use explicit Chat Completions for other documented compatible endpoints. Disable DeepSeek thinking for this generic adapter, split MiniMax private reasoning, and fail if private think tags remain in visible output. No new tools, automatic retries or authority.

Only catalog endpoints are accepted and checked again at inference. Regional endpoints are stored with credentials and validated together. Optional endpoint fields keep old encrypted settings readable. Model discovery is bounded metadata-only, never inference; unsupported listing providers accept explicit model IDs and clearly report that credentials were saved without online validation. No custom host input is introduced in this Desktop update. Suggested IDs are editable and do not assert account availability or tool capability.

## Validation

Endpoint substitution, region changes, encrypted round-trip, metadata limits, SDK request shape, UI preset/default selection, key clearing, retained settings and full npm run check. Repackage locally with the existing identity, backup before replacement, verify the installed UI catalog and existing data. No live third-party paid call is required for installation.

## Observed results

- Full `npm run check` passed after updating the existing settings-request expectation for the explicit base URL. Dedicated adapter/metadata/UI tests passed, including the seven added compatible providers. Database integration cases requiring external test databases retain their existing skip conditions.
- `npm run package --workspace @openbot/desktop` completed on macOS arm64; the installed app passed `codesign --verify --deep --strict` (local development signature, not a notarized release).
- Installed at `~/Applications/OpenBot.app`, retaining the existing Preview-compatible data root. Actual native UI showed eleven providers; selecting DeepSeek populated `deepseek-v4-flash`. Returning to settings restored the saved Kimi K3 choice and enabled Agent. The encrypted settings fingerprint and permissions were unchanged. Existing workspace restored after local database/Server startup.
- Previous app archived and ZIP integrity checked before replacement. No saved provider settings changed and no paid inference requests were made during update verification.
