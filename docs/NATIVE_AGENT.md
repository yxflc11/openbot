# Native Agent

[English](NATIVE_AGENT.md) · [简体中文](NATIVE_AGENT.zh-CN.md)

OpenBot can execute a bounded model/tool/observation loop in the Server. The released Vercel AI SDK
runs iteration; PostgreSQL remains the authority for tasks, channel membership, replies and audit.

## Use it

1. In **Settings → Models & API**, choose OpenAI or Anthropic, enter a model that supports tool
   calling and its API key, check **Enable native Agent**, then verify and save. The shared UI
   currently labels this option **启用原生 Agent**. Metadata validation alone does not prove that
   a model supports the generation endpoint or tools.
2. Create a Bot with computer profile **none**, add it to a channel, select it and send a new task.
   For example: “Read this channel and summarize the outstanding tasks.”
3. The task changes from queued to running. The inspector records model steps and tool observations;
   a successful task produces a Bot reply and completed Run. A failure is visible on the Run.

Inference is off by default, including for existing encrypted model configurations. Enabling it
allows new `none`-profile tasks, including scheduled tasks, to send the task and requested channel
context to the chosen provider; API charges may apply. Tasks created before the most recent enable
are not replayed. Re-enter the key when changing settings. Disabling or replacing settings aborts
active inference. Server must remain running; remote Desktop clients use their connected Server.

## Tools and limits

| Boundary | Behavior |
| --- | --- |
| `read_channel_context` | At most 12 messages, bounded text, only the current task's channel and no messages created after the task |
| `read_task_status` | At most 8 task titles/statuses in that channel, no tasks created after this task |
| Authority | Both tools take an empty strict object. Server binds channel/Bot from the claimed Run and rechecks membership and Run state |
| Iteration | At most 5 model steps, 8 executed read tools and 1,024 output tokens per step |
| Time/output | 90-second inference deadline, 30-second HTTP deadline, 512 KiB provider reply, 16 KiB instruction/tool projection, 8,000-character final reply |
| Concurrency | At most 2 active native Runs per Server, one per channel; conditional database claims prevent duplicate execution |
| Network | Fixed official OpenAI Responses or Anthropic Messages endpoint, no redirects, proxy URL or automatic retries; OpenAI response storage is disabled |
| Lifecycle | Reply, completion and audit commit together. Interrupted running tasks fail on restart; ambiguous/failed tasks are not automatically retried |

Progress contains action/result summaries, never internal reasoning, API keys or raw provider error
bodies. Provider token usage is not yet persisted or aggregated into the usage panel. These limits
bound the native loop; database availability remains required for state changes and shutdown.

The tools do not expose memory, executable skills, shell, arbitrary URLs, computer input, external
messages or approval decisions. Existing Worker-profile tasks keep their existing dispatcher and
approval path. A native task requiring an unavailable action should explain that limitation.
Hermes/Pi/OpenClaw delegation, browser observe/act tools and arbitrary desktop control remain future
adapters, with their own authority and conformance gates.

## Evidence

Tests exercise the real SDK and both provider adapters with deterministic HTTP fixtures, including
a tool result received by the next model step. Tests cover scope/argument rejection, limits,
settings opt-in, cancellation and persistence. The disposable PostgreSQL integration suite covers
competing claims, no historical replay, Worker exclusion, channel isolation, membership revocation,
transaction rollback, exactly one reply and restart interruption. UI tests cover explicit opt-in
and Server progress without a fabricated Node.

These fixtures make no paid requests and do not certify live model availability, output quality or
real-device desktop control. See the [research record](research/native-agent-loop.md) and
[execution plan](EXECUTION_PLAN.md).
