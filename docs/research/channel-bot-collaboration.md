# Research: Channel Bot collaboration

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: @yxflc11
- Acceptance journey: a channel Bot discovers fellow members, delegates work under its own identity, receives the recipient's independently executed answer and produces a synthesis; the channel records both identities and task relationships.
- Security boundary: only Server selects caller identity, channel, parent and root. Recipient membership and native execution eligibility are checked transactionally. A model cannot impersonate a human, switch channels, acquire another Bot's private memory or create Worker work.

## Search evidence

Searches: `site.ai-sdk.dev agents subagents tool execute`, `site.github.com a2aproject A2A releases agent card task`, `site.github.com/vercel/ai subagent abort`. Read [AI SDK subagents](https://ai-sdk.dev/docs/agents/subagents), [A2A v0.3.0 source](https://github.com/a2aproject/A2A/tree/v0.3.0) and its [releases](https://github.com/a2aproject/A2A/releases). Reused the existing [native Agent review](native-agent-loop.md) and [web integration review](desktop-public-web-tools.md), including their pinned release, tests and issue investigation. The GitHub web cache could not fetch the AI SDK tagged directory or current issue search; inspected installed `ai/src/agent/tool-loop-agent.ts` and `ai/src/generate-text/execute-tool-call.ts` directly, including AbortSignal forwarding, rather than assuming newer APIs. The earlier review records stream-tool enforcement issues; this change retains non-streaming calls and explicit failure propagation.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| A2A | v0.3.0 / 8d57eba | Apache-2.0 | Released specification, SDK links and public issue tracker | Useful for separate remote agent services, but does not own OpenBot's same-Server channel membership or transaction | Defer remote federation; do not claim A2A conformance |
| AI SDK | ai 7.0.93 / 6359fd58fe68eaade096b5d923bac26de84ca3bd | Apache-2.0 | Existing released dependency, inspected installed agent/tool source, tested by current native suite | Documented tool-invoked subagent with its own instructions/context and cancellation | Selected released dependency plus thin authority adapter |
| Additional agent framework | OpenAI Agents JS v0.17.0, reviewed in native-agent-loop.md | MIT | Existing research covers runner/tests/handoffs | Would duplicate the current provider and runtime stack | Not required for the remaining persistence gap |

## Reuse decision

Reuse the installed ToolLoopAgent recursively through a scoped tool. Implement only OpenBot-specific transactional delegation creation, discovery, task provenance and lifecycle. Do not implement a second model loop. Keep one active root per channel and at most two root trees globally. Child Runs start directly under the existing root lease instead of entering the ordinary same-channel queue, which would deadlock a waiting parent. Within each parent's calls serialize child work; bound depth to two and total descendants to four per root. Reject cycles using Server-loaded ancestry. Bound the complete tree to 300 seconds and propagate cancellation/settings revocation. Each Bot still loads only its own reviewed skills and memories; child results are untrusted context. Child failures return a visible status for the parent to explain, while a cancelled parent cannot publish completion. No automatic resumption of partially completed trees after restart.

Persist parentRunId/rootRunId/delegatedByBotId on Runs. A child sourceMessageId points to the Bot-authored delegation message, and its final reply is authored by the child Bot. No message-body parsing is needed for UI provenance. The child tool receives only a selected member id and bounded assignment text; caller/channel/tree identifiers are never model arguments. Inherited attachment references must be a subset of the parent's explicit attachment references.

## Source incorporation

- Source copied or substantially adapted: no.
- Existing Apache-2.0 notices continue to ship with AI SDK.
- No new dependency or remote protocol introduced by collaboration.
- Replacement: retain the Server store contract when updating the SDK; revisit A2A only for a separately scoped remote-agent feature.

## Verification plan

- Deterministic SDK tests: discover, delegate, recipient-specific profile/tool context, child result observed by parent, correct message/run events.
- PostgreSQL integration: membership, caller spoofing, root/parent provenance, depth/cycle/tree bounds, concurrent delegation, cancellation and completion races.
- Native renderer: structured delegation, recipient reply and state transitions; preserve share and attachments. The public xAI Grok Bot reference was subsequently identified and inspected; see [presentation evidence](channel-collaboration-presentation.md). No authenticated-app pixel-fidelity claim is made.
- Full `npm run check`, isolated database validation, then build/install the local macOS upgrade without changing the user's data.

## Unresolved questions

- The public reference is x.ai/bot; authenticated state-by-state comparison and asynchronous execution parity remain outside current evidence.
