# Research: Desktop application and language foundation

- Status: Accepted design; packaging adapter corrected after implementation validation
- Date: 2026-09-04
- Owner: OpenBot maintainers
- Related issue: Technology-baseline phase in `docs/ROADMAP.md`
- Acceptance journey: A user installs the same OpenBot Desktop application on one or more
  computers, signs in to one Server, uses the full Client on every computer, and optionally enables
  Server or Worker Host roles through guided setup without creating a second source of truth.
- Security boundary: Desktop may manage its own window, local preferences, notifications, and
  explicitly selected local service lifecycle. The Server alone owns identity, authorization,
  routing, approvals, audit, and durable product state. Renderer, plugins, external Agents,
  webpages, and Worker Hosts are untrusted. Missing signatures, invalid IPC, incompatible runtime,
  or uncertain authority fails closed.

## Search evidence

- Search date: 2026-09-04.
- GitHub queries: `electron electron release 44.2.0`, `electron forge release 7.11.2`,
  `electron packager release 20.3.0`, `electron fuses release 2.1.3`, Forge issues `4048` and
  `4240`, `tauri release 2.11.5`, `wails release 2.14.0`, and each repository's source, release
  history, tests, issues, security surface, platform support, and license.
- Standards and primary documentation queries: Node.js release status and v22-to-v24 migration;
  Electron process model, release support, security checklist, context isolation, sandbox, fuses,
  code signing, updating, Packager, ASAR integrity, strict fuses, and Forge packaging; Tauri process
  model, capabilities, permissions, signing, and distribution; Wails platform and WebView
  requirements; Playwright Electron support. The icon follow-up checked Packager 20.3.0's installed
  `icon` implementation and official Options documentation: macOS consumes `.icns`, Windows
  consumes `.ico`, and Linux requires a PNG supplied to `BrowserWindow`.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `AGENTS.md`, ADR-0004,
  ADR-0016, ADR-0035 through ADR-0040, `docs/ARCHITECTURE.md`, `docs/CROSS_PLATFORM.md`,
  `docs/PRODUCT.md`, `docs/ROADMAP.md`, both reuse ledgers, every workspace package manifest, the
  Node release scripts, the macOS Swift Host, and the Windows .NET Host.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Electron | [`v44.2.0`](https://github.com/electron/electron/releases/tag/v44.2.0), released 2026-09-04 with Node.js 24.20.0 and Chromium 152.0.7977.76 | MIT | Active release train, large automated test suite, public issues and security policy. Only the latest three stable majors are supported, with an eight-week major cadence. | Embeds one Chromium/Node baseline and directly reuses TypeScript/React/Vite. Its main process is highly privileged, so local assets, sandboxed renderers, typed IPC, fuses, signing, and fast upgrades are mandatory. | Select as the Desktop runtime. |
| Electron Packager | [`v20.3.0`](https://github.com/electron/packager/releases/tag/v20.3.0), commit `8c5cc94` | BSD-2-Clause | Current stable signed release reviewed on 2026-09-04; maintained source, tests, issues, and a 2026 release series that replaced vulnerable `extract-zip`, added Electron 44 gates, and added ASAR integrity digest handling. | Provides the exact platform bundle and ASAR boundary required through one small API. Signing, installers, and publishing can remain later explicit adapters instead of entering the first shell. | Select as the packaging dependency. |
| Electron Fuses | [`v2.1.3`](https://github.com/electron/fuses/releases/tag/v2.1.3), commit `00f2479` | MIT | Current stable signed release; maintained source, tests, strict all-fuse mode, and support for every Electron 44 fuse including `WasmTrapHandlers`. | Can hard-fail packaging when Electron adds an unknown fuse and can verify the written binary state before signing. | Select as the package-hardening dependency. |
| Electron Forge | [`v7.11.2`](https://github.com/electron/forge/releases/tag/v7.11.2), commit `f2a3ec8` | MIT | Current stable release, but issue [#4048](https://github.com/electron/forge/issues/4048) confirms its fuse plugin is incompatible with Fuses 2.x and marks the fix as waiting for Forge 8. The direct trial's full npm audit reported 29 advisories: 1 critical, 21 high, 4 moderate, and 3 low, led by `tar`, `extract-zip`, `@electron/rebuild`, and `tmp`. | Pinning Fuses 1.8.0 resolves the peer range but cannot name every Electron 44 fuse; selecting Forge 8 would violate the stable-only baseline. Its makers, publishing, and signing breadth are unnecessary for the first secure shell. | Reject Forge 7; re-evaluate a stable Forge 8 only if later release needs justify its wider graph. |
| Tauri | [`tauri-v2.11.5`](https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.11.5), commit `7cd7136` | Apache-2.0 and MIT | Active signed releases, tests, issues, capability schemas, and RustSec audit output. The reviewed release visibly reports multiple unmaintained transitive GTK-era crates. | Strong capability model and smaller bundles, but adds Rust to the core path and uses WebView2, WKWebView, or WebKitGTK depending on the OS. That increases toolchain and rendering variance for a product already centered on TypeScript. | Reject for the first Desktop implementation; retain as a future measured alternative. |
| Wails | [`v2.14.0`](https://github.com/wailsapp/wails/releases/tag/v2.14.0), commit `857398f` | MIT | Maintained stable v2 release with source, tests, issues, and cross-platform documentation; v3 is still beta. | Reuses React/Vite but adds Go and OS WebViews. Windows has an explicit WebView2 runtime dependency and Linux adds GTK/WebKit packaging requirements. OpenBot has no existing Go boundary. | Reject for the first Desktop implementation. |
| Browser-only PWA | Current OpenBot Web application | OpenBot MIT | Existing tests and deployment path already work and remain supported. | Excellent remote and modular self-hosting Client, but cannot by itself provide one guided signed installer, durable background services, platform key stores, or native permission onboarding. | Keep as a full Client, not as the only product shell. |
| Separate native UI per OS | SwiftUI, WinUI, and a Linux toolkit | Platform/toolkit terms | Mature platform tools but three separate UI implementations and contributor paths. | Best access to native APIs, but duplicates the shared channel UI and creates inconsistent product behavior. | Reject; keep Swift and C# as narrow service adapters. |

Node.js [`24.20.0`](https://nodejs.org/en/blog/release/v24.20.0) is the latest LTS reviewed on
2026-09-04. Node.js 26 is Current, not LTS. Electron 44.2.0 embeds the same Node.js 24.20.0 release.
The root package already accepts Node.js 24.15 or newer, while existing release artifacts remain
bound to their separately attested Node.js 22.22.2 runtime.

Playwright [`v1.62.1`](https://github.com/microsoft/playwright/releases/tag/v1.62.1) was reviewed for
future Desktop smoke tests. Its Electron automation API remains explicitly experimental and does
not intercept native dialogs. It is not selected as a dependency in this design-only change;
renderer unit tests and main-process contract tests must remain the primary gate, with any later
Playwright lane treated as additional evidence.

The implementation trial also compared the resolved dependency graphs with the same repository
lockfile. Replacing Forge 7.11.2 with Packager 20.3.0 and Fuses 2.1.3 reduced the full audit to the
repository's four pre-existing moderate Drizzle Studio/esbuild advisories, with zero high or
critical advisories. This is development-tool evidence, not a claim that npm audit alone proves a
safe release.

## Reuse decision

- Selected option: released dependencies followed by a narrow OpenBot adapter.
- Selected upstream or standard: Electron 44.2.0, Electron Packager 20.3.0, Electron Fuses 2.1.3,
  Electron's process and security contracts, Node.js 24.20.0 LTS, and the repository's existing
  TypeScript/React/Vite packages.
- Why this is the first viable option: no open standard defines an installable cross-platform app
  shell. Electron is the first released dependency that can deliver one consistent Desktop Client
  without adding Rust or Go or duplicating the UI per operating system.
- Exact OpenBot-specific gap: a small main process, a typed preload API, a narrow direct packaging
  adapter, role-aware onboarding, local service status/control adapters, Server connection
  management, and release gates that preserve Server authority.
- Upgrade, replacement, or exit plan: follow every supported Electron security patch, review each
  major before the selected line becomes the oldest supported line, and measure size, memory,
  accessibility, startup, and platform behavior. A later Tauri or native-shell migration remains
  possible because the renderer and Server protocol stay shell-independent.
- Failure behavior when the upstream is missing, incompatible, or compromised: do not build,
  package, update, start optional services, or claim platform support. Never disable sandboxing,
  load remote executable UI, expose raw IPC, float to a prerelease, or fall back to unsigned release
  artifacts.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: this change records architecture and public upstream contracts only.
  The later implementation will use published Electron, Packager, and Fuses packages through their
  APIs.
- Brand asset provenance: `apps/desktop/resources/openbot-icon.png` was generated for OpenBot from
  the maintainer-approved composable Bot design, then reviewed with a stronger low-contrast module
  pattern. The `.icns` and `.ico` files are deterministic format exports of that same master; no
  third-party logo or source artwork was copied.
- Required copyright or license notice location: when dependencies are incorporated, preserve their
  licenses and generated production notices in `THIRD_PARTY_NOTICES.md` and each release artifact.

## Verification plan

- Automated tests: exact dependency and Electron-version assertions; main/preload/renderer contract
  tests; strict IPC schema, sender, size, lifecycle, navigation, permission, and external-URL tests;
  shared Web/Desktop UI tests; packaging inventory, fuse, ASAR, checksum, SBOM, and update metadata
  tests.
- Negative and fail-closed tests: remote executable content, raw Electron API access, unrecognized
  IPC, malformed Server URL, credential exposure, arbitrary process launch, plugin authority,
  unsigned updates, rollback mismatch, missing service permissions, and Server-unavailable setup.
- Platforms and devices: portable contract tests on Linux x64, Windows x64, and macOS arm64; signed
  install, first-run, update, rollback, key-store, service lifecycle, notification, accessibility,
  and uninstall journeys on controlled real devices before a support claim.
- User-visible documentation and translations: maintain `docs/TECHNOLOGY.md` and
  `docs/TECHNOLOGY.zh-CN.md` together; update Desktop onboarding and release documentation in both
  languages as implementation proceeds.
- Support level that the evidence permits: architecture selected. No Desktop platform is Supported
  or Certified until the corresponding signed artifact and real-device matrix passes.

## Unresolved questions

- The Owner must later approve release identities, signing accounts, update-channel authority, and
  the exact macOS/Windows/Linux launch sequence before public distribution.
- Linux Desktop packaging format and supported distribution set require a separate release review.
- The plugin renderer/sandbox contract and external Agent process protocol require separate research
  before implementation.
