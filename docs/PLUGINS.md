# Third-party MCP tool plugins

[English](PLUGINS.md) · [简体中文](PLUGINS.zh-CN.md)

OpenBot connects Bots to external tools through MCP. Plugins can query services, transform data,
or perform approved operations in their own backends. SKILL.md supplies instructions; MCP supplies
callable tools. Installing a plugin registers a Server connection, without downloading code into
Desktop or launching a subprocess.

## Owner workflow

1. Open the plugin manager, enter a name, MCP endpoint and optional dedicated bearer token.
   Preview retrieves declarations without calling tools.
2. Inspect the endpoint, descriptions, input schemas and annotations, then confirm installation.
   New plugins are disabled and have no Bot grants.
3. Choose a Bot and select tools. **confirm** requires approval every time, and should be used for
   writes, messages, other external mutations and tools whose behavior you have not established.
   **read** is an explicit standing Owner grant to send parameters and call a trusted observational
   tool without another prompt. A plugin's `readOnlyHint` never grants either mode automatically.
4. Save grants and enable the plugin. Ask the authorized Bot to use it in a channel. The Agent sees
   only its permitted catalog and calls through the Server.
5. Confirm-mode requests appear in that channel with plugin, tool, Bot, exact arguments and expiry.
   Approve or reject within 60 seconds. Approval admits one call; rejection, expiry or task
   cancellation prevents execution.
6. Disable/remove/change grants to block further access and abort pending/in-flight requests.
   Already transmitted operations may have taken effect. Uncertain calls are never retried.

The Run determines Bot/channel identity; model parameters cannot choose another identity. Changed
tool declarations invalidate old calls. To change an endpoint, token or catalog, remove and
preview/install the connection again; old grants are not retained. Removal disconnects OpenBot;
it does not erase third-party data.

An external service receives tool arguments, not an automatic workspace dump or other providers'
credentials. The selected model receives tool results. Results cannot grant authority. An external
server can misdescribe its behavior: OpenBot's grant checks do not sandbox that remote server.
Use a trusted backend and narrowly privileged service account.

## Run the example

After `npm ci`, run this separate local MCP server from the source checkout:

```sh
npx tsx apps/server/src/plugin-example.ts
```

Explicitly configure the development endpoint on the **OpenBot Server computer**, then restart:

```dotenv
OPENBOT_PLUGIN_LOCAL_ENDPOINTS=http://127.0.0.1:4318/mcp
```

For an application-hosted Server, set the variable in the application's launch environment before
opening it. Localhost means the Server computer, not a remote client. Only exact operator-listed
literal `127.0.0.1`/`::1` endpoints are admitted; other endpoints require public HTTPS, and all DNS
results must be public. URL credentials, queries, fragments and redirects are rejected.

Install that endpoint through the Owner workflow. Grant `sum_numbers` as read and `append_note`
as confirm to one Bot, and enable it. Enable the native Agent with a tool-capable model, then ask
“Use sum_numbers to add 13 and 29.” Next ask “Use append_note to save ‘Checked result: 42’.” The
second operation appends one note only after approval. Other ungranted Bots cannot call these tools.
Notes are real state in the example process's memory, cleared on restart; no external account or
local document is used. Source: [plugin-example.ts](../apps/server/src/plugin-example.ts).

## Author contract

Implement a normal **MCP 2025-11-25-compatible Streamable HTTP** server, in any language. OpenBot
pins official `@modelcontextprotocol/sdk` **1.30.0**, commit
`2d889f2b329e46680ec9bdd565de4616c497825a`. No OpenBot-specific plugin SDK is required.
See the [research](research/third-party-mcp-plugins.md).

| Area | Current contract |
| --- | --- |
| Transport | One exact endpoint; fresh SDK client per preview/call, no redirects, cookies, proxy, reconnection or replay. Return completed JSON or bounded POST SSE responses; permanent GET push streams are disabled. |
| Authentication | Optional dedicated bearer token encrypted on the Server. OAuth and dynamic credential discovery are not implemented. |
| Discovery | One complete page of 1–32 unique tools, catalog ≤64 KiB, no pagination. |
| Names/description | Names: 1–64 ASCII letters, digits, dot, underscore or hyphen. Descriptions ≤2,000 characters; Agent sees bounded excerpts. |
| Input schema | Object-root JSON Schema ≤12 KiB and bounded depth. Simple objects, arrays, scalars, bounds, required and enums work. References, `$id`, regex patterns, formats and header-mirroring extensions are rejected. |
| Arguments/results | Arguments ≤8 KiB and validated. Results: text blocks plus optional structured JSON ≤12 KiB; no images/audio/resources/renderer code. `isError` fails the call. |
| Time | HTTP ≤30 seconds; approval ≤60 seconds; invocation ≤120 seconds and within the parent Run deadline. |
| Capacity | 16 installations; 32 tools and 128 Bot grant entries per plugin; 16 concurrent calls. Agent catalog ≤16 tools and 12 KiB, with truncation flagged. |
| Authority | `call_plugin` shares the native Agent tool budget; no additional execution, recursion or background authority. |

This tools slice does not expose sampling, elicitation, roots, stdio, task extensions,
resources/prompts, plugin HTML/JavaScript or package/marketplace installation. Separate read and
write tools, validate arguments and authorization in your backend, and describe actual effects.
Annotations assist human review but do not prove behavior. Put dedicated service authentication
in connection configuration rather than asking the model for account passwords.

## Owner API

Paths are under `/api/v1`; existing Owner sessions and trusted mutation Origins are required.
Tokens are input-only and never returned in plugin lists or audit records.

| Request | Body / response |
| --- | --- |
| `GET /plugins` | `{ plugins, pendingCalls }` |
| `POST /plugins/preview` | `{ name, endpoint, token? }` → manifest `{ name, endpoint, tools, digest }` |
| `POST /plugins` | `{ name, endpoint, token?, reviewedDigest }` → `201 { plugin }` |
| `PATCH /plugins/:id` | `{ revision, enabled }` → `{ plugin }` |
| `PUT /plugins/:id/grants/:botId` | `{ revision, tools: [{ name, mode: "read" | "confirm" }] }` → `{ plugin }`; empty tools revokes |
| `DELETE /plugins/:id` | `{ revision }` → `{ deleted: true }` |
| `POST /plugin-calls/:id/decision` | `{ decision: "approve" | "reject" }` → `{ decided: true }` |

Stale config/grant revisions return `409`. Approval IDs exist only while the original Run waits;
restart cannot replay approvals. A successful decision is not proof of external completion—inspect
the Run result.

## Storage and verification

Encrypted configuration and the latest 500 content-free audit transitions are stored in
`<OPENBOT_OBJECT_STORE_PATH>/plugins/state.json`, with a separate `state.json.key`. Back up both.
Missing/wrong keys with existing data fail closed. Atomic writes and compare-and-write operations
are serialized for one Server, not multiple processes. Audit excludes parameters/results/tokens;
pending arguments live in memory while the Owner is reviewing them.

`plugin-service.test.ts` runs a real local HTTP MCP service with the official SDK: discovery,
exact review, install, Bot grant, calculation, approval-before-write, one-time consumption and
disable. Negative tests cover wrong Bot, stale revisions/catalogs, bad arguments, timeout, cancel,
revocation, encrypted persistence and neighboring route body limits. This is local protocol
integration evidence, not validation of every third-party service or model account.
