# Desktop alpha.4 core upgrade

[English](CORE_UPGRADE.md) · [简体中文](CORE_UPGRADE.zh-CN.md)

This local upgrade prioritizes useful Bot collaboration, task attachments and a public extension boundary. Sharing still exports the Bot itself or downloads produced artifacts; it does not turn a conversation into a task-method template.

## Channel collaboration

Add native (`none` computer profile) Bots with distinct roles to one channel. Select a coordinator and ask, for example: “Ask the researcher to find the facts, ask the reviewer to check them, then give me a conclusion.” The coordinator can discover eligible channel colleagues through `list_channel_bots` and invoke `delegate_task` with a recipient and assignment.

Server creates a Bot-authored delegation message and a separate child Run. The recipient uses its own profile, reviewed skills, enabled memories and plugin grants. Its reply is authored by that Bot and returned as a tool result to the caller. The caller can then summarize or assign another bounded follow-up. Progress and replies remain in the same channel, with inspectable parent/child relationships. Mention text cannot spoof a Bot's identity.

One root task tree runs per channel and up to two trees per Server. A tree has at most four descendants and two delegation levels, prohibits ancestry cycles and has a 300-second overall deadline. Each Run retains the existing model-step/tool/token limits. Sibling calls are serialized; this is a bounded synchronous handoff, not an unrestricted background conversation among all Bots. Bot membership is necessary but does not cause every Bot to reply to every message. Worker-profile Bots cannot be delegated native work. Stopping a parent cancels its active descendants; completed child work remains recorded. Restart does not replay interrupted work.

The channel presentation is being aligned with the public [Grok Bot product](https://x.ai/bot) and [collaboration guide](https://docs.x.ai/grok-bot/chat-and-collaboration). Public reference observations and actual limitations are recorded separately; this upgrade does not claim full Grok Bot behavior or access to its implementation.

## Attachments

Use the attachment button to select multiple files. Uploaded content is kept as a separate channel-scoped object; the message holds a short reference, so file content no longer consumes the 8,000-character message budget. A task may carry up to eight files and 20 MiB in total.

| File type | Per-file limit | How the Bot uses it |
| --- | --- | --- |
| UTF-8 text, Markdown, CSV/TSV, JSON/JSONL, YAML, code/config/log formats | 256 KiB | `read_attachment` pages the content with explicit offsets and unread-part indicators |
| PNG/JPEG | 5 MiB | Bytes are passed as an image part to an enabled OpenAI/Anthropic adapter; the configured model must support images |
| PDF | 10 MiB | Bytes are passed as a file part to an enabled OpenAI/Anthropic adapter; the configured model must support PDF input |

Other formats and incompatible providers are rejected with an explanation. Office document extraction, audio/video transcription, OCR, password-protected PDF handling and arbitrary image decoders are not part of this upgrade. Text is not automatically read in full; the eight-tool budget still applies, so the Bot must identify unread material. A delegated task may reference only attachment IDs already supplied to its parent.

Objects have immutable random IDs, channel binding and SHA-256 verification. The local store is capped at 256 MiB/1,024 objects; this first storage adapter assumes one authoritative Server process. There is no attachment retention/deletion manager yet. Failed uploads remain visible in the composer; successful uploads can be included independently. Existing inline text drafts remain compatible.

## Extensible plugins

The Plugins page now includes MCP service connections alongside reviewed skills. A plugin author hosts a standards-based Streamable HTTP MCP endpoint. The Owner previews its tool names, descriptions and JSON input schemas, reviews the exact digest, installs it disabled, then enables it and grants selected tools to selected Bots.

Tools default to no access. The Owner can choose per-call confirmation or explicitly classify a tool as read-only for standing use. A plugin's own `readOnlyHint` is descriptive and grants nothing. Confirm-mode calls show the exact Bot, tool and arguments in the channel and expire after 60 seconds. The Server checks the current grant and reviewed tool digest before dispatch, keeps a bounded audit and never automatically retries an uncertain external operation. Each receiving Bot needs its own plugin grants.

The first interface supports MCP tools with bounded text/structured results. It does not execute plugin JavaScript in the renderer, start arbitrary local binaries, install npm packages, or claim support for MCP resources/prompts/apps, marketplace distribution or automatic upgrades. Public HTTPS endpoints are supported; exact loopback endpoints require the operator's `OPENBOT_PLUGIN_LOCAL_ENDPOINTS` allowlist. This setting is forwarded when explicitly present in the Desktop launch environment. Tokens and plugin state are encrypted locally; back up both `objects/plugins/state.json` and its `.key` together with the database and object store.

The [plugin author manual](PLUGINS.md) and a runnable example are supplied with the plugin implementation. Third-party tools remain external components until separately reviewed for core inclusion: protocol compatibility, tests, security boundaries, license, maintenance and platform evidence all matter. Installing a plugin locally does not publish or approve it as an official OpenBot feature.

## Website and manual direction

The future public site can organize the maintained documentation into: product introduction and download; first Bot and model setup; channels and collaboration; attachments and deliverables; skills and memory; plugin author guide; deployment and administration; contribution/review criteria; versioned limits and troubleshooting. This upgrade supplies working features and source documentation. It does not deploy a website or open a public plugin registry.

## Verification scope

Validation uses deterministic models and an isolated PostgreSQL instance, real MCP SDK fixtures, source checks, renderer tests and the locally packaged macOS app. These distinguish actual transaction/network/UI behavior from paid live-model or third-party service certification. The final handoff records the completed checks and any remaining limitations.
