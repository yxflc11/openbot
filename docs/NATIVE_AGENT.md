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

For a source-backed report, include up to three explicit HTTPS URLs in the task and ask for a
Markdown report. For example: “Read https://example.com and prepare a report.md with citations.”
The resulting file appears in the channel and Run inspector after successful completion. Pages are
untrusted source material; downloads contain model-written text, not executable HTML.

Desktop uses a native **Save report** dialog for Markdown files; choose a new `.md` filename.
Existing files are not overwritten. General browser downloads remain disabled in the native shell.

## Tools and limits

| Boundary | Behavior |
| --- | --- |
| `read_channel_context` | At most 12 messages, bounded text, only the current task's channel and no messages created after the task |
| `read_task_status` | At most 8 task titles/statuses in that channel, no tasks created after this task |
| `read_public_page` | Read one of at most 3 explicit task URLs by index; 15 seconds, 512 KiB input, 6,000 UTF-8 bytes of extracted text |
| `write_report` | Prepare at most 2 Markdown files; 24 KiB authored text and 32 KiB including Server source provenance |
| Authority | Strict schemas; Server binds channel/Bot and URL list from the claimed Run and rechecks membership and Run state. No model-selected URL or filesystem path |
| Iteration | At most 5 model steps, 8 executed tools and 1,024 output tokens per step |
| Time/output | 90-second inference deadline, 30-second HTTP deadline, 512 KiB provider reply, 16 KiB instruction/tool projection, 8,000-character final reply |
| Concurrency | At most 2 active native Runs per Server, one per channel; conditional database claims prevent duplicate execution |
| Network | Fixed official provider endpoints plus task-authorized public HTTPS GETs. Source DNS answers must all be public; the connection pins the checked address and verifies the original TLS host. No redirects, proxies or automatic retries; OpenAI response storage is disabled |
| Lifecycle | Reply, report metadata, completion and audit commit together. Prepared report files are removed when publication fails. Interrupted running tasks fail on restart; ambiguous/failed tasks are not automatically retried |

Progress contains action/result summaries, never internal reasoning, API keys or raw provider error
bodies. Provider token usage is not yet persisted or aggregated into the usage panel. These limits
bound the native loop; database availability remains required for state changes and shutdown.

The tools do not expose memory, executable skills, shell, local files/PDFs, arbitrary URLs, computer input, external
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
and Server progress without a fabricated Node. Source tests cover private/reserved addresses, mixed DNS,
numeric connection pinning, TLS host preservation, redirects, compression, size and cancellation.
Report tests cover transactional publication, rollback, source provenance and authenticated downloads.

These fixtures make no paid requests and do not certify live model availability, output quality or
real-device desktop control. See the [research record](research/native-agent-loop.md) and
[source/report research](research/agent-research-artifacts.md) and [execution plan](EXECUTION_PLAN.md).
