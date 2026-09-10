# Research: asynchronous native collaboration and steering

- Status: Accepted
- Date: 2026-09-10
- Acceptance journey: two channel Bots run concurrently, a coordinator starts a colleague assignment without blocking its own next action, receives the persisted result, and an Owner correction reaches the next model step.
- Security boundary: PostgreSQL owns task identity, channel membership, ancestry, cancellation, steering and final replies. Provider text remains untrusted and streamed drafts never become authority.

## Search evidence

Reviewed existing native-agent, channel-bot-collaboration and channel-context-routing reuse entries. GitHub searches: `repo:vercel/ai ToolLoopAgent stream prepareStep`, `ToolLoopAgent stream abortSignal hangs`, and `prepareStep messages preserved`. Primary documentation: https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent and https://ai-sdk.dev/docs/agents/loop-control. Reviewed installed `ai` 7.0.93 source at 6359fd58fe68eaade096b5d923bac26de84ca3bd, including ToolLoopAgent and stream result types/tests, and PostgreSQL 17 transactions/advisory locking (https://www.postgresql.org/docs/17/explicit-locking.html).

## Candidates and decision

| Candidate | Exact version | License / maintenance | Fit and decision |
| --- | --- | --- | --- |
| AI SDK ToolLoopAgent | 7.0.93 / 6359fd58fe68eaade096b5d923bac26de84ca3bd | Apache-2.0; maintained upstream with mock language model tests | Selected released dependency. Reuse stream and prepareStep rather than introducing a model loop framework. |
| PostgreSQL transaction locks | 17 / ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1 | PostgreSQL License; maintained concurrency tests | Selected existing standard database facilities for global root capacity, per-Bot claims, bounded tree creation and ordered steering. |
| A2A protocol | v0.3.0 (previous channel collaboration review) | Apache-2.0 | External-agent transport does not replace local Server authorization, Run persistence or same-channel task ownership. Do not add a second authority. |

Upstream issues #15430 (midstream cancellation hanging), #15864 (stream callback forwarding), #9631 (prepareStep replacement messages not retained) and #14170 (cache cost of dynamic tools) inform the adapter. Consume the full event iterator with explicit abort racing, expose only text deltas, retain accumulated steering on every prepared prompt, and keep the tool set stable. Do not use provider reasoning or SDK error bodies as UI content. No dependency upgrade or source copy/substantial adaptation.

The local gap is bounded same-channel task coordination: asynchronous start receipts, result joins and safe completion barriers; authenticated corrections retained as RunEvents; and authenticated draft snapshots. Runtime restart remains fail closed through the existing interrupted-task recovery instead of replaying external side effects. Completed child replies survive restart; automatic replay is not claimed. No private transcript or paid-model result is part of this evidence.

## Verification plan

Deterministic mock-provider streams must expose real deltas before completion, cancel stalled bodies promptly, cap bytes, and exclude reasoning. PostgreSQL tests must show independent Bots overlap, duplicate Bot claims stay bounded, concurrent delegation cannot exceed four descendants, steering survives reload without leaking between tasks, and terminal tasks reject new instructions. Existing explicit old-reference and later-task isolation tests must remain green. Document live-provider and Windows test limits separately.

## Boundary review and verification

The pinned ToolLoopAgent does not expose the stream error observer directly in its settings type; its documented prepareCall hook forwards prepared options to streamText. The adapter supplies a no-op observer there so raw provider error bodies cannot reach the default console logger. A deterministic error-stream test verifies that boundary. Cancelled runs also reject late draft publication before the snapshot is written.

Four isolated PostgreSQL suites passed together: 49 tests across automations, direct conversations, collaboration and channel interactions. Focused SDK/route review: 61 tests passed, including reaction middleware isolation and suppression of private provider diagnostics. The complete Server regression passed before the final two added boundary tests (392 passed/46 conditionally skipped); final root checks remain the integrator's responsibility.
