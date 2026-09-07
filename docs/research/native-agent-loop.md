# Research: Server-owned native Agent loop

- Status: Accepted for implementation
- Date: 2026-09-07
- Owner: @yxflc11
- Acceptance journey: after Owner opt-in, a channel task for a Bot without a computer profile
  invokes its configured model, uses scoped read-only tools, observes their results, continues,
  and atomically stores a Bot reply or a visible failure with bounded progress.
- Security boundary: Server owns the Run and tool scope. Model output cannot select another
  channel, grant permissions, access secrets/memory, execute code, or control a Worker.

## Search evidence

Searches on 2026-09-07: `vercel ai ToolLoopAgent releases`, `ai-sdk ToolLoopAgent stopWhen`,
`NousResearch hermes-agent agent loop`, and the official OpenAI Agents JS releases.
Reviewed the existing model-settings, routing, PostgreSQL, Node authority, and Employee reuse
entries; `RunDispatcher` excludes `none` profiles and has no model loop. The current model settings
only validate metadata. Existing queued messages must not silently become paid model calls.

Primary documentation: [AI SDK agents](https://ai-sdk.dev/docs/agents/building-agents),
[tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling), and the pinned package
sources listed below. npm tarballs and their source, LICENSE and exact dependency manifests were
inspected before dependency installation. The pinned GitHub agent directory contains runtime,
type and stream tests. Open issues 20424-20429 concern stream tool-choice enforcement and the
OpenAI provider-executed apply_patch tool; this slice uses non-streaming generation and only local
schema-checked read tools, with its own failure assertions and no provider-hosted tools.

## Candidate comparison

| Candidate | Reviewed pin | License | Maintenance/tests and fit | Decision |
| --- | --- | --- | --- | --- |
| Vercel AI SDK | [ai 7.0.93](https://github.com/vercel/ai/tree/ai%407.0.93/packages/ai/src/agent), @ai-sdk/openai 4.0.60, @ai-sdk/anthropic 4.0.49; provider 4.0.10 and provider-utils 5.0.36 | Apache-2.0 | Released npm packages; Node >=22 matches the repo; maintained source, tests and issues; typed ToolLoopAgent already executes tools and returns observations to the model | First viable released loop dependency with both existing model providers; use explicit provider instances, no gateway |
| OpenAI Agents JS | [v0.17.0](https://github.com/openai/openai-agents-js/releases/tag/v0.17.0), 2026-08-19 | MIT | Maintained typed runner, tests, tools, tracing and handoffs; non-OpenAI models require a separate provider integration | Viable but a less direct fit for existing OpenAI/Anthropic settings; do not add another orchestration/tracing system |
| Hermes Agent | [63279301](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d), previously reviewed learning and runtime reference | MIT | Active Python agent with tool/observation iteration and learning; bringing its datastore and runtime into the authoritative Server would duplicate control planes | Preserve explicit inspiration; defer external delegation adapter |
| Local bespoke model/tool loop | Existing OpenBot lacks one | MIT | Would duplicate released model adapters, tool parsing, iteration and stop semantics | Reject; implement only the OpenBot authority/storage adapter around the SDK |

## Reuse decision

Use ToolLoopAgent with five model steps, eight executed tools, 1,024 output tokens per step,
90 seconds per Run, 30 seconds per HTTP exchange and at most two concurrent Runs. Disable automatic
model retries and telemetry. Limit official endpoint responses to 512 KiB and tool/context text to
bounded projections. Bound final replies to 8,000 characters; reject incomplete/empty results.

The Owner explicitly enables inference in model settings. Existing records default disabled.
Only tasks created after enabling are eligible; old queued work is not replayed. Changes to model
settings abort active inference. Keys stay inside Server; no key, request body, chain-of-thought or
raw upstream error is put in progress/audit. Configuration summaries expose the enabled flag only.

Only `executionProfile=none` Runs with no Node can enter this loop. Atomically claim queued Runs;
serialize within a channel, bound global concurrency, and use the existing startup interruption
policy. No automatic inference retry after crash, ambiguity or shutdown. Snapshot current-channel
messages and task status in bounded SQL reads, recheck Bot membership, and bind all tools to the
claimed channel/Bot. No model-supplied channel/host identifier, memory retrieval, shell, network
fetch, approval decision, executable skill, or Worker capability is exposed as a tool.

Persist running/progress/failure and atomically finish with the Bot-authored reply using existing
Run/message/audit tables. Server progress can omit nodeId; it must not invent an execution Node.
Existing Worker profile tasks retain their deterministic routing/approval path. Native browser
observe/act integration is a later separately authorized tool adapter, not bypassed here.

## Source incorporation and exit plan

No upstream implementation is copied or substantially adapted. Ship the dependencies with their
Apache-2.0 notices; add the pins to THIRD_PARTY_NOTICES and both reuse ledgers. Revisit stable SDK
patches through the same review and HTTP contract suite. The OpenBot adapter depends on a narrow
runner interface so a later replacement preserves Server identity and persistence.

## Verification plan

- Real SDK with deterministic provider responses: tool call -> result observed by next model call
  -> another step -> final reply; both OpenAI and Anthropic HTTP contracts.
- Reject unknown tools, malformed arguments, step/tool/output limits, redirects, oversized provider
  bodies, disabled/replaced settings, inaccessible storage and aborts; suppress raw errors.
- PostgreSQL tests: one claimant, correct channel/Bot scope, no Worker-profile claim, no old-task
  replay, transactional completion and visible restart failure.
- UI opt-in default-off and submitted setting; local full check and hosted three-OS/package matrix.
- Update execution plan first, then bilingual runtime documentation and maintained README claims.
  Hermetic HTTP tests are not claims of paid live-provider or real desktop-control certification.

## Local verification results (2026-09-07)

- `npm run check` passed after the final runtime/UI changes. Production `npm audit --omit=dev`
  reported zero known vulnerabilities.
- Native loop suite: 13 tests, including the real OpenAI/Anthropic adapters, invalid tool/input
  denial, step/tool/output bounds, no model retries, cancellation and two-Run/channel scheduling.
  SDK lifecycle callbacks isolate exceptions, so denial is explicitly propagated into the next
  `prepareStep` and final validation. OpenAI response storage and SDK telemetry are disabled.
- Disposable PostgreSQL 17.10 on loopback: 10 integration tests passed, including a full new-task
  -> real SDK tool iteration -> persisted Bot reply journey, atomic rollback, duplicate claims,
  membership revocation and startup interruption. No user database or provider credential used.
- Playwright checked the built shared Desktop renderer at `http://127.0.0.1:5178`, 1280x900 and
  390x844, with fixture-only HTTP and a Desktop bridge. Browser plugin was not available.
  Page identity, content, no framework overlay, default-off consent, checkbox/save feedback,
  cleared password field and no horizontal page overflow passed. No page errors. The existing
  meta CSP `frame-ancestors` warning remains; this test does not claim frame protection from a
  meta tag or test a native OS window.
- Hosted three-platform build/package and database checks remain mandatory on the PR's final
  commit before merge. Hermetic fixtures are not paid live-model or desktop-control evidence.
