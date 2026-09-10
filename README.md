<p align="center">
  <img src="docs/design/openbot-readme-banner.png" alt="OpenBot" width="100%">
</p>

# OpenBot

**A self-hosted workspace for digital workers, through Desktop and Web.**

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-f59e0b.svg)](#project-status)

OpenBot runs named AI employees on computers you control. Channels, conversations, employee
profiles, tasks, approvals and results stay in your own workspace. Desktop and Web share the
React interface and connect to the same authoritative OpenBot Server.

One Desktop application can combine **Client**, **Server** and **Worker** roles as each platform's
implementation becomes available. Client is where you direct and supervise work; Worker and
Providers execute on an enrolled computer; Server owns identity, routing, authorization and audit.
The app's ability to display a desktop does not grant permission to control it.

> [!WARNING]
> OpenBot is pre-alpha. Desktop artifacts are unsigned development bundles, not signed public
> installers. The browser Provider opens explicit URLs and returns screenshots; an opt-in,
> reviewed single-button click is experimental. Native desktop input and unattended forms are not implemented.
> Do not connect payment methods, primary accounts or production credentials.


The local Desktop alpha.4 upgrade adds [channel Bot delegation, persistent attachments and reviewed MCP plugin tools](docs/CORE_UPGRADE.md). Each recipient executes under its own identity; the Server records the task tree.

## Desktop on Windows, macOS and Linux

All three platforms use the same Electron 44.2.0 application and shared channel workspace.

| Target | Desktop client | Local Server setup | Local Worker integration |
| --- | --- | --- | --- |
| macOS arm64 | Existing Server connection, native navigation and workspace UI | Bundled PostgreSQL and Server; app-owned local data, no Docker required | Guided pairing through the separately bundled macOS Worker companion |
| Windows x64 | Existing Server connection and shared workspace UI | Use a separately deployed Server | Native Windows Host has build/contract evidence; integrated Desktop installation remains planned |
| Linux x64 | Existing Server connection and shared workspace UI | Use a separately deployed Server | Separate Node/service deployment; integrated Desktop installation remains planned |

The CI matrix builds and packages these targets. Its downloadable bundles are **development
evidence**, not real-device desktop-control certification. macOS Intel and other Desktop
architectures are outside this hosted matrix. Native macOS startup has local arm64 evidence;
Windows and Linux initially offer the remote-client path.

### Download a development bundle

**Start here: [Desktop downloads and installation](docs/DESKTOP_INSTALLATION.md)** — platform file
names, installation steps, command installers, first model setup and upgrade/data guidance.
Versioned DMG (macOS arm64), per-user EXE (Windows x64), AppImage and DEB (Linux x64) now have a
native CI build path. Published installers will appear in
[Desktop Releases](https://github.com/yxflc11/openbot/releases); publication remains pending until a
`desktop-v...` release contains those assets. Successful CI installer artifacts expire after 14 days.

Open a successful run for the desired commit in [GitHub Actions](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
and download its `openbot-desktop-<platform>-<arch>-<commit>.tar.gz` artifact. GitHub sign-in is
required; these artifacts expire after seven days. Extract with `tar -xzf <archive>` to retain
executable permissions and symlinks. Open `OpenBot.app` on macOS, `openbot.exe` on Windows, or
`openbot` on Linux from the extracted directory. OS requirements for unsigned apps still apply.

Each platform uploads only after its package checks pass. The tar archives above are application
directories; the separate `openbot-installers-...` artifacts contain installers and checksums.
No automatic update channel is enabled. The older `v0.1.0-alpha.1` GitHub Release remains a
source-only foundation snapshot.

### Build from source

Use Node.js 24 LTS (within the [declared engine range](package.json)) and npm:

```bash
git clone https://github.com/yxflc11/openbot.git
cd openbot
npm ci
npm run check
npm run package --workspace @openbot/desktop
```

Build on the target OS; output is in `apps/desktop/out/`. macOS packaging includes the local Server
and pinned PostgreSQL runtime. A normal source package omits the optional Worker companion unless
`OPENBOT_DESKTOP_MACOS_WORKER_COMPANION` points to a validated bundle; macOS CI builds it first.

On macOS, choose **Service computer** to initialize local services or **Connect to a service
computer** for an existing Server. Windows and Linux offer the connection path. For remote access,
enter a trusted HTTPS Server origin and sign in as its Owner. See
[Desktop setup](docs/DESKTOP_ONBOARDING.md) for the full flow and data lifecycle.

## Project status

| Area | Available in source | Remaining work |
| --- | --- | --- |
| Desktop and Web | Channels, Bots, approvals, task inspector, shared back/forward navigation, native menus, conversation draft/scroll restoration, skills gallery and persistent interface preferences | Notifications, localization polish and broader accessibility/device evidence |
| Local macOS services | App-owned PostgreSQL and Server, encrypted bootstrap, restart with retained data, explicit remote-client switching | Cross-platform guided services, authenticated remote sharing, backup, upgrades and login-service recovery |
| Models / native Agent | Owner opt-in, encrypted OpenAI/Anthropic/OpenRouter settings, bounded model/tool/observation loop, scoped channel/source reads, downloadable Markdown reports, durable replies, stop/resubmit and recorded model usage | Live model evidence, broader governed tools and external-agent adapters |
| Automatic tasks | PostgreSQL schedules, pause/resume/delete, bounded intervals, one due occurrence after downtime and existing authorized task routing | Multi-Server coordination and additional schedule semantics |
| Employee profile | Role/biography editing, dated evolution archive, reviewed skills, typed Owner-managed memory, reviewed task lessons with explicit model sharing, review-bound export/import and experimental DSSE signing | Autonomous learning, executable skills, selective cloning and public trust distribution |
| Worker protocol | Outbound connections, one-time pairing, revocation, versioned capability routing, progress, frames and artifacts | Proof-of-possession identity, complete service/device conformance and signed distribution |
| Computer execution | URL screenshots and opt-in reviewed button click on trusted test origins | Browser egress isolation, native desktop Providers, signed single-use leases and exclusive takeover |

The [native Agent](docs/NATIVE_AGENT.md) runs new `none`-profile tasks after explicit Owner opt-in.
OpenBot does not yet provide Hermes/Pi/OpenClaw runtime
adapters, a plugin installation lifecycle, or arbitrary desktop control. Cua, Lume and coder are
extension boundaries. The optional office visualization remains deferred.

Employee evolution and learning are explicitly inspired by
[Hermes Agent's learning graph](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py).
OpenBot owns its evidence, review and portability model and does not claim to have invented that concept.

[Current delivery evidence and remaining capability gaps](docs/DELIVERY_STATUS.md).

## Development

Desktop is optional. To run Server, PostgreSQL and Web separately:

```bash
cp .env.example .env
# Set OPENBOT_OWNER_PASSWORD to a random password of at least 15 characters.
npm ci
npm run db:up
npm run dev:server
# In another terminal:
npm run dev:web
```

Open <http://localhost:5173>. Create a Bot and channel, then use **Nodes** to pair a Worker.
The Server-host command `npm run node:enrollment-token -- local-development-node` also issues a
one-time token. Follow [Node enrollment](docs/NODE_ENROLLMENT.md) to start `npm run dev:node`;
remove the bootstrap token after successful enrollment. Without an execution Provider, Runs
remain queued. Stop PostgreSQL with `npm run db:stop`.

To enable the existing browser slice, run the pinned
[CopilotKit/OpenBot agent-computer](https://github.com/CopilotKit/openbot/tree/257c1280d684089be9adb0b35cce262efc7064bf/agent-computer)
on Node loopback and configure `OPENBOT_DOCKER_COMPUTER_URL`,
`OPENBOT_DOCKER_COMPUTER_TOKEN` and `OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS=false`.
Send an explicit public URL in a channel to obtain a screenshot. For the default-off interaction
flow, see [one reviewed browser click](docs/CONTROLLED_BROWSER.md).

For container deployment, see [Server container](docs/SERVER_CONTAINER.md). For scheduled work,
see [Automations](docs/AUTOMATIONS.md): the Server must stay running; schedules confer no extra
authority. Native execution requires the separate [Agent opt-in](docs/NATIVE_AGENT.md).

## Security and architecture

```text
Desktop / Web -> Server -> authorized task routing
                   ^                |
                   +-- outbound Worker connections -> Providers
```

Server is the only source of truth. Renderers, models, webpages, skills, Providers and Worker
Hosts are untrusted. Sensitive side effects require explicit policy and approval; capability
advertisements cannot authorize actions. Desktop uses local assets, sandboxed renderers, typed
IPC and verified packaging fuses.

Remote deployments require HTTPS, `OPENBOT_SECURE_COOKIES=true`, restricted
`OPENBOT_ALLOWED_ORIGINS` and a trusted private network. Keep databases and computer backends
private. Node credentials are still bearer secrets; do not infer proof-of-possession or mTLS
from pairing. See [Security policy](SECURITY.md), [threat model](docs/SECURITY.md) and
[Provider conformance](docs/PROVIDER_CONFORMANCE.md).

## Contributing and documentation

Use a feature branch and pull request. Research and pin upstream choices before behavior changes,
preserve notices, update English and maintained translations, and run `npm run check` and
`npm audit`. Read [Contributing](CONTRIBUTING.md) and [open-source reuse](docs/OPEN_SOURCE_REUSE.md).

| Path | Responsibility |
| --- | --- |
| `apps/desktop`, `apps/web` | Electron shell and shared React interface |
| `apps/server`, `apps/node` | Authoritative control plane and execution daemon |
| `apps/worker-host-macos`, `apps/worker-host-windows` | Narrow native service integration |
| `packages/*`, `providers/*` | Shared domain/protocol/storage/policy and execution adapters |
| `deploy/`, `docs/` | Deployment resources, contracts, research and acceptance evidence |

Start with [Product](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md),
[Roadmap](docs/ROADMAP.md), [API](docs/API.md), [Cross-platform hosts](docs/CROSS_PLATFORM.md),
[Database operations](docs/DATABASE.md) and [Employee signing](docs/EMPLOYEE_SIGNING.md).

## License and naming

[MIT License](LICENSE). Upstream notices are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
`OpenBot` is a working name already used by other projects, including CopilotKit/OpenBot; a distinct
name is required before a stable release. This project is not affiliated with xAI, Tencent,
CopilotKit, OpenClaw or other referenced projects.

Reviewed instruction workflows are available through [SKILL.md import and Owner review](docs/REVIEWED_SKILLS.md).

### Desktop model providers

Settings → Model API offers eleven provider presets: OpenAI, Anthropic, Google Gemini, DeepSeek,
Kimi, OpenRouter, SiliconFlow, Alibaba Cloud Model Studio, Z.AI, MiniMax and Volcengine Ark.
Choose the API-key region, select a suggested model or enter its ID, and save the encrypted default.
Supported providers can fetch a bounded model list without generating paid content. Providers
without a reviewed listing API explicitly save without online validation. Switching provider or
region clears the key field. Existing Kimi settings and local data remain compatible. This Desktop
uses one Server-owned default; per-Employee connections and arbitrary custom hosts are not added.
See [integration research](docs/research/desktop-model-presets.md).
