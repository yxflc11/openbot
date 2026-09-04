# ADR-0041: Desktop uses Electron while Server remains the only authority

- Status: Accepted
- Date: 2026-09-04

## Context

OpenBot needs a Grok Bot-like installable Desktop application, guided setup for one or many
computers, a complete Web Client for remote and modular self-hosting use, and future adapters for
external Agents and plugins. The repository already implements its Server, Web Client, portable
Worker, domain, and protocol primarily in TypeScript with React/Vite, plus narrow Swift and .NET
Worker Host boundaries.

The Desktop application must not merge Client convenience with Server authority. Installing the
same application on five computers must allow each computer to remain a full Client while the user
optionally enables Server or Worker roles. Models, renderer content, plugins, Agents, webpages, and
Worker Hosts remain untrusted.

Full evidence is recorded in the
[Desktop application foundation research](../research/desktop-application-foundation.md).

## Upstream review

Electron `44.2.0` (MIT), `@electron/packager` `20.3.0` (BSD-2-Clause), `@electron/fuses` `2.1.3`
(MIT), rejected Electron Forge `7.11.2` (MIT), Tauri `2.11.5` (Apache-2.0/MIT), Wails `2.14.0`
(MIT), Node.js `24.20.0` LTS, Playwright `1.62.1`, the existing browser-only PWA, and separate
native UIs were reviewed. Their exact releases, maintenance, tests, issues, platform requirements,
security behavior, and licenses are in the research record.

Electron is maintained on an eight-week major cadence and supports only the latest three stable
majors. Its official security guidance requires current releases, isolated and sandboxed renderers,
limited navigation and window creation, restrictive CSP, validated IPC senders, careful external
URL handling, and no privileged remote content. Those requirements are part of this decision, not
optional hardening.

## Reuse decision

Use the released Electron runtime, Electron Packager, and Electron Fuses behind a narrow local
adapter. No open standard provides a desktop shell. Forge 7.11.2 is not viable with Electron 44:
its fuse plugin requires the older Fuses 1.x API, which cannot name every Electron 44 fuse, while
its resolved development graph has unresolved high and critical advisories. Forge 8 contains the
upstream compatibility work but remains a prerelease. Tauri and Wails are viable released
alternatives, but both introduce a new core language and different OS WebViews. Separate native UIs
duplicate the product surface. Direct Packager/Fuses is therefore the first stable viable option
for the current TypeScript/React/Vite system.

OpenBot adds only its missing typed bridge, role-aware onboarding, service control, Server
connection, and security/release gates. It does not fork Electron or build another shell.

## Source incorporation

No Electron, Packager, Fuses, Forge, Tauri, Wails, or Playwright source, tests, templates, or
configuration are copied or substantially adapted in this decision. Published dependencies will be
incorporated only in the implementation pull request, with exact lockfile entries and required
notices.

## Verification plan

Unit and integration tests must prove the main/preload/renderer split, strict IPC, deny-by-default
navigation and permissions, shared UI behavior, and Server-only authority. Packaging tests must
inspect exact contents, fuses, ASAR integrity, checksums, SBOMs, signatures, update metadata, and
rollback behavior. Controlled real devices must prove installation, first run, role setup, key-store
access, service lifecycle, accessibility, update, rollback, and uninstall before any platform moves
from Declared or Integrated to Supported.

## Decision

- Add one `apps/desktop` Electron application written in TypeScript.
- Pin Electron `44.2.0`, `@electron/packager` `20.3.0`, and `@electron/fuses` `2.1.3` when
  implementation begins. Do not add Forge 7.11.2 or substitute prerelease Forge 8 in the release
  path.
- Use the existing React/Vite interface as packaged local renderer content. Web and Desktop share
  product components and Server APIs but remain independently deployable Clients.
- Desktop is always a Client. Guided setup may additionally install or configure Server and Worker
  Host roles on the same computer.
- The “number of computers” onboarding answer drives a setup checklist only; it is not a license or
  capability limit.
- Bundle no remote executable UI. Use sandboxed, context-isolated renderers without Node integration
  and expose only a small typed preload contract.
- The Electron main process may perform Desktop-local lifecycle operations, but it cannot authorize
  a task, grant a capability, approve an action, mutate audit history, or become a durable product
  truth source.
- Server-controlled external Agent adapters and future plugins remain separate untrusted
  boundaries. Neither receives Electron APIs by default.
- Use Node.js `24.20.0` LTS for new standalone development and Desktop-aligned tooling. Keep existing
  Node.js `22.22.2` Worker release evidence unchanged until a dedicated migration regenerates it.
- Keep TypeScript as the core language. Keep Swift and C# as narrow OS adapters. Do not introduce
  Python, Rust, or Go into OpenBot core without a new evidence-backed decision.
- Treat exact versions as reviewed pins, not permanent numbers. Security patches and major support
  transitions require focused review, tests, and release evidence.

## Consequences

Most contributors retain one Node/npm/TypeScript workflow, and the Desktop can share the existing
channel UI instead of creating three interfaces. Users get one application whose installation mode
changes roles without making Worker computers second-class Clients. Modular self-hosters keep the
full Web Client and independent service deployment.

Electron increases download size and memory use and transfers Chromium/Node patch responsibility to
OpenBot. The project must maintain an explicit rapid-upgrade lane and signed platform releases.
Desktop selection alone proves no platform support. Plugin isolation, external Agent delegation,
Linux packaging, signing authority, and update publication remain separately gated phases.
