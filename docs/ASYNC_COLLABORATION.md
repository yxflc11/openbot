# Asynchronous channel collaboration

The Server can execute up to six independent root tasks concurrently. Different Bots in one channel can work at the same time. Root tasks addressed to the same Bot in the same channel stay serialized. PostgreSQL enforces claims and global root capacity across concurrent pollers; the in-process scheduler is not the only guard.

## Bot coordination

`list_channel_bots` supplies current Server-owned identities and roles. `start_task` creates a same-channel child assignment and returns its Run ID immediately. The initiating Bot can continue independent work while its colleague uses its own profile, skills, memories and plugin grants. `wait_for_task` waits for an assignment created by the current Run and returns its result. The compatible `delegate_task` starts and waits in one call. Concurrent tool calls can start siblings in parallel.

The assignment is an audited channel message authored by the initiating Bot. The result is a separate channel reply authored by the recipient. No model-supplied author, channel or root ID is trusted. A task cannot delegate to itself or its ancestors, outside its channel, or to a computer-backed Bot. A tree permits at most two delegation levels and four descendants. Root authority, task deadline and cancellation apply to the entire tree; plugin and memory authority is never inherited from the caller.

If the initiating Bot produces a final draft before it has read its colleagues' results, the Server waits for those tasks and sends their committed outcomes into another model step before allowing a final reply. That continuation uses the same cumulative step, tool, usage and deadline budget. A failed colleague can be reported honestly; failed creation/audit cannot be represented as successful dispatch.

## Additional Owner instructions

`POST /api/v1/runs/:runId/steer` accepts `{ "instruction": "…" }` through the authenticated Owner boundary. A native queued/running task accepts at most eight nonblank instructions in total, each at most 4,000 characters. Applying an instruction does not reset this lifetime limit. The Server persists their exact task association before acknowledgement. They enter the next model step as ordered task guidance and do not change tools, attachment access, channel membership or completed side effects.

An ordinary channel message remains a separate task. It never silently steers another task. Corrections do not propagate to sibling or delegated Runs. Select the intended active Run when changing that colleague's assignment.

The final completion transaction locks the same Run row used for instruction submission. If a new accepted instruction has not been included, the draft is discarded and the Agent continues under the original total budget. If completion won the lock first, the endpoint rejects a late instruction instead of pretending it was applied. Cancellation and terminal tasks reject new corrections.

## Incremental output

The installed AI SDK consumes real provider SSE. Only public text deltas appear as `run.output`; reasoning, tool argument streams and raw provider errors are excluded. Events carry exact Server Run/Bot/channel IDs, a monotonic sequence, a bounded cumulative text draft and a step-reset flag. A new model step replaces the prior draft. Only the committed `message.created` is a final answer.

An authenticated `GET /api/v1/runs/:runId/output` returns the current runtime snapshot for reconnecting clients. Drafts are transient and cleared on task termination; completed answers are restored from ordinary persisted messages. A Server restart does not claim to recover partial tokens. The stream is capped at 512 KiB per provider response, 8,000 visible characters per step and a 30-second HTTP deadline. Stalled SDK promises and upstream readers are explicitly abortable. MiniMax retains the nonstreaming response path because some compatible models mix reasoning tags into content.

## Runtime boundaries

Each Run has at most eight model steps and sixteen executed tools, including four public web calls. Existing input/output token thresholds, 300-second root-tree deadline, report limits, cancellation checks and Owner opt-in remain. The total includes continuation after late corrections and automatic joins; it is not reset by a new SDK call.

On Server restart, interrupted tasks are marked failed by existing recovery. Committed colleague replies and audit remain visible. The Server does not replay ambiguous external effects or automatically restart failed tasks; an Owner can submit a new task. This is bounded asynchronous collaboration within an active runtime, not unlimited background agents or crash-resumable external workflows.

## Evidence

Deterministic tests use the installed AI SDK and a separate temporary PostgreSQL instance. They cover concurrent identities, same-Bot serialization, nonblocking child receipts with independent parent work, result synthesis, cancellation/ancestry, exact-task durable instructions, final-commit races, instruction caps, old explicit context, incremental SSE and stalled-reader cancellation. Mock-provider coverage proves the Server integration, not paid-provider availability or Windows execution. See [research](research/async-collaboration.md) and [native Agent limits](NATIVE_AGENT.md).

## Channel reactions and membership

A message can hold the Owner's own selections from six emoji. Reactions are persisted and synchronized through channel events; the UI does not invent other participants, counts or Bot sentiment. Set/unset requests are idempotent and reject a message outside the addressed channel. The reconnect snapshot covers the same latest 100 messages as the transcript.

Group-channel member removal retains historical messages and the Bot profile, cancels that member's active assignments and descendants, expires pending approvals, and removes membership in one transaction. The post-commit callback stops active native/Worker requests. Re-adding the Bot is explicit and does not resume cancelled work. Direct conversations keep fixed membership. Removal refuses a channel with over 1,000 active tasks until the backlog is reduced, rather than performing an unbounded mutation.

Message actions follow the user's updated reference: smile, reply and overflow icons sit beside the bubble and appear on hover/focus. Copy and task details are in overflow; the emoji selector is in its own keyboard-accessible portal. Selected reactions alone remain below the bubble. This layout is subject to rendered viewport acceptance, not an unmeasured whole-app pixel identity claim.
