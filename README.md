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
> OpenBot is pre-alpha software. The current computer provider is read-only and does **not** fill,
> click, submit, or control production accounts. Do not connect payment methods, primary accounts,
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
| Control plane | Local Owner authentication, drift-checked PostgreSQL migrations, Bots, channels, membership, messages, runs, approvals, artifacts, and audit events | Durable routines, memory, automated recovery tooling, and multi-user trust |
| Channel UI | Responsive channel-first Web UI, named Bot targeting, Bot-authored results, replies, rich text/tables, run inspector, approvals, Node management, bounded SSE with snapshot recovery, accessible employee tabs, and native modal focus handling | Installable PWA, notification delivery, real screen-reader/zoom evidence, and localization polish |
| Bot identity | Five-layer composable appearance persisted with each Bot and reused across channels and the employee profile | More parts and community-created appearance packs |
| Employee profile | Seven-view profile, safe template export, quarantined import inspection, Owner-reviewed skill metadata, and a tested DSSE signing/verification primitive | Publisher-key lifecycle, signed export/import routes, executable Agent Skills bundles, memory controls, reviewed activation, cloning, and transfer |
| Node protocol | Outbound WebSocket registration, Owner UI for one-time pairing/list/revoke, individually revocable credentials, heartbeat, capacity, exact capability-major routing, two-phase assignment, explicit start, progress, frames, completion, and disconnect recovery | Proof-of-possession identity, mTLS, rotation, replay protection, native keyring adapters, and real-device conformance reports |
| Browser execution | Open an explicit public HTTP(S) URL through the pinned CopilotKit/OpenBot `agent-computer` boundary and return a bounded PNG screenshot | Observe/fill/act loop, continuous frames, safe form interaction, and retry semantics |
| Human control | Persisted approval request/decision flow bound to Run, Node, action, target fingerprint, risk, and expiry | Single-use signed capability leases and exclusive remote takeover |
| Providers | Functional read-only Docker/browser adapter; typed Cua, Lume, and coder package boundaries | Portable browser plus Windows, macOS, Linux desktop, managed Android, and isolated coding providers |
| Office view | Isolated `@openbot/office-plugin` package with no core-app dependency | Optional plugin lifecycle after the channel workflow is mature |

### What the current release does not claim

- It does not perform unattended form submissions or arbitrary desktop actions.
- It does not yet issue cryptographic, single-use capability leases after approval.
- It does not provide continuous remote desktop control.
- Node enrollment is individually revocable, but the current credential is still a bearer secret
  stored in an Owner-only file. It is not yet proof-of-possession identity, mTLS, or native-keyring
  storage and must stay behind WSS and a trusted private network.
- It does not yet propose or execute learned skills autonomously, edit memory, activate imported
  employee packages, clone employees, or transfer ownership.
- The current employee template is checksum-protected but unsigned. It carries no memory or host
  authority and must remain quarantined when import support is added.
- A DSSE/Ed25519 signing and verification primitive is implemented, but it is not exposed by the
  current export route until Owner key creation, storage, rotation, revocation, and trust policy are
  implemented.
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

By default, the local Node honestly advertises no execution capability. Messages are still stored
as queued Runs until a compatible provider is configured. Stop PostgreSQL with `npm run db:stop`.
Read [Database operations](docs/DATABASE.md) before upgrading, backing up, or restoring a deployment.

### Enable the read-only browser slice

Run the pinned
[CopilotKit/OpenBot `agent-computer`](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer)
on the Node machine and keep it bound to loopback. Configure both values below with the same
computer token, then restart the Node:

```dotenv
OPENBOT_DOCKER_COMPUTER_URL=http://127.0.0.1:4100
OPENBOT_DOCKER_COMPUTER_TOKEN=<a-random-token-with-at-least-16-characters>
OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false
```

Send a channel message containing an explicit public URL, for example:

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
| M2 — Remote control and approval | Mobile access, signed single-use approvals, notifications, and exclusive human takeover. Persisted approval decisions are available; leases and takeover are next. |
| M3 — Portable employees | Profile, evolution ledger, skill graph, typed memory, and safe employee templates. |
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
  docker/              current read-only browser adapter
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
