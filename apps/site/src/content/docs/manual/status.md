---
title: "Feature map and limits"
description: "Feature map and limits — OpenBot"
---

This page maps the intended workflow to the current implementation. Release binaries and OS-specific claims must be checked against the evidence for the exact release commit.

| Part | What it does | Boundary |
| --- | --- | --- |
| Sidebar and navigation | Switch channels, Bots, plugins, automations and settings | Drafts persist in the active client session |
| Bot profile | Identity, reviewed memory, skills and evolution evidence | Model text cannot assign permissions |
| Direct conversation | Persistent conversation with one Bot | Membership is fixed |
| Group channel | Explicit recipients, reply references and shared task context | At most six recipients per send |
| Collaboration | Concurrent colleagues, asynchronous delegation and result synthesis | Six root tasks, two delegation levels, four descendants |
| Task activity | Status, cancellation, retries and additional instructions | Late instructions cannot undo completed effects |
| Incremental replies | Provider text drafts and reconnect snapshots | Final messages are persisted; partial drafts are not crash-resumed |
| Message actions | Side-hover emoji, reply, copy and task details | Reactions currently represent the single Owner |
| Files | Original download, local Office/PDF/OCR, explicit transcription | Eight files, 20 MiB total; provider and parser limits apply |
| Voice | Record, preview and attach microphone audio | Transcription is separate and explicitly requested |
| Sharing | Download outputs or export the Bot itself | Reviewed package; keys and live grants excluded |
| Plugins | Tools, resources, prompts, isolated Apps and reviewed declaration updates | MCP subset; no autonomous install, OAuth or app tool access |
| Plugin catalog | Reviewed metadata and contribution process | A listing never auto-grants access |
| Automations | Scheduled tasks through the same Server boundary | Server must remain running |
| Settings | Retained model credentials and workspace preferences | OS storage/signing constraints still apply |
| Windows Desktop | Local Server or remote client, per-user installer | x64 target; native evidence belongs to its CI run |
| Website | English/Chinese manuals, search, protocol and contribution entry | Static site; no workspace secrets or hosted model account |

OpenBot does not claim unlimited agents, automatic replay after a crash, multi-human collaboration, a universal MCP host, or all-platform computer-control conformance. Native computer execution is a separate Worker/Provider deployment and approval path. The office visualization remains optional and deferred.
