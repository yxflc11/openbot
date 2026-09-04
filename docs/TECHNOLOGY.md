# Technology baseline

[English](TECHNOLOGY.md) · [简体中文](TECHNOLOGY.zh-CN.md)

Reviewed on 2026-09-04. Exact versions are review snapshots and must be updated through a focused,
tested dependency change rather than silently floated.

## One-sentence decision

OpenBot uses TypeScript for its shared product code, Electron for the installable Desktop client,
React and Vite for the shared interface, Node.js for Server and portable Worker logic, PostgreSQL
for authoritative state, and narrow Swift or C# adapters only where the operating system requires
them.

## Product surfaces

| Surface | What the user installs or opens | Role |
| --- | --- | --- |
| OpenBot Desktop | The same OpenBot product, installed from the package for each Windows, macOS, or Linux platform | Always a Client; may also configure this computer as a Server, Worker Host, or both |
| OpenBot Web | The Server-hosted responsive web application | A full remote Client and the primary Client for modular self-hosters who do not install Desktop |
| OpenBot Server | A service installed by Desktop onboarding or deployed independently | The only authority for identity, channels, routing, policy, approvals, audit, and durable state |
| OpenBot Worker Host | A service installed by Desktop onboarding or deployed independently | Supplies declared computer capabilities to the Server; it never becomes a second authority |
| Agent adapters | Server-managed connections to OpenBot, Hermes, Pi, OpenClaw, or later agents | Perform bounded delegated work; they cannot grant themselves a channel, computer, credential, or approval |
| Plugins | Reviewed packages installed through a future capability-scoped plugin system | May extend UI, themes, channels, agents, tools, providers, and automation without bypassing Server policy |

Desktop onboarding presents four compositions of the same product:

1. **Use OpenBot:** Client only, connected to an existing Server.
2. **Use and work:** Client plus Worker Host on this computer.
3. **Host OpenBot:** Client plus Server, with Worker Host optional.
4. **Advanced self-host:** install Server and Worker services independently, then use Web or Desktop.

An onboarding answer such as “I will add five computers” creates a five-device setup checklist. It
is not a license limit and it does not produce a different application. Every Worker computer can
still be used as a normal OpenBot Client.

## Selected languages and runtimes

| Boundary | Selection | Why |
| --- | --- | --- |
| Shared domain, protocol, Server, Worker, adapters, and tooling | TypeScript `7.0.2` | One typed language already covers the repository and is the lowest-friction contribution path. |
| Standalone development runtime | Node.js `24.20.0` LTS | It is the current LTS reviewed on 2026-09-04; Current releases are not the production default. |
| Desktop shell | Electron `44.2.0` | It reuses the existing web stack and ships one tested Chromium/Node baseline across desktop systems. |
| Desktop packaging and hardening | `@electron/packager` `20.3.0` and `@electron/fuses` `2.1.3` | Current stable Electron packages provide the narrow package/ASAR and strict fuse APIs OpenBot needs without Forge 7's incompatible and vulnerable development graph. Installers, signing, and publishing remain separately reviewed release adapters. |
| Shared UI | React `19.2.8` and Vite `8.2.2` | These exact versions are already locked, built, and tested in this repository. |
| Server HTTP runtime | Hono on Node.js | The current Server, security middleware, SSE, and shutdown behavior already use and test this boundary. |
| Authoritative persistence | PostgreSQL 17 | Existing migrations, conditional transitions, scheduling, approvals, and audit require one transactional source of truth. |
| macOS-only service integration | Swift | Use only for Keychain, Service Management, signing-aware registration, and other Apple-only contracts. |
| Windows-only service integration | C# on .NET | Use only for SCM, Credential Manager, Job Objects, installer integration, and other Windows-only contracts. |
| External agent internals | Upstream language | Hermes may remain Python and another agent may use Rust, Go, or TypeScript; OpenBot integrates through a typed process or network adapter. |

Python, Rust, and Go are not OpenBot core languages. A future dependency may introduce one only
after research proves that a maintained upstream closes a concrete gap better than the selected
stack.

The already attested Worker Host release runtime remains Node.js `22.22.2` until a separate release
migration regenerates hashes, SBOMs, notices, packages, conformance evidence, and rollback data.
Choosing Node.js 24 for new development does not silently rewrite existing release evidence.

## Desktop security contract

The Desktop application is a trusted local client, not a replacement authority:

- it packages local renderer assets instead of loading executable UI code from a Server;
- every renderer uses `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`;
- the preload bridge exposes small typed operations, never raw `ipcRenderer`, filesystem, shell,
  process, environment, or unrestricted network primitives;
- the main process validates the sender, schema, size, state, and authority for every IPC request;
- navigation, new windows, permissions, downloads, and external URL opening deny by default;
- a restrictive Content Security Policy permits only packaged application code and declared Server
  connections;
- Server, Worker Host, external Agent, and plugin actions remain subject to Server policy and
  approval even when Desktop starts their local processes;
- secrets stay in the platform key store or a dedicated service boundary, never renderer state or
  browser local storage;
- packaging disables unused Electron fuses, verifies ASAR integrity, and signs before release;
- unsigned local builds are development evidence only and cannot be described as distributable.

Untrusted webpages used by an Agent run inside a Worker Provider boundary. They are never rendered
inside the privileged OpenBot Desktop window.

## “Best current” policy

“Best” means the newest stable or LTS release that satisfies OpenBot's compatibility, security,
maintenance, contributor, and evidence requirements. It does not mean automatically selecting a
prerelease or changing every dependency on publication day.

- Check Node.js LTS and supported Electron majors at least monthly and before every Desktop release.
- Apply supported-line Electron security patches through an expedited, tested pull request.
- Review a new Electron major before the current major becomes the oldest supported line.
- Keep every dependency exact in the lockfile; no release build may resolve a floating version.
- Re-run packaging, IPC-negative, update, rollback, and real-device checks after a runtime change.
- Reconsider the shell only if measured package size, memory, accessibility, security maintenance,
  or platform behavior fails an accepted requirement.

## Contributor impact

Most contributors need only the Node.js LTS pinned in `.nvmrc` and npm. Desktop contributors also need the
platform packaging toolchain. Swift is required only for macOS adapter work, and .NET only for
Windows adapter work. External Agent adapters do not require contributors to rewrite those agents
in TypeScript.

The durable decision and candidate evidence are recorded in
[ADR-0041](decisions/0041-desktop-application-foundation.md) and the
[Desktop foundation research](research/desktop-application-foundation.md).
