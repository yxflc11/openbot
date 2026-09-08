# Research: Server-owned Kimi model chat

- Status: Accepted
- Date: 2026-09-08
- Owner: @yxflc11
- Related issue: User-requested model integration in the local OpenBot workspace.
- Acceptance journey: An authenticated Owner creates a model Employee, sends a channel message,
  and receives a persisted Kimi K3 reply with realtime Run updates, without a Worker Host.
- Security boundary: Only the Server selects the endpoint, key, model, identity, history, and
  execution profile. Model output is text data, never a tool invocation or an authority grant.

## Search evidence

- Search date: 2026-09-08.
- GitHub queries: `openai/openai-node releases chat completions fetch timeout maxRetries`,
  `MoonshotAI kimi k3 API node sdk`, and `MoonshotAI/kimi-agent-sdk`.
- Primary documentation: [Kimi Chat Completions](https://platform.kimi.com/docs/api/chat),
  [model discovery](https://platform.kimi.com/docs/api/list-models), the fixed OpenAI Node SDK
  client source, tests, Apache-2.0 license, releases, and open issue list.
- Existing entries checked: `OPEN_SOURCE_REUSE.md` Server realtime/shutdown, deterministic routing,
  PostgreSQL migration/store coverage, ADR-0008 task Runs, ADR-0009 assignment, and ADR-0021 shutdown.
  Those boundaries are reviewed; multi-Server scheduling remains out of scope.
- SDK issues checked: [#1825](https://github.com/openai/openai-node/issues/1825) response-body timeout
  history and [#2153](https://github.com/openai/openai-node/issues/2153) Node header timeouts.
  The fixed client now includes body-parse deadline handling. OpenBot additionally passes a total
  abort deadline and caps received bytes, including reasoning and error bodies.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| OpenAI-compatible Chat Completions with OpenAI Node SDK | `openai@7.10.0`, `c22b09bc8bd5feed4ebd02b9f363a1a8b479b5ab` | Apache-2.0 | Released 2026-09-03; maintained client, resource, streaming, timeout, and retry tests; source and issue history inspected | Node >=22 matches this repository; configurable base URL, abort, disabled logging/retries, injectable fetch | Selected released dependency with narrow Kimi adapter |
| Kimi Agent SDK | `ed4be6be5280d02191da88bbafb3f828dcd33d72` | Apache-2.0 | Maintained SDK and examples for the Kimi CLI wire protocol | Introduces a CLI agent/tool lifecycle that is unnecessary for text chat and cannot own OpenBot authority | Not selected |
| Kimi K3 reference | `3cb39dfd32e51c3328e2e4b4af21341247d06c43` | Reference only; no model weights or source incorporated | Official API usage guidance | K3 always reasons and requires complete private assistant state when replaying native assistant messages | API behavior reference |

## Reuse decision

- Selected option: released dependency plus a thin adapter for the documented compatibility API.
- Selected upstream: OpenAI Node SDK `7.10.0`; Kimi official HTTPS endpoints only.
- Why first viable: the compatibility API is documented rather than an independent open standard;
  its maintained SDK already provides the client, parsing, cancellation, and typed request surface.
- Exact local gap: explicit `model` Employee profile; Server-only atomic Run transitions; bounded
  scheduling and same-conversation ordering; bounded prior visible exchanges; existing SSE and
  persistence integration. No Node capability or remote tool authority is added.
- Conversation design: each call is a fresh completion with the current request and bounded prior
  visible exchanges supplied as quoted user context. Native assistant messages are not replayed,
  so private K3 reasoning need not be persisted, exported, or exposed in audit/UI.
- Exit plan: replace the narrow model client while retaining Server-owned Run and message contracts.
- Failure behavior: absent key, upstream rejection, timeout, oversized/invalid output, tool output,
  or interrupted execution produces a failed Run; no automatic paid retries or tool execution.
  No remote request runs for `none` or computer profiles. Redirects are rejected.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: dependency only; local policy, adapter, and lifecycle code.
- Notices: the SDK distribution retains its Apache-2.0 license; reuse is attributed in the ledger.

## Verification plan

- Automated: provider request/response tests, bounded context, lifecycle ordering, exactly-once
  claim/completion, realtime publication, and full `npm run check`.
- Negative: missing key, invalid endpoint, HTTP errors, timeout/cancellation, oversized body,
  invalid/empty/truncated/tool output, concurrent enqueue, and no Node ownership of model Runs.
- Real environment: isolated PostgreSQL migration/store tests and live authenticated HTTP → K3 →
  persisted Bot reply using synthetic prompts only, followed by cleanup.
- Documentation: English and Chinese setup/API documentation and reuse ledger; create-dialog entry.
- Support level: experimental Server text chat on the tested macOS arm64 / Node 22 environment;
  no new desktop, browser action, multi-Server, or native platform support claim.

## Unresolved questions

- Native preserved-reasoning conversation storage, token-by-token UI streaming, model selection UI,
  and model-driven tools remain separate features.
