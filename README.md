# OpenBot

**A self-hosted control plane for always-on digital workers.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Node.js 22.22.2+](https://img.shields.io/badge/Node.js-22.22.2%2B-339933.svg)](package.json)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-f59e0b.svg)](#project-status)

OpenBot is an early-stage, open-source, self-hosted platform for running named AI employees on
computers you control. You talk to employees in persistent local channels; the OpenBot Server
routes each task to an authorized, replaceable Worker Host and keeps identity, skills, memory,
messages, approvals, artifacts, and audit events under your ownership.

A Mac mini is the first practical Worker Host, not the product boundary. Windows, macOS, and Linux
computers can become employee work machines through the same Server-authorized Node protocol. The
Server can run on Linux, macOS, a NAS, or a cloud VM, and you can reach it from any browser over a
private network.

OpenBot is inspired by the always-on, channel-based experience of products such as Grok Bot while
remaining self-hosted, provider-neutral, and designed for explicit human control.

> [!WARNING]
> OpenBot is pre-alpha software. Automated browser tasks remain read-only; the Owner can
> explicitly take control and interact with the employee browser. Do not connect payment methods, primary accounts,
> or production credentials. Read [Security](#security) before exposing a deployment.

## Why OpenBot

- **Local channels, not disposable chat windows.** Bots, conversations, runs, and results persist
  in your own PostgreSQL database.
- **Replaceable, cross-platform computers.** An employee is a persistent identity and policy; a
  Worker Host is a Windows, macOS, Linux, VM, container, or managed device that can be replaced.
- **Employees that grow and travel.** Each employee has an evidence-backed evolution history,
  skill graph, decision trace, memory, work record, configuration, and safe portability controls.
- **Approval before side effects.** Sensitive actions enter an explicit, auditable approval state.
  Models cannot grant themselves additional privileges.
- **One control plane on every device.** Desktop and mobile browsers share the same channel state
  through authenticated realtime updates.
- **Composable Bot identities.** Bot appearance is stored as five independent layers: head, body,
  mobility, accessory, and accent color.
- **Adapters over lock-in.** Models, computer runtimes, and upstream projects connect through typed,
  versioned boundaries.

The Employee evolution and learning direction is explicitly inspired by
[Hermes Agent's learning graph](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py).
OpenBot keeps its own Server-owned evidence, review, permission, and portability model; it does not
present the learning-graph concept as an OpenBot invention.

## Project status

OpenBot currently provides a tested vertical slice from a local channel to a remote execution Node
and back. The table deliberately separates working code from planned capabilities.

| Area | Available now | Next step |
| --- | --- | --- |
| Control plane | Local Owner authentication, drift-checked PostgreSQL migrations, Bots, channels, membership, messages, runs, approvals, artifacts, Employee memory lifecycle, content-free multi-device profile invalidation, and audit events | Durable routines, memory retrieval/retention, automated recovery tooling, and multi-user trust |
| Channel UI | Responsive channel-first Web UI, named Bot targeting, Bot-authored results, replies, rich text/tables, run inspector, approvals, Node management, bounded SSE with snapshot recovery, accessible employee tabs, and native modal focus handling | Installable PWA, notification delivery, real screen-reader/zoom evidence, and localization polish |
| Bot identity | Five-layer composable appearance persisted with each Bot and reused across channels and the employee profile | More parts and community-created appearance packs |
| Employee profile | Seven-view profile, revision-checked Owner editing for role and biography, Hermes-inspired dated evolution archive with filters and full evidence references, inspectable Owner skill review, Owner-managed typed memory with content-free audit, biography-preserving safe template export with exact reviewed-download binding, quarantined import, reviewed fresh-identity activation, and experimental DSSE signing | Display-name/host/appearance policy editors, memory retrieval/retention and autonomous proposals, native keyring/KMS and public trust adapters, executable Agent Skills bundles with full-diff review, selective cloning, registry distribution, and ownership transfer |
| Node protocol | Outbound WebSocket registration, Owner UI for one-time pairing/list/revoke, individually revocable credentials, heartbeat, capacity, exact capability-major routing, two-phase assignment, explicit start, progress, frames, completion, and disconnect recovery | Proof-of-possession identity, mTLS, rotation, replay protection, native keyring adapters, and real-device conformance reports |
| Browser execution | Explicit-URL screenshot Runs plus a built-in employee browser panel with persistent profiles, refreshed PNGs, navigation and human input | Autonomous observe/fill/act loop, video-rate frames, downloads and tab management |
| Human control | Persisted Run approval decisions plus exclusive, expiring Owner browser control with content-free audit | Single-use signed automated capability leases and broader desktop takeover |
| Providers | Functional Docker/browser adapter with read-only Runs and human control; typed Cua, Lume, and coder package boundaries | Portable browser plus Windows, macOS, Linux desktop, managed Android, and isolated coding providers |
| Model chat | Owner-managed model connections with 11 provider presets, authorized custom endpoints, per-Employee model selection, encrypted API keys, bounded text replies, persisted Runs, and realtime updates; no Worker Host required | Token streaming and separately authorized tools |
| Office view | Isolated `@openbot/office-plugin` package with no core-app dependency | Optional plugin lifecycle after the channel workflow is mature |

### What the current release does not claim

- It does not perform unattended form submissions or arbitrary desktop actions.
- It does not yet issue cryptographic, single-use capability leases after approval.
- It does not provide continuous remote desktop control.
- Node enrollment is individually revocable, but the current credential is still a bearer secret
  stored in an Owner-only file. It is not yet proof-of-possession identity, mTLS, or native-keyring
  storage and must stay behind WSS and a trusted private network.
- It does not let models write or retrieve long-term memory autonomously, enforce retention
  schedules, selectively clone employee experience, distribute packages through a registry, or
  transfer ownership. The authenticated Owner can manually add, edit, and delete bounded memory;
  memory remains excluded from every v1 Employee package.
- The Owner can edit an Employee role and descriptive biography. Those fields are routing context,
  not model policy, skills, host binding, or authority; concurrent edits fail on a stale revision.
- Employee export remains unsigned by default. An operator can enable experimental DSSE signing
  with an encrypted filesystem keyring, offline rotation/revocation, and explicit public-key trust;
  export download is bound to the exact reviewed package bytes, and import activation still
  requires an exact preview digest, explicit Owner review, a fresh local identity, and
  candidate-only skills with no memory or host authority.
- The Cua, Lume, and coder providers are extension boundaries, not finished runtimes.
- The optional office visualization is not part of the current product navigation or Web build.

## Quick start

### Requirements

- Node.js 22.22.2+, 24.15.0+, or 26+
- npm 10 or newer
- Docker with Docker Compose

### Run locally

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
cp .env.example .env
```

Edit `.env` and replace the Owner password placeholder:

```dotenv
OPENBOT_OWNER_PASSWORD=<a-random-password-with-at-least-12-characters>
```

Install dependencies, start PostgreSQL, then run the Server and Web app:

```bash
npm install
npm run db:up
npm run dev:server
# In another terminal:
npm run dev:web
```

Sign in to the Web app and open **Nodes** in the sidebar to create a short-lived, one-time pairing
token. The Server-host CLI provides the same operation:

```bash
npm run node:enrollment-token -- local-development-node
```

Copy the printed `OPENBOT_NODE_ENROLLMENT_TOKEN` into `.env`, run `npm run dev:node`, and remove the
token from `.env` after the first successful start. The Node stores its new credential in
`./data/node/identity.json` with Owner-only permissions and reuses it on later starts. Open
<http://localhost:5173>, sign in with `OPENBOT_OWNER_PASSWORD`, create a Bot and channel, then add
the Bot to that channel. See [Node enrollment](docs/NODE_ENROLLMENT.md) before pairing a remote host.

By default, the local Node honestly advertises no execution capability. Computer-profile messages
remain queued until a compatible provider is configured. Model chat runs on the Server as described
below. Stop PostgreSQL with `npm run db:stop`.
Read [Database operations](docs/DATABASE.md) before upgrading, backing up, or restoring a deployment.
To sign portable Employee templates, follow the experimental
[Employee signing runbook](docs/EMPLOYEE_SIGNING.md); signing is disabled by default.

### Configure model services

Open **Model services / 模型服务** in the Web app, choose a provider and the region that issued your
API key, name the connection, and save the key. Presets cover OpenAI, Anthropic/Claude, Google
Gemini, DeepSeek, Kimi/Moonshot, OpenRouter, SiliconFlow, Alibaba Cloud Model Studio, Zhipu/Z.AI,
MiniMax, and Volcengine Ark. The Server fills in the reviewed API endpoint and protocol.

Saving a connection does not call paid inference. Fetch available models where supported, choose
one of the suggested IDs, or enter a model ID manually. Discovery reads one page, shows at most
256 IDs, and bounds the upstream response to 2 MiB; unavailable or incomplete lists always retain
manual entry. Suggestions and discovery do not guarantee account access or text-model capability.
**Test model / 测试模型** explicitly sends a short inference request and may incur provider charges.

In **Create Bot**, choose the model-chat profile and select a connection and model. Existing
model-chat Employees can change their selection in the profile. A channel Run snapshots its
connection ID and model ID when queued; later Employee edits do not redirect that Run. A missing,
disabled, or unauthorized saved connection fails visibly and never falls back to another provider.
Connection endpoints and protocols are immutable: create a new connection to change them. Use
`enabled` to disable a saved connection; there is no connection-delete operation.

API keys are encrypted with AES-256-GCM in PostgreSQL. The Server automatically creates a separate
local encryption key at `OPENBOT_MODEL_CREDENTIAL_KEY_PATH` (default `./data/model-credentials.key`,
relative to the Server process working directory). **Back up this key file together with the database.**
When saved connections already exist, a missing key stops Server startup instead of generating a
replacement. The key file is restricted to POSIX `0600`; this is a filesystem key boundary, not a
native OS keyring or KMS. API responses, Nodes, audit events, and Employee exports never receive
connection secrets. Local connection bindings are also excluded from Employee exports.

For another OpenAI-compatible service, the Server operator must authorize its exact HTTPS base
URL in `.env` before the Owner can choose **Custom**:

```dotenv
OPENBOT_MODEL_CUSTOM_BASE_URLS=https://models.example.com/v1,https://gateway.example.com/api/v1
```

This comma-separated list is empty by default. Presets accept only reviewed endpoints; custom
connections accept only this exact list, with trailing slashes normalized. URL credentials, query
strings, fragments, plain HTTP, and redirects are rejected. The browser cannot authorize arbitrary
outbound destinations.

`OPENBOT_MODEL_MAX_TOKENS=4096`, `OPENBOT_MODEL_TIMEOUT_MS=90000`, and
`OPENBOT_MODEL_MAX_CONCURRENT_RUNS=2` remain the Server defaults. No paid request is retried
automatically. Each request quotes the current message and up to ten completed exchanges from
that exact Employee and channel, with history capped at 24,000 serialized characters. Replies
are capped at 16,000 characters and upstream chat responses at 256 KiB. Private reasoning is
neither shown nor persisted. All tool-capable models now share public `web_search` and `fetch` through the Server. Both
OpenAI-compatible and native Anthropic adapters handle full tool continuations, retaining opaque
reasoning/signature state only in the current Run's memory. The selected model still writes the answer.

Retrieval is configured separately, in this order:

1. `TAVILY_API_KEY`: independent Tavily search and extraction, available to every configured model.
2. `OPENBOT_WEB_SEARCH_CONNECTION_ID`: an explicitly selected, enabled official Kimi connection;
   `OPENBOT_WEB_SEARCH_MODEL` defaults to `kimi-k3`.
3. Existing `MOONSHOT_API_KEY`: reused automatically for shared retrieval. Native Kimi can use its
   direct Formula path; other models receive a readable retrieval summary through a Kimi bridge.

Without a retrieval service, other models remain text-only. No random saved account is selected.
The bridge receives only the validated public tool request, not the Employee's chat history; Kimi
ciphertext and retrieval credentials never go to the answering provider. Each bridge lookup uses
at most one Formula execution and two Kimi completions, so its costs include retrieval and inference.
The same four-tool-call budget and total Run timeout apply across providers. Public research needs
no per-URL approval; failures are explicit, with no automatic paid retries. Audit records only tool
names and phases. No computer actions, autonomous memory access or token streaming is added.

Every registered provider preset has protocol contract coverage; individual model IDs must support
function calling. Live-provider claims require an actual authorized test, not merely a compatible API.
See [shared web tool research](docs/research/shared-model-web-tools.md).

### Existing Kimi environment configuration

Existing unbound model Employees remain compatible with the Server's Git-ignored `.env` settings:

```dotenv
MOONSHOT_API_KEY=<your-kimi-api-key>
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=kimi-k3
MOONSHOT_REASONING_EFFORT=low
```

Restart the Server after changes. When configured, this appears as the read-only `legacy-kimi`
connection; edit it through Server configuration, not the API. Use the official China or global
(`https://api.moonshot.ai/v1`) endpoint that matches the key. Environment keys are never copied
into the saved connection store. Clearing an Employee's explicit binding restores this unbound
behavior; without configured legacy credentials, subsequent model Runs fail visibly. Saved
connection failures do not trigger this compatibility path.

### Enable the employee browser

Configure the following values on the Worker Host. The built-in runtime recipe uses the pinned
CopilotKit/OpenBot `agent-computer` and binds its backend to loopback:

```dotenv
OPENBOT_DOCKER_COMPUTER_URL=http://127.0.0.1:4100
OPENBOT_DOCKER_COMPUTER_TOKEN=<a-random-token-with-at-least-16-characters>
OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false
```

Run `npm run browser:up`, then start the enrolled Node with `npm run dev:node`. Create an employee
with the browser/Docker profile and choose **Open browser** on its profile. Take control to navigate,
click or type, then return control to the employee. See [Employee browser](docs/EMPLOYEE_BROWSER.md)
for setup, session behavior and current limits.

The existing automated screenshot path accepts an explicit public URL, for example:

```text
Open https://example.com and send me a screenshot.
```

The Server assigns the Run to a compatible Node, streams structured progress and the latest frame,
stores the final screenshot, and posts the result under the selected Bot's identity.

## How it fits together

```text
Any device  ->  OpenBot Server  <- outbound connections -  Worker Hosts  ->  Providers
                 source of truth                         Windows/macOS/Linux/etc.
```

| Component | Owns | Does not own |
| --- | --- | --- |
| Client | Interaction, observation, approval input | Policy decisions or execution authority |
| Server | Identity, channels, Runs, routing, policy, approvals, audit, and persistence | Host-specific computer capabilities |
| Worker Host / Node | Capability discovery, local capacity, provider execution, progress, and artifacts | Employee identity, skills, long-term memory, or authorization policy |
| Provider | One narrow execution backend such as Docker/browser, Cua, Lume, or coder | Cross-Node routing or privilege escalation |

The Server is the only source of truth. Nodes connect outward and never require a public management
port. Routing is deterministic: a Run's fixed execution profile is intersected with online Node
capabilities; the model cannot select an unauthorized machine.

For the detailed design, read [Architecture](docs/ARCHITECTURE.md) and the
[Server/Node decision record](docs/decisions/0002-local-channel-server-node.md).

## Security

OpenBot assumes that models, prompts, webpages, skills, and execution environments can be
untrusted. The intended security boundary is:

1. The Server authorizes; the Node executes.
2. Runs have fixed Bot, channel, Node, and execution-profile relationships.
3. Write, destructive, and privileged actions must fail closed pending approval.
4. Artifacts and realtime events are bounded and validated before publication.
5. Nodes connect to the Server; management services, databases, Docker sockets, and computer
   backends must not be exposed publicly.

For anything beyond loopback development, use HTTPS, set `OPENBOT_SECURE_COOKIES=true`, restrict
`OPENBOT_ALLOWED_ORIGINS`, and place the deployment behind a private network such as Tailscale.
The Server now rejects remote HTTP origins or remote origins without Secure cookies before it
starts. HTTPS sessions use a host-only `__Host-openbot_session` cookie and HSTS; direct development
binds to loopback by default.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and [the threat model](docs/SECURITY.md)
for current guarantees and known gaps.

## Roadmap

OpenBot is built in acceptance-driven milestones. Contributions should advance one of these user
outcomes rather than add an isolated demo.

| Milestone | Outcome |
| --- | --- |
| M0 — Local control plane | Channels, Bots, authentication, persistence, and audit run without a proprietary cloud service. The foundation is available today. |
| M1 — Server/Node loop | A replaceable Node receives a browser task and returns progress and a screenshot. The read-only vertical slice is available; safe interaction remains active work. |
| M2 — Remote control and approval | Mobile access, signed single-use approvals, notifications, and exclusive human takeover. Persisted approval decisions and exclusive browser takeover are available; signed automated leases remain next. |
| M3 — Portable employees | Profile, evolution ledger, skill graph, typed memory, review-bound safe templates, and reviewed new-identity activation. |
| M4 — Native Worker Hosts | Windows, macOS, and Linux Providers use one capability and approval contract. |
| M5 — Multi-Bot operations | Structured handoffs, routines, durable queues, coder Providers, and authenticated employee transfer. |
| M6 — Distribution | Managed mobile devices, reproducible installers, signed releases, SBOMs, upgrades, backup, and recovery. |

The complete acceptance gates live in [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

OpenBot is meant to be built in the open. You do not need to understand the entire system before
contributing.

Good places to start:

| Interest | Start in |
| --- | --- |
| Product and mobile UX | `apps/web`, [interface guide](docs/INTERFACE.md) |
| APIs, persistence, and realtime | `apps/server`, `packages/db`, [API reference](docs/API.md) |
| Node protocol and reliability | `apps/node`, `packages/protocol`, [architecture](docs/ARCHITECTURE.md) |
| Computer backends | `providers/*`, `packages/provider-sdk` |
| Policy and security | `packages/policy`, [threat model](docs/SECURITY.md) |
| Documentation and translation | `README*.md`, `docs/`, decision records |
| Optional experiences | `packages/office-plugin` and future plugins, without coupling them to the core app |

Contribution flow:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and choose a scoped acceptance journey.
2. Use an existing issue or open a bug/feature issue with the provided template.
3. Keep execution capabilities behind typed provider boundaries and fail-closed tests.
4. Run `npm run check` and `npm audit` before opening a pull request.
5. Complete the pull request template, including verification and security impact.

Documentation is part of the feature. English is the canonical project language; maintained
translations should preserve the same claims, warnings, and section structure. New translations
are welcome.

## Repository map

```text
apps/
  web/                 responsive channel UI
  server/              control plane, API, persistence, routing, approvals
  node/                outbound execution Node daemon
packages/
  domain/              shared entities
  protocol/            versioned Server/Node messages and API validation
  db/                  PostgreSQL schema and migrations
  policy/              deterministic fail-closed policy evaluator
  provider-sdk/        provider contracts
  office-plugin/       deferred optional visualization
providers/
  docker/              browser adapter with read-only Runs and human control
  cua/                 macOS extension boundary
  lume/                macOS VM extension boundary
  coder/               coding-agent extension boundary
deploy/                 Compose, systemd, and launchd assets
docs/                   product, architecture, security, roadmap, API, and ADRs
```

## Documentation

| Goal | Start here |
| --- | --- |
| Understand the product and boundaries | [Product definition](docs/PRODUCT.md) |
| Understand the system | [Architecture](docs/ARCHITECTURE.md) |
| Follow the active implementation sequence | [Goal-mode execution plan](docs/EXECUTION_PLAN.md) |
| Review current and future delivery | [Roadmap](docs/ROADMAP.md) |
| Build or integrate against the API | [Local API](docs/API.md) |
| Review security guarantees | [Threat model](docs/SECURITY.md) |
| Work on the channel experience | [Interface guide](docs/INTERFACE.md) |
| Review or improve keyboard and assistive-technology behavior | [Accessibility baseline](docs/ACCESSIBILITY.md) |
| Design employee identity and portability | [Portable employee model](docs/EMPLOYEE.md) |
| Operate signed Employee packages | [Employee signing runbook](docs/EMPLOYEE_SIGNING.md) |
| Add an operating system or device | [Cross-platform Worker Hosts](docs/CROSS_PLATFORM.md) |
| Test a Worker Host or Provider claim | [Provider conformance](docs/PROVIDER_CONFORMANCE.md) |
| Understand upstream choices | [Upstream strategy](docs/UPSTREAMS.md) |
| Follow the open-source-first review process | [Open-source reuse policy and current audit](docs/OPEN_SOURCE_REUSE.md) |
| Pick an independently reviewable contribution | [Contributor work packages](docs/CONTRIBUTOR_TASKS.md) |
| Review why a decision was made | [Architecture decision records](docs/decisions/) |

## Upstream projects

OpenBot integrates ideas and narrow interfaces from existing open-source work instead of copying
multiple control planes into one repository:

- [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) — current `agent-computer` provider
  boundary and product research.
- [Cua](https://github.com/trycua/cua) and Lume — planned macOS execution providers.
- [OpenClaw](https://github.com/openclaw/openclaw) — optional runtime, skills, and operational
  reference; not a second source of truth.
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — product reference for the
  employee evolution archive, learning graph, skill/memory separation, and reviewed skill writes.
- [Agent Skills](https://github.com/agentskills/agentskills) — planned standard format and official
  validator for executable skill bundles.
- Codex, Claude, and Multica — planned isolated coding-provider integrations.

Upstream licenses and notices must be preserved whenever code is incorporated.

## License and naming

OpenBot is available under the [MIT License](LICENSE).

`OpenBot` is currently a working project name and is already used by other public projects,
including CopilotKit/OpenBot. A distinct public name must be selected before a stable release. The
project is not affiliated with xAI, Tencent, CopilotKit, OpenClaw, or the other referenced projects.
