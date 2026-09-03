# Local API

[English](API.md) · [简体中文](API.zh-CN.md)

OpenBot Server exposes the control-plane API. Development defaults to
`http://localhost:3001`. Except for health, session status, login, and Node enrollment exchange,
every `/api/v1` route requires an authenticated local Owner Session. Do not expose the Server,
PostgreSQL, or a Worker Host management port directly to the public internet; use private-network
HTTPS for remote access.

## Endpoint map

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Server liveness |
| `GET` | `/api/v1/auth/session` | Read the current Owner Session state |
| `POST` | `/api/v1/auth/login` | Create an Owner Session with the deployment password |
| `POST` | `/api/v1/auth/logout` | Revoke the Session and clear its cookie |
| `GET` | `/api/v1/bootstrap` | Lightweight counts and phase information |
| `GET` | `/api/v1/workspace` | Project channels, Bots, Nodes, Runs, approvals, progress, artifacts, and counts |
| `GET` | `/api/v1/workspace/events` | Subscribe to global Node, Run, and approval changes over SSE |
| `GET` | `/api/v1/channels` | List channels and Bot rosters |
| `POST` | `/api/v1/channels` | Create a channel and atomically add its initial Bots |
| `POST` | `/api/v1/channels/:channelId/bots` | Add an existing Bot to a channel |
| `GET` | `/api/v1/channels/:channelId/messages` | Read the latest 100 messages and reply relationships |
| `POST` | `/api/v1/channels/:channelId/messages` | Persist an Owner message and create a queued Run atomically |
| `GET` | `/api/v1/channels/:channelId/runs` | Read the latest 50 channel Runs |
| `GET` | `/api/v1/channels/:channelId/events` | Subscribe to channel events over SSE |
| `POST` | `/api/v1/approvals/:approvalId/decision` | Approve once or reject one pending action |
| `GET` | `/api/v1/artifacts/:artifactId/content` | Read an authenticated artifact; currently PNG only |
| `GET` | `/api/v1/runs/:runId/frame` | Read a Run's latest short-lived frame |
| `GET` | `/api/v1/bots` | List Bots |
| `POST` | `/api/v1/bots` | Create a Bot and its initial evolution event |
| `GET` | `/api/v1/bots/:botId/profile` | Read the complete Employee profile projection |
| `PATCH` | `/api/v1/bots/:botId/profile` | Update role and biography at an expected revision |
| `POST` | `/api/v1/bots/:botId/memories` | Create one bounded Owner memory |
| `PATCH` | `/api/v1/bots/:botId/memories/:memoryId` | Update one memory at an expected revision |
| `DELETE` | `/api/v1/bots/:botId/memories/:memoryId` | Delete one reviewed memory at an expected revision |
| `POST` | `/api/v1/bots/:botId/skills` | Register candidate skill metadata for Owner review |
| `POST` | `/api/v1/bots/:botId/skills/:skillId/state` | Verify, suspend, or permanently revoke a skill |
| `GET` | `/api/v1/bots/:botId/export/preview` | Preview a sanitized Employee template and all exclusions |
| `GET` | `/api/v1/bots/:botId/export` | Download a template that passed the safety checks |
| `POST` | `/api/v1/employees/import/preview` | Strictly inspect a template in quarantine without writes |
| `POST` | `/api/v1/employees/import/activate` | Revalidate reviewed input and create a zero-authority Employee |
| `GET` | `/api/v1/nodes` | List currently connected Worker Hosts |
| `GET` | `/api/v1/node-identities` | Read enrolled Node metadata without secrets or digests |
| `POST` | `/api/v1/nodes/enrollment-tokens` | Issue a short-lived, single-use token for one exact Node id |
| `POST` | `/api/v1/nodes/enroll` | Exchange a one-time token for a per-Node credential |
| `POST` | `/api/v1/nodes/:nodeId/revoke` | Revoke one Node and disconnect its active session |

## Owner Session and request security

Login body:

```json
{
  "password": "the OPENBOT_OWNER_PASSWORD value"
}
```

Loopback HTTP development uses an `openbot_session` cookie. HTTPS uses the host-only
`__Host-openbot_session` cookie. Both are `HttpOnly`, `SameSite=Strict`, and `Path=/`; the HTTPS
variant is also `Secure`. PostgreSQL stores only the random session token's SHA-256 digest, never
the token or deployment password.

Every mutating request must send an `Origin` that exactly matches `OPENBOT_ALLOWED_ORIGINS`.
Non-loopback origins require HTTPS and `OPENBOT_SECURE_COOKIES=true`; an unsafe configuration
stops the Server before it listens. Five consecutive login failures temporarily limit that
single-process browser-Origin bucket for five minutes. This is not distributed per-device
identity, so the Server still belongs on a trusted private network.

Channel and workspace SSE subscribers each have a 128-event pending bound. The Server terminates
an overloaded subscriber; the Client reconnects and reloads the authoritative database snapshot
instead of pretending a dropped stream is continuous.

## Bots and Employee profiles

Create a Bot:

```json
{
  "name": "Ops",
  "role": "Browser operations and daily workflows",
  "computerProfile": "docker-linux"
}
```

`computerProfile` is one of `none`, `docker-linux`, `macos-cua`, `lume-vm`, or `coder`. Names are
unique in the local workspace. Creation writes the Bot and an immutable `created` evolution event
in one transaction; a Bot is the Employee identity, not a second wrapper around one.

`GET /api/v1/bots/:botId/profile` returns:

- `employee`: identity, role, state, appearance, and fixed execution configuration;
- `details`: descriptive biography, Server revision, and last update time;
- `evolution`: append-only, source- and evidence-backed changes;
- `skills`: versions, dependencies, capability requirements, state, and confidence;
- `memories`: typed Owner records with sensitivity, portability, provenance, and revision;
- `memoryEvents`: content-free memory lifecycle audit rows;
- `records`: recent Runs, approvals, artifacts, and structured decision summaries;
- `statistics`: result counts across the latest 50 Runs and verified skill count;
- `configuration`: execution profile and portable package format.

Decision records come only from persisted `RUN_PROGRESS` events. They expose stages,
observations, concise action explanations, and next actions—not hidden chain-of-thought, provider
tokens, prompts, or secrets. Skill confidence and memory portability never grant Worker Host
authority.

### Update descriptive profile details

`PATCH /api/v1/bots/:botId/profile` accepts only the complete role and biography plus the revision
the Owner inspected:

```json
{
  "role": "Evidence reviewer",
  "description": "Review evidence and document limitations before reporting conclusions.",
  "expectedRevision": 1
}
```

The Server trims both strings, requires a non-blank role of at most 160 characters, and limits the
biography to 2,000 characters. A stale revision returns `409`; an unchanged update or an
authority-bearing extra field returns `422`. The successful transaction increments the revision
and appends an evolution event that stores changed field names, not biography text. Workspace SSE
then publishes only the Employee id and affected sections. Name, model policy, Worker Host,
appearance, skill state, and permission grants are deliberately outside this command.

## Owner-managed memory

The first memory lifecycle is manual and Owner-only. Models, Providers, and Worker Hosts do not
have these commands. Titles are limited to 160 characters and content to 8,000 characters.
Unknown fields fail strict parsing. Credential-like values and private-key material are rejected;
store only an opaque vault reference such as `vault://operations/email`.

Create a memory:

```json
{
  "kind": "semantic",
  "title": "Preferred report format",
  "content": "Use a short summary followed by a source table.",
  "sensitivity": "internal",
  "portability": "owner-selectable"
}
```

`kind` is `working`, `episodic`, `semantic`, `procedural`, or `secret-reference`.
`sensitivity` is `public`, `internal`, `confidential`, or `restricted`. Owner commands may set portability only to
`never` or `owner-selectable`; `included` is rejected because every `openbot.employee/v1` package
contains zero memories. A `secret-reference` must be `restricted` and `never` portable, and its
content must be a reference rather than a credential value.

Update a memory:

```json
{
  "expectedRevision": 1,
  "content": "Use a five-line summary followed by a source table."
}
```

At least one field must change. The update succeeds only if `expectedRevision` is current, then
increments it. A stale edit returns `409` without changing the record.

Delete a memory:

```json
{
  "expectedRevision": 2,
  "ownerReviewed": true
}
```

Deletion requires a distinct reviewed command and the current revision. It physically removes the
memory row. The same transaction appends a lifecycle event containing only Employee id, memory id,
action, revision, changed field names, actor, and time; it never retains title, content,
provenance, or a content hash. Retrieval, retention schedules, autonomous write proposals,
version restoration, and selective export remain unimplemented.

## Skill metadata review

`POST /api/v1/bots/:botId/skills` creates only `candidate` metadata. Slugs use the Agent
Skills-compatible lowercase letters, numbers, and hyphens subset, up to 64 characters; description
is required and limited to 1,024 characters. Dependencies must already be verified skills owned by
the same Employee.

```json
{
  "slug": "source-triangulation",
  "name": "Source triangulation",
  "description": "Compare independent primary sources before reporting a conclusion.",
  "version": "1.0.0",
  "source": "learned",
  "requiredCapabilities": ["browser.observe"],
  "dependencySkillIds": [],
  "evidence": [{ "kind": "run", "id": "run-reference" }],
  "reason": "Repeated successful Runs produced a reusable procedure."
}
```

The state command accepts `verified`, `suspended`, or `revoked`. Every transition requires a
non-empty reason and literal `ownerReviewed: true`; verification also requires confidence from 1
through 100. Revocation is terminal. Concurrent transitions return `409` instead of overwriting
the earlier review. The Employee profile now exposes the stored description, source, version,
required host-capability names, dependencies, and evidence references before showing only the
transitions valid from the current state. Permanent revocation uses a separate confirmation form.

```json
{
  "state": "verified",
  "confidence": 88,
  "reason": "The Owner reviewed the procedure and evidence.",
  "ownerReviewed": true,
  "evidence": [{ "kind": "manual", "id": "owner-review-1" }]
}
```

These endpoints manage profile metadata only. They do not install or execute `SKILL.md`, change a
Node, route work, alter approval policy, or grant tools.

## Employee export, import, and activation

Export preview lists the role, descriptive biography, verified skills, capability requests,
checksum, exclusions, and blockers. The v1 template structurally excludes source identity,
ownership, all memories, Runs, evolution,
decisions, artifacts, approvals, Node identity, host binding, credentials, sessions, and authority.
Free text is scanned for credential-like values, bearer tokens, private keys, and local paths.
A blocked export returns `422`.

Unsigned export uses `application/vnd.openbot.employee+json`. When the optional Owner publisher
keyring is configured, export uses `application/vnd.openbot.employee.dsse+json` and a DSSE/Ed25519
signature over the exact package bytes. A package key id is only a lookup hint; trust comes from an
explicit Server trust store and successful verification. See [Employee signing](EMPLOYEE_SIGNING.md).

Import preview accepts one v1 template or DSSE envelope, up to 2 MiB. It validates strict schema,
signature when present, checksum, skill dependencies and capabilities, sensitive text, and current
Worker Host compatibility. A successful preview is still read-only quarantine: it creates no Bot,
skill, memory, host binding, or authority. Its `employee` projection includes the name, role,
optional biography, and appearance that were checked in the package. Clients should show the
biography and `requestedCapabilities` before confirmation and must describe both as untrusted input,
not as granted authority.

Activation body:

```json
{
  "package": {},
  "expectedPackageId": "uuid-from-preview",
  "expectedDigest": "sha256-from-preview",
  "ownerReviewed": true,
  "allowUnsigned": false,
  "idempotencyKey": "new-request-uuid",
  "employeeName": "Optional local name"
}
```

Activation repeats every preview check and binds the reviewed package id and digest. Unsigned input
requires `allowUnsigned: true`. One PostgreSQL transaction creates a fresh Employee id, imports
skills as `candidate` with confidence `0`, appends an `imported` evolution event, and stores an
immutable receipt. It imports no memory, history, credential, session, Node binding, capability, or
authority. An exact idempotent retry returns the original receipt; changed reuse or a duplicate
package id returns `409`.

## Channels, Runs, and approvals

Create a channel:

```json
{
  "name": "Operations",
  "description": "Daily operations with durable context",
  "botIds": ["00000000-0000-4000-8000-000000000001"]
}
```

The channel and initial roster are one transaction. Any unknown Bot rejects the entire request.

Create a task:

```json
{
  "content": "Open the test page and take a screenshot.",
  "botId": "optional-channel-member-id"
}
```

Content is trimmed and limited to 1–8,000 characters. The Server atomically stores the human
message, one `queued` Run, and matching events. An explicit `botId` must belong to the channel.
Without one, routing deterministically prefers a Chief/coordinator role and otherwise uses stable
roster order. A Run freezes the selected Bot's execution profile; Client, model, and Node cannot
change it mid-run.

A compatible Node receives an offer only when exact capability-major and capacity requirements
match. Offer/accept is not enough: the Server must persist conditional assignment and confirm it,
then persist explicit start before execution. An assigned Run can return to `queued` after a
disconnect; a running Run fails because its external side effects are unknown and are not retried
automatically.

Approval decisions use `{ "decision": "approve" }` or `{ "decision": "reject" }`. Only a pending,
unexpired approval may be decided, and only once. Approval resumes a Run; rejection or expiry
blocks it. The current handshake does not yet issue a separately verifiable single-use capability
lease, so only trusted-private-network test Providers are appropriate.

## Realtime and private media

Channel SSE emits `channel.ready`, `message.created`, `run.created`, `run.updated`, `run.progress`,
`run.frame`, and a 15-second `heartbeat`. The Web Client closes a stream after 35 seconds without
frames, reconnects after two seconds, reloads recent history, and merges entities by id and
`updatedAt`.

Workspace SSE emits `workspace.ready`, `node.upserted`, `node.removed`, `run.updated`,
`approval.updated`, and `employee.profile.changed`. The Employee event contains only `botId`, a
non-empty allowlisted `sections` array, and `occurredAt`; it is a content-free invalidation hint.
A Client viewing that Employee reloads the authenticated profile aggregate instead of treating SSE
as profile state. The Client also reloads the selected profile after `workspace.ready`, so reconnect
recovers missed mutations. Workspace SSE owns cross-channel status; channel SSE owns one channel's
conversation and Run details. This is a single-Server in-process broadcast. Multi-Server deployment
first requires a reviewed shared event and queue system.

Artifact and frame endpoints use the Owner Session, return `private, no-store`, and set
`X-Content-Type-Options: nosniff`. The Web Client never receives the internal storage key. Frames
are PNG only, at most 2 MiB, held for at most 16 Runs, and expire after two minutes by default.

## Worker Host identity

Online Node projections include platform, OS version, architecture, device class, isolation,
trust tier, and a versioned capability manifest. Protocol `0.9.0` requires exact capability-major
matching on Server and Node. Unknown message fields, duplicate capabilities, invalid or oversized
identity metadata, and unbounded approval context fail closed.

One-time enrollment tokens expire after ten minutes by default and bind one exact Node id. A
successful exchange stores only a digest on the Server and returns an individually revocable
per-Node credential once. The current credential is still a copyable bearer secret—not mTLS or
proof-of-possession identity—so non-loopback Node connections require `wss:` and a trusted private
network. See [Node enrollment](NODE_ENROLLMENT.md).

## Error contract

| Status | Meaning |
| --- | --- |
| `401` | Missing, expired, or invalid Owner Session |
| `403` | A mutating request has no trusted exact-match Origin |
| `404` | The requested channel, Bot, Employee record, or Node identity does not exist |
| `409` | Name conflict, stale revision, already-decided approval, or changed/reused reviewed input |
| `413` | A request exceeds its transport-level size bound |
| `422` | Strict input, policy, package, compatibility, or sensitive-content validation failed |
| `429` | Login attempts are temporarily limited; follow `Retry-After` |

Error bodies include an `error` string. Schema failures may also include a bounded `fields` map.
Clients must not retry `409` or `422` blindly: reload the authoritative state, show the change to
the Owner, and ask for a new decision.
