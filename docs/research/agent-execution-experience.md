# Research: Native Agent execution experience

- Status: Implemented and locally verified
- Date: 2026-09-08
- Owner: OpenBot maintainers
- Related issue: Usable Agent delivery milestone, project 3
- Acceptance journey: A Bot uses its configured role; an Owner can stop one native task, understand
  its failure and explicitly resubmit; reported model usage survives reload and is shown honestly.
- Security boundary: PostgreSQL owns terminal state. Cancellation commits before process abort;
  late model/tool results cannot publish a reply or report. Profiles and model metadata confer no
  new tool authority. Usage is provider-reported, not billing or estimated cost.

## Search evidence

- GitHub and official documentation reviewed 2026-09-07/08: `vercel/ai` tag `ai@7.0.93` resolves to
  `6359fd58fe68eaade096b5d923bac26de84ca3bd`. Inspected installed released source for ToolLoopAgent,
  generateText step callbacks, callback isolation, usage aggregation and existing cancellation tests.
- [AI SDK cancellation](https://ai-sdk.dev/docs/advanced/stopping-streams) distinguishes client UI
  stop from propagated Server abort. OpenBot tasks outlive HTTP submissions, so an Owner-authenticated
  durable cancel command must own the AbortController instead of a browser disconnect.
- [ToolLoopAgent API](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent) and pinned
  `packages/ai/src/generate-text/generate-text.ts` show awaited step callbacks and per-step usage.
  Lifecycle errors are isolated: retain a denial flag and check it before continuing/publication.
- [PostgreSQL 17 row locking](https://www.postgresql.org/docs/17/explicit-locking.html) makes
  conditional updates serialize competing terminal transitions. Retain existing Run status values
  and advisory claim locks; cancellation must never target Worker-profile tasks.
- Existing ledger: native Agent loop, desktop conversation continuity, contextual inspector,
  Employee profile details, and PostgreSQL task persistence. All relevant implementations have
  completed reuse reviews; this adds a narrow adapter rather than a second lifecycle library.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance/tests and fit | Decision |
| --- | --- | --- | --- | --- |
| AbortController + PostgreSQL conditional UPDATE | Existing Node 24.20.0 / PostgreSQL 17 runtime | Node.js / PostgreSQL licenses | Maintained core APIs and transactional locks; bind durable cancellation to one native Run before aborting its in-process work | Select standards and existing database adapter |
| AI SDK usage and bounded loop callbacks | ai 7.0.93 / 6359fd58fe68eaade096b5d923bac26de84ca3bd | Apache-2.0 | Released source and tests; provider adapters normalize optional counts. Missing counts must stay unknown; raw usage payload is unnecessary | Select existing released dependency |
| AI SDK useChat client stop | Same AI SDK release, React adapter not installed | Apache-2.0 | Useful for HTTP-scoped chats; current Server tasks persist independently of browser connection and need database cancellation authority | Defer streaming UI to a separate bounded transport review |
| Existing Owner task submission and React UI | React 19.2.8; current OpenBot commit 268063c | MIT | Reuse the current authenticated submission path on explicit user action; preserves task history and existing capability checks | Select thin resubmit adapter; no automatic retry or checkpoint claim |

## Reuse decision

- Selected option: standard cancellation and database locking, existing SDK usage, thin native-task
  API and UI adapters. No added dependency and no upstream source copied or substantially adapted.
- Profile name, role and description are bounded task context, never a tool-granting instruction.
  Record the reviewed revision used. Other Bots' profiles remain out of scope.
- Persist normalized per-Run provider/model, known input/output totals, completeness and step count.
  Missing/invalid counts are unknown. Do not fabricate cost, tokens for aborted requests, or lifetime
  totals from the limited recent workspace sample. Per-step output and existing time/tool limits
  continue to bound execution; a cumulative reported-token threshold prevents subsequent steps.
- Cancel only queued/running native Runs with no assigned Node. Repeated cancellation is idempotent;
  completed/failed/Worker Runs return a conflict. Cancellation and its audit event commit together.
  Process abort follows commit; scope revalidation prevents late publication across process races.
- Resubmit is an explicit new task through existing submission, not resume or silent replay.
  Errors use a fixed code/message catalogue; upstream bodies, secrets and private reasoning never
  enter user-visible failure details.
- Replacement: future streaming/multiple-model configuration retains these durable Run contracts.
  This project does not claim arbitrary providers, stream reconnection, billing accuracy or recovery
  from an intermediate model checkpoint.

## Source incorporation

- Source copied or substantially adapted: no. Public APIs and existing dependencies only.
- Existing Node/PostgreSQL/AI SDK/React notices remain applicable.

## Verification plan

- Finish the project before grouped checks. Use real SDK fixtures for role context, known/missing
  usage, bounds, categorized failures and cancellation while a tool/model is pending.
- Disposable PostgreSQL tests: cancel versus completion/claim, duplicate cancel audit, Worker and
  terminal rejection, durable usage and role binding; no post-cancel reply/report commit.
- Owner API tests: authentication, strict empty body, conflict/unknown mapping, no raw errors.
- UI tests and actual built browser: stop, resubmit, state explanations, reported usage and narrow
  layout; retain existing artifact download and channel state behavior.
- Full npm run check before handoff; CI on the completed project commit.

## Unresolved questions

- Multiple model profiles, arbitrary compatible endpoints, streaming and checkpoint recovery remain
  separate work. Provider-reported usage is not an invoice; cancellation may still incur upstream
  usage before the provider honors abort.

## Completed verification

- Full `npm run check` passed after the project was complete. All 16 disposable PostgreSQL
  integration tests passed, including cancellation/completion races and durable usage.
- Built Web UI with a real Server/database and deterministic model fixtures passed role context,
  three-step usage (300 input / 240 output), in-flight stop, explicit resubmit with a new Run ID,
  two retained cancelled tasks, reload, 1280x900 / 390x844 layouts and zero page errors.
- No paid model request, checkpoint recovery or live provider billing validation was performed.

## Response-body abort review (2026-09-08)

Final review found that the 30-second provider deadline was categorized while receiving headers,
but errors during response-body consumption escaped as an unclassified execution failure.
Reviewed the [WHATWG Fetch abort algorithm](https://fetch.spec.whatwg.org/#abort-fetch) and Node
24.20.0 `lib/internal/abort_controller.js` (release tag object
`8392e555cbdef2145d2cd2a2a7d29204d88d4e15`): abort also applies to response consumption, and a
composed signal retains its reason. The first viable option remains the existing standard API.
Normalize body errors using the same fixed catalogue, preserving Server-originated denial reasons,
classifying oversize as task_limit and discarding untrusted stream error text. No new dependency or
copied source. Verify with actual ReadableStream fixtures that fail or abort after headers, and
retain reader cancellation/release behavior.
