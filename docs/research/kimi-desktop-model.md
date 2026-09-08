# Research: Kimi in the installed desktop runtime

- Status: Accepted
- Date: 2026-09-08
- Owner: OpenBot contributors
- Acceptance journey: Configure Kimi K3 in Desktop Settings, retain the encrypted key across restart, and receive an actual ops reply in the existing test channel.
- Security boundary: Reuse Owner settings, encrypted Server storage, native Agent claims, scoped tools and usage audit. Fixed Moonshot CN endpoint; no new tool authority.

## Search evidence

- GitHub queries: `repo:vercel/ai moonshot`, open Moonshot issues, release tag and provider tests.
- Primary docs: https://ai-sdk.dev/providers/ai-sdk-providers/moonshotai and https://platform.kimi.com/docs/api/chat .
- Existing entries: Server-owned native Agent loop and OpenRouter model entry in OPEN_SOURCE_REUSE.md; native-agent-loop.md. The installed desktop comes from this worktree, while the older main checkout's isolated K3 QA was never installed.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| @ai-sdk/moonshotai | 3.0.45 / 8a09c78c039e2c092468eaeff97faaabf3b77366 | Apache-2.0 | Current release; reviewed provider, message converter, K3 reasoning/tool tests and changelog. Open issues 13907 (gateway billing) and 19632 (raw usage audit). | Provider v4 fits existing ai 7; preserves reasoning_content across tool steps, max_completion_tokens and K3 reasoning effort. Direct endpoint avoids gateway. | Use released provider. |
| Generic OpenAI adapter | existing @ai-sdk/openai 4.0.60 | Apache-2.0 | Maintained existing dependency | Does not supply Moonshot-specific reasoning continuation contract. | Prefer native provider. |

## Reuse decision

Use the released provider with a thin existing settings adapter. Metadata verification uses Moonshot's model list and exact model ID matching. K3 uses low reasoning effort within existing task/output limits. Existing public-source tools only read explicitly supplied URLs; this change does not add search or desktop control. Existing pre-enable tasks are not silently replayed.

## Source incorporation

No upstream source copied or substantially adapted. Dependency LICENSE is retained through the existing desktop native-runtime notice packaging.

## Verification plan

Run metadata/endpoint rejection tests, actual provider tool-continuation tests, full npm run check, package desktop, preserve user profile, save the key through Owner settings, and verify ops's reply plus model usage in the installed app. Windows/Linux packaging is not claimed by this macOS validation.

## Validation on 2026-09-08

- `npm run check` passed in the desktop source worktree (server: 288 passed / 26 database tests skipped; desktop: 202 passed; web: 137 passed).
- Real K3 call through the compiled native Agent returned `Kimi K3 接入成功。`; provider-reported usage: one step, 616 input tokens, 77 output tokens.
- Metadata persistence test reopens the encrypted settings and verifies credential retention without plaintext storage; provider test verifies two-step tool/reasoning continuation and no reasoning in public output.
- `npm run package --workspace @openbot/desktop` passed; generated `apps/desktop/out/OpenBot-darwin-arm64/OpenBot.app`; `codesign --verify --deep --strict` passed (local development signature, no notarization claim).
- Initial installation was deferred while macOS was locked. After the Owner resumed, the updated app was installed at `~/Applications/OpenBot.app`, retaining the existing profile and database. A verified ZIP of the prior application is retained for rollback.
- Owner Settings visibly confirmed Kimi / `kimi-k3`, native Agent enabled, and successful save. The retained encrypted settings file has mode 0600 and contains no plaintext API key.
- The existing `ops` Bot in the existing `test` channel produced a real successful reply. The visible usage for that Run is 963 input / 68 output tokens. No private transcript is copied into this document.
- The old pre-enable queued task was stopped through the Owner UI, retaining its record. Resubmission was blocked by automatic approval review pending explicit Owner authorization; no retry was issued. A subsequent clean quit and restart preserved the same channel/reply/usage, Kimi provider, kimi-k3 model and enabled Agent setting. The installed application is left running in the existing test channel.
