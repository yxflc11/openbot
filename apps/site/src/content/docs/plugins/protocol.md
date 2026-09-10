---
title: "Plugin protocol"
description: "Plugin protocol — OpenBot"
---

A plugin is an independently operated MCP service. It can expose tools, resources, prompts and interactive views. A skill is an instruction document; it is one kind of capability, not the entire plugin system.

Use MCP 2025-11-25-compatible **Streamable HTTP** in any language. OpenBot uses the official SDK through a narrow Server adapter. No OpenBot-specific runtime SDK is required. The Server owns identity, permission checks, approvals and audit.

| Capability | Current host behavior |
| --- | --- |
| Tools | Bot-specific read or per-call confirmation grants; bounded schema, arguments and results |
| Resources | Explicit URI grants, Owner previews and native Bot text reads |
| Prompts | Owner selects and fills arguments, previews text and inserts it into a draft |
| MCP Apps | Isolated HTML, standard initialization and granted resource reads; no implicit tool, network, device or parent-document access |
| Skills | Reviewed `SKILL.md` instructions assigned to a Bot |

Preview the endpoint and declarations, then install, assign grants and enable. New installations have no authority. A catalog change is manually previewed and applied; applying disables the connection and clears grants. Updating the connection's declarations does not download or update the third-party service itself.

There are deliberate limits: no stdio subprocess execution, OAuth flow, sampling, roots, resource subscriptions, URI templates or autonomous prompt insertion. App tool calls, host messages and model-context access are not advertised. Remote services remain responsible for their own effects and security.

The [canonical protocol contract](https://github.com/yxflc11/openbot/blob/main/docs/PLUGINS.md) specifies endpoints, limits, schemas, errors, trust boundaries and exact versions. Read it before implementing a public connector.
