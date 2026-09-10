<p align="center">
  <img src="docs/design/openbot-readme-banner.png" alt="OpenBot" width="100%">
</p>

# OpenBot

**A self-hosted workspace where named Bots work together in channels.**

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

[![CI](https://github.com/yxflc11/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/yxflc11/openbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)

Create colleagues with their own identity, role, reviewed memory and skills. Assign work in a channel, let one Bot ask another for help, follow their replies and download the result. Desktop and Web share the actual React workspace; the OpenBot Server owns identity, permissions, routing, approvals and audit.

**Current source version: Desktop `0.1.0-alpha.6`.** Channel collaboration, richer files, the MCP extension interface and the bilingual website are implemented. Check [Desktop releases](https://github.com/yxflc11/openbot/releases) for published installers; source commits and installer publication are separate. See the [feature-by-feature delivery record](docs/RELEASE_COMPLETION.md) for implemented behavior and validation boundaries. Development installers are unsigned; no automatic update channel or arbitrary desktop-control certification is claimed.

Website: [English](https://yxflc11.github.io/openbot-website/) · [简体中文](https://yxflc11.github.io/openbot-website/zh-cn/). The website is deployed independently from the product installer. Read the [source documentation index](docs/README.md) now. English and Chinese are the maintained current-candidate documentation; the Japanese and Portuguese READMEs describe an earlier snapshot.

## What you can do

| Part | Current behavior |
| --- | --- |
| Channels and direct conversations | Select one or several Bots, quote replies, retain drafts and reading position, inspect task history and manage group membership. |
| Bot collaboration | Start bounded child tasks under each recipient's own identity, continue independent work and gather colleague results before delivery. Six concurrent root tasks; two delegation levels and four descendants per tree. |
| Task controls | Real provider text drafts, task details, stop/resubmit and up to eight explicit additional instructions per native task at model-step boundaries. MiniMax uses the guarded final-response path. |
| Message actions | Emoji, reply and overflow controls beside the bubble on hover/focus; copy and task details live in the menu. Reactions currently belong to the single workspace Owner. |
| Files and voice | Add originals, extract Office/PDF text, recognize image text locally, explicitly transcribe selected media, record/preview voice, download originals/results and manage the attachment recycle bin. |
| Bot profiles | Edit role/biography; inspect evidence and evolution; create/edit/delete typed memory; explicitly choose model-visible memory; review proposed lessons and skill versions. |
| Skills | Import a single `SKILL.md`, review the complete version and allow its bounded use with existing tools. This does not execute arbitrary scripts or grant permissions. |
| Share a Bot | Preview and download its portable profile and verified skill metadata. Imports create a new identity and require review. Memory, conversations, credentials, live grants and skill instruction files are excluded. |
| Plugins | Connect standard MCP tools, text resources, Owner-selected prompts and isolated Apps. Review declarations and updates, grant access per Bot and approve configured external writes. |
| Automations | Create fixed-interval tasks, pause/resume/delete, inspect the last outcome and skip overlapping runs. The Server must remain running. |
| Settings | Eleven model-provider presets, retained encrypted credentials, explicit Agent enablement and workspace appearance/navigation/send preferences. |
| Website | Product pages, searchable English/Chinese manuals, extension protocol/contribution guides and an isolated interactive demo made from the real channel components. Deployed from the separate openbot-website repository. |

These are bounded features, not a claim of unlimited agents, unrestricted computer input, multi-human collaboration, complete MCP support, automatic crash replay or pixel-identical reproduction of every Grok state. The [delivery record](docs/RELEASE_COMPLETION.md) explains each boundary and links its implementation.

## Windows candidate and existing platforms

New native platform work in this milestone targets **Windows x64**. The alpha.6 source adds a per-user NSIS installer, bundled local Server/PostgreSQL, DPAPI bootstrap storage, private data ACLs, graceful stop and retained-data restart. [Hosted Windows validation](https://github.com/yxflc11/openbot/actions/runs/34497646235) passed the installed runtime, encrypted credentials, database migrations, retained restart and installer lifecycle. This does not certify interactive hardware or code signing. Installation does not enroll a Worker or grant computer-control authority. See [Windows Desktop](docs/WINDOWS_DESKTOP.md).

Existing macOS arm64 local services/companion and Linux remote-client code are retained; this milestone does not add new macOS/Linux adaptation or broaden their conformance claims. Worker Hosts and computer Providers remain separate components with their own enrollment and evidence.

Use [Desktop installation](docs/DESKTOP_INSTALLATION.md) for exact filenames and upgrade instructions. Obtain artifacts only from a successful run for the desired commit in [GitHub Actions](https://github.com/yxflc11/openbot/actions/workflows/ci.yml), or from a [Desktop Release](https://github.com/yxflc11/openbot/releases) that actually contains the matching installer and `SHA256SUMS`. A build script or source tag does not mean an installer has been published.

## Build and run

Use the CI baseline **Node.js 22.22.2 and npm 10.9.9**, or a Node version satisfying [package.json](package.json). Install from the lockfile:

```sh
git clone https://github.com/yxflc11/openbot.git
cd openbot
npm ci
npm run check
npm run package --workspace @openbot/desktop
```

Build Desktop on its target OS; output is in `apps/desktop/out/`. Windows native preparation needs the validated PostgreSQL source-build bundle described in [Windows Desktop](docs/WINDOWS_DESKTOP.md). The hosted workflow assembles and checks it. Configuration and data are not replaced by rebuilding the application.

To run Server, PostgreSQL and Web separately:

```sh
cp .env.example .env
# Set OPENBOT_OWNER_PASSWORD to a random password of at least 15 characters.
npm run db:up
npm run dev:server
# In another terminal:
npm run dev:web
```

Open <http://localhost:5173>, configure a supported model and explicitly enable the native Agent, then create a `none`-profile Bot and a channel. Native model work does not need a Worker. Computer-backed work requires a separately enrolled Worker and executable Provider; see [Node enrollment](docs/NODE_ENROLLMENT.md) and [Provider conformance](docs/PROVIDER_CONFORMANCE.md). Container deployment is documented in [Server container](docs/SERVER_CONTAINER.md).

The website is maintained and built in [openbot-website](https://github.com/yxflc11/openbot-website); follow its README for installation, demo preparation and `npm run build`. The demo uses sample data, blocks external API requests and never connects to a model or real workspace.

## Architecture and contribution

```text
Desktop / Web -> Server -> native Agent and scoped MCP connections
                   |
                   +-> enrolled Worker -> executable Provider
                   |
                   +-> PostgreSQL, object storage and audit
```

Server is the sole authority. Models, files, webpages, skills, plugins and workers are untrusted. Tool capabilities do not confer permission. Remote deployments use trusted HTTPS, restricted allowed origins and secure cookies; database and computer backends remain private. Read [Security](SECURITY.md) and the [threat model](docs/SECURITY.md).

Start with [Contributing](CONTRIBUTING.md), the [repository map](docs/REPOSITORY_MAP.md), [current architecture](docs/ARCHITECTURE.md), [engineering audit](docs/REPOSITORY_AUDIT.md) and [open-source reuse policy](docs/OPEN_SOURCE_REUSE.md). Plugin authors can implement a standard MCP Streamable HTTP endpoint; no OpenBot-specific SDK is required. See [plugin author contract](docs/PLUGINS.md) and the website's source extension guides in [openbot-website](https://github.com/yxflc11/openbot-website) `src/content/docs`.

Employee evolution and learning are explicitly inspired by [Hermes Agent's learning graph](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/agent/learning_graph.py). OpenBot does not claim to have invented that concept. The office visualization is optional and deferred.

## License and naming

[MIT License](LICENSE). Required upstream notices are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). `OpenBot` is a working name also used by other projects; a distinct stable-release name remains a project decision. This project is not affiliated with xAI, Tencent, CopilotKit, OpenClaw or other referenced projects.
