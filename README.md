<p align="center">
  <img src="docs/design/openbot-readme-banner.png" alt="OpenBot" width="100%">
</p>

# OpenBot

**A self-hosted workspace for multi-channel, multi-agent digital workers.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Node.js 22.22.2+](https://img.shields.io/badge/Node.js-22.22.2%2B-339933.svg)](package.json)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-f59e0b.svg)](#project-status)

OpenBot is an early-stage, open-source, self-hosted platform for running named AI employees on
computers you control. OpenBot itself is an agent focused on multi-channel, multi-agent task work;
it can delegate bounded work to external agents while the OpenBot Server remains authoritative for
identity, routing, policy, approval, persistence, and audit.

The target product has two complete clients. OpenBot Desktop is the guided path: install the same
application on each computer, then enable any combination of Client, Server, and Worker roles.
OpenBot Web connects to the same workspace and can also be the primary client for an advanced user
who deploys Server, Web, PostgreSQL, and Worker services separately.

A Mac mini is one practical Worker Host, not the product boundary. Windows, macOS, and Linux
computers can all be everyday user computers and authorized work machines. OpenBot is inspired by
the always-on, channel-based experience of products such as Grok Bot and the browser-managed agent
experience of DeepSeek Harness while remaining self-hosted, provider-neutral, extensible, and
designed for explicit human control.

> [!WARNING]
> OpenBot is pre-alpha source code, not the finished Desktop product described below. The current
> computer provider is read-only and does **not** fill, click, submit, or control production
> accounts. Do not connect payment methods, primary accounts, or production credentials. Read
> [Security](#security) before exposing a deployment.

## Why OpenBot

- **Local channels, not disposable chat windows.** Bots, conversations, runs, and results persist
  in your own PostgreSQL database.
- **Replaceable, cross-platform computers.** An employee is a persistent identity and policy; a
  Worker Host is a Windows, macOS, Linux, VM, container, or managed device that can be replaced.
- **Employees that grow and travel.** Each employee has an evidence-backed evolution history,
  skill graph, decision trace, memory, work record, configuration, and safe portability controls.
- **Approval before side effects.** Sensitive actions enter an explicit, auditable approval state.
  Models cannot grant themselves additional privileges.
- **One workspace through Desktop or Web.** Both clients use the same Server-owned channels,
  agents, tasks, approvals, devices, plugins, and history.
- **Composable roles on every computer.** The same Desktop installation can act as a Client, host
  the Server, run the Worker service, or combine those roles.
- **Native OpenBot plus external agents.** OpenBot remains the coordinating agent and can delegate
  bounded work to Hermes, Pi, OpenClaw, and future adapters.
- **Open extension without self-authorization.** Plugins may change presentation or add tools,
  channels, agents, and automation, but only the Server can grant authority.
- **Composable Bot identities.** Bot appearance is stored as five independent layers: head, body,
  mobility, accessory, and accent color.
- **Adapters over lock-in.** Models, computer runtimes, and upstream projects connect through typed,
  versioned boundaries.

The Employee evolution and learning direction is explicitly inspired by
[Hermes Agent's learning graph](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py).
OpenBot keeps its own Server-owned evidence, review, permission, and portability model; it does not
present the learning-graph concept as an OpenBot invention.

## Target product model

> [!NOTE]
> This section defines the accepted product direction. It does not claim that Desktop, guided
> service installation, external-agent adapters, or the plugin platform are available today.

| Entry path | Intended experience |
| --- | --- |
| OpenBot Desktop | The recommended full client for macOS, Windows, and Linux, with guided workspace creation, connection, service installation, permissions, diagnostics, and recovery. |
| OpenBot Web | A full browser client for remote access to the same workspace, or the primary client for a modular self-hosted deployment. |
| Modular self-hosting | An advanced path that installs Server, Web, PostgreSQL, and one or more Worker services separately without requiring Desktop. |

Desktop roles are capabilities, not separate editions:

| Role | Responsibility |
| --- | --- |
| Client | Channels, messages, tasks, approvals, settings, and observation. |
| Server | Workspace truth, identity, routing, policy, approvals, persistence, and audit. |
| Worker | Background execution on the current computer through explicitly authorized Providers. |

A computer may enable all three roles. A “five computers” choice is onboarding progress, not a
license or permission limit; every computer enrolls separately and can be revoked separately.

OpenBot's first external-agent integration mode is bounded delegation. Direct channel membership
for external agents comes later, after identity, memory, lifecycle, and permission behavior has
passed the same conformance tests as the native OpenBot agent.

The plugin model will support UI/themes, channels, agent adapters, tools/providers, automation, and
optional experiences. Plugins can decide how a feature looks or works inside their granted
capabilities, but they cannot decide what authority they have.

## Project status

OpenBot currently provides a tested vertical slice from a local channel to a remote execution Node
and back. The table deliberately separates working code from planned capabilities.

| Area | Available now | Next step |
| --- | --- | --- |
| Control plane | Local Owner authentication, drift-checked PostgreSQL migrations, Bots, channels, membership, messages, runs, approvals, artifacts, Employee memory lifecycle, content-free multi-device profile invalidation, and audit events | Desktop bootstrap, durable routines, memory retrieval/retention, automated recovery tooling, and multi-user trust |
| Clients | Responsive channel-first Web UI, named Bot targeting, Bot-authored results, replies, rich text/tables, run inspector, approvals, Node management, bounded SSE with snapshot recovery, accessible employee tabs, and native modal focus handling | A sandboxed Electron Desktop sharing the React UI, guided role setup, installable Web/PWA access, notifications, and localization polish |
| Bot identity | Five-layer composable appearance persisted with each Bot and reused across channels and the employee profile | More parts and community-created appearance packs |
| Employee profile | Seven-view profile, revision-checked Owner editing for role and biography, Hermes-inspired dated evolution archive with filters and full evidence references, inspectable Owner skill review, Owner-managed typed memory with content-free audit, biography-preserving safe template export with exact reviewed-download binding, quarantined import, reviewed fresh-identity activation, and experimental DSSE signing | Display-name/model/host/appearance policy editors, memory retrieval/retention and autonomous proposals, native keyring/KMS and public trust adapters, executable Agent Skills bundles with full-diff review, selective cloning, registry distribution, and ownership transfer |
| Node protocol | Outbound WebSocket registration, Owner UI for one-time pairing/list/revoke, individually revocable credentials, heartbeat, capacity, exact capability-major routing, two-phase assignment, explicit start, progress, frames, completion, disconnect recovery, and experimental Linux system/user service profiles with contract-tested Secret Service | Guided Worker-role installation, proof-of-possession identity, mTLS, rotation, replay protection, native keyrings, signed installers, and real-device conformance reports |
| Browser execution | Open an explicit public HTTP(S) URL through the pinned CopilotKit/OpenBot `agent-computer` boundary and return a bounded PNG screenshot | Observe/fill/act loop, continuous frames, safe form interaction, and retry semantics |
| Human control | Persisted approval request/decision flow bound to Run, Node, action, target fingerprint, risk, and expiry | Single-use signed capability leases and exclusive remote takeover |
| Providers | Functional read-only Docker/browser adapter; typed Cua, Lume, and coder package boundaries | Portable browser plus Windows, macOS, Linux desktop, managed Android, and isolated coding providers |
| Agent runtime | Server-owned Bot, channel, Run, result, profile, skill, memory, and audit foundations | A native OpenBot agent, durable multi-agent handoff, and bounded Hermes, Pi, and OpenClaw adapters |
| Plugins | Isolated `@openbot/office-plugin` package with no core-app dependency | Permissioned manifests, lifecycle, sandboxed host APIs, UI slots, local development, and later trusted distribution |
| Distribution | Source code and an older source-only foundation preview | Signed Desktop installers in GitHub Releases, Worker artifacts, upgrade/rollback evidence, and separately useful SDK or container packages |

### What the current release does not claim

- There is no public OpenBot Desktop client, guided multi-role installer, installable Worker Host,
  or OpenBot artifact in GitHub Packages today. The older `v0.1.0-alpha.1` release is a source-only
  foundation preview and does not represent the current repository or the target Desktop product.
- It does not perform unattended form submissions or arbitrary desktop actions.
- It does not yet issue cryptographic, single-use capability leases after approval.
- It does not provide continuous remote desktop control.
- Node enrollment is individually revocable, but the current identity remains a copyable bearer
  secret. A dedicated Linux login may explicitly store it in Secret Service without file fallback;
  real keyring/systemd device evidence is still pending. It is not proof-of-possession identity or
  mTLS and must stay behind WSS and a trusted private network.
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
- Hermes, Pi, and OpenClaw are planned integrations, not working adapters in the current build.
- There is no plugin install, permission, sandbox, update, or rollback lifecycle yet.
- The optional office visualization is not part of the current product navigation or Web build.

## Quick start

This is a developer source setup for the current Web/Server/Node slice. It is not the planned
Desktop installation flow.

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
OPENBOT_OWNER_PASSWORD=<a-random-password-with-at-least-15-characters>
```

The Server uses the direct peer IP only as a pseudonymous login/enrollment throttle key. With one
single-hop reverse proxy, set `OPENBOT_TRUSTED_PROXY_ADDRESS` to that proxy's exact IP; only then is
one RFC 7239 `Forwarded: for=...` value accepted. Do not set it for a range or multi-hop chain.

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
To sign portable Employee templates, follow the experimental
[Employee signing runbook](docs/EMPLOYEE_SIGNING.md); signing is disabled by default.

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
Desktop (planned) --+
                    +--> OpenBot Server --> OpenBot agent / bounded adapters (planned)
Web (available) ----+       source of truth          |
                                                    v
                                      outbound Worker connections --> Providers
                                      Windows / macOS / Linux
```

| Component | Owns | Does not own |
| --- | --- | --- |
| Desktop / Web Client | Interaction, observation, configuration, and approval input | Policy decisions or execution authority |
| Server | Identity, channels, Runs, routing, policy, approvals, audit, and persistence | Host-specific computer capabilities |
| OpenBot agent / Agent adapter | Planning, bounded task work, structured progress, and results | Permission grants, device authorization, or audit truth |
| Worker Host / Node | Capability discovery, local capacity, provider execution, progress, and artifacts | Employee identity, skills, long-term memory, or authorization policy |
| Provider | One narrow execution backend such as Docker/browser, Cua, Lume, or coder | Cross-Node routing or privilege escalation |
| Plugin | Presentation or behavior within declared and granted capabilities | Self-authorization or bypassing Server policy |

The Server is the only source of truth. Nodes connect outward and never require a public management
port. Routing is deterministic: a Run's fixed execution profile is intersected with online Node
capabilities; the model cannot select an unauthorized machine.

For the detailed design, read [Architecture](docs/ARCHITECTURE.md) and the
[Server/Node decision record](docs/decisions/0002-local-channel-server-node.md).

## Development baseline

OpenBot minimizes language count so that most contributors need only Node.js and npm:

| Area | Baseline |
| --- | --- |
| Shared product code | TypeScript for Web, Server, Node, protocols, Agent adapters, plugin SDKs, and tests |
| User interface | React and Vite shared by Web and the planned Electron Desktop |
| Production JavaScript runtime | Node.js 24 LTS as the preferred development and deployment line; the current source still follows the wider engine range in `package.json` |
| Persistence | PostgreSQL and reviewed SQL migrations |
| macOS-only integration | A thin Swift layer for Keychain, service lifecycle, permissions, and native control |
| Windows-only integration | A thin C#/.NET layer for Service lifecycle, protected credentials, process supervision, and native control |
| External agents | Their upstream language behind a typed OpenBot adapter; Hermes remaining Python does not make Python an OpenBot core language |

Electron is the accepted Desktop direction because it maximizes reuse of the current
TypeScript/React system. Its exact release must still be pinned by the repository's research and
ADR process before implementation. Rust is not a core language unless a later, evidenced platform
gap justifies adding it.

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
| Foundation — available now | Local channels, Bots, authentication, PostgreSQL persistence, audit, employee profiles, Node routing, approvals, and a read-only browser round trip. |
| R0 — Product and technology contract | Align the bilingual documentation, record the Desktop/Web/role model, and pin researched technology decisions. |
| R1 — Shared Desktop and Web | Reuse the React UI in a sandboxed Electron Desktop while retaining the full browser client. |
| R2 — Guided roles and multiple computers | Create or join a workspace, enable Client/Server/Worker roles, install services, pair each computer, diagnose failures, and revoke devices. |
| R3 — Modular self-hosting | Operate Server, Web, PostgreSQL, and Worker services without requiring Desktop, with backup, recovery, and private-network guidance. |
| R4 — Native OpenBot and external agents | Make OpenBot a durable coordinating agent, then add bounded Hermes, Pi, and OpenClaw adapters behind the same authority boundary. |
| R5 — Plugin platform | Add permissioned UI, theme, channel, Agent, tool/provider, automation, and optional-experience plugins with lifecycle and rollback. |
| R6 — Safe computer control | Add observe/fill/act, single-use capability leases, continuous frames, exclusive takeover, and evidenced native Providers. |
| R7 — Distribution | Ship signed Desktop installers through GitHub Releases, verified Worker artifacts, SBOMs, upgrades, rollback, backup, and recovery. |

The focused product, architecture, and roadmap documents will be aligned with this accepted
sequence before R1 implementation begins. Existing capability gates remain in
[docs/ROADMAP.md](docs/ROADMAP.md) until that documentation task is reviewed.

## Contributing

OpenBot is meant to be built in the open. You do not need to understand the entire system before
contributing.

Most contributors need only the preferred Node.js 24 LTS line and npm. Swift is required only for
macOS-native work, and .NET is required only for Windows-native work; hosted CI supplies the
cross-platform verification lanes.

Good places to start:

| Interest | Start in |
| --- | --- |
| Shared Desktop and Web UX | `apps/web`, the future `apps/desktop`, [interface guide](docs/INTERFACE.md) |
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

Use a fork or focused feature branch and submit a pull request; feature work does not go directly
to `main`. A contributor only needs the platform toolchain for the platform-specific code they
change.

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
  provider-conformance-runner/ bounded Provider scenario evidence
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
- [OpenClaw](https://github.com/openclaw/openclaw) — planned bounded adapter candidate plus skills
  and operational reference; never a second source of truth.
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — first external-agent adapter
  candidate and the attributed product reference for the employee evolution archive, learning
  graph, skill/memory separation, and reviewed skill writes.
- Pi — planned external-agent adapter candidate; the exact upstream and release must be recorded in
  a research note before implementation.
- [Agent Skills](https://github.com/agentskills/agentskills) — planned standard format and official
  validator for executable skill bundles.
- Codex, Claude, and Multica — planned isolated coding-provider integrations.

Upstream licenses and notices must be preserved whenever code is incorporated.

## License and naming

OpenBot is available under the [MIT License](LICENSE).

`OpenBot` is currently a working project name and is already used by other public projects,
including CopilotKit/OpenBot. A distinct public name must be selected before a stable release. The
project is not affiliated with xAI, Tencent, CopilotKit, OpenClaw, or the other referenced projects.
