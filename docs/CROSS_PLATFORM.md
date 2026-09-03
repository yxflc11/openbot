# Cross-platform Worker Hosts

[English](CROSS_PLATFORM.md) · [简体中文](CROSS_PLATFORM.zh-CN.md)

## Product decision

The Mac mini is OpenBot's first practical Worker Host, not the product boundary. A Worker Host is a
computer or managed runtime whose granted browser, application, file, shell, screen, and input
capabilities an employee may use. Windows, macOS, and Linux hosts must participate through the same
Server-authorized protocol.

Clients direct and supervise employees from other devices. They do not inherit the host's
credentials and cannot bypass the Server to control a Node.

```text
Web / PWA / companion clients
             |
       HTTPS / realtime
             v
OpenBot Server + PostgreSQL
             ^
      outbound WSS / mTLS
             |
Windows | macOS | Linux | containers | VMs | managed mobile devices
                         Worker Hosts
```

## Three meanings of platform support

| Surface | Responsibility | Initial support strategy |
| --- | --- | --- |
| Server host | Channels, employee identity, policy, routing, audit, and persistence | One production Linux OCI image on x64 and arm64; run it on Linux, NAS, cloud, macOS, or Windows container hosts |
| Worker Host | Native execution capabilities | A native Node daemon plus narrow platform Providers |
| Client | Commands, observation, approval, and takeover | Responsive Web/PWA first; optional companion shells later |

Supporting the Server on an operating system does not imply that OpenBot can control that system's
native desktop. Each native Provider has a separate support level and threat model.

## Planned support matrix

| Platform or device | Server | Node | Native computer control | Target level |
| --- | --- | --- | --- | --- |
| Linux x64/arm64 | Production | Production | Browser, shell, files; desktop later | Certified first |
| NAS with containers | Production | Optional | Container workloads | Supported |
| Windows x64/arm64 | Container/WSL compatibility | Native service | Browser, PowerShell, UI Automation | Supported |
| macOS arm64/x64 | Development/compatible | Native launchd service | Browser, Cua/Accessibility, Lume on Apple Silicon | Supported |
| Cloud VM | Production Linux image | Linux/coder Node | Headless workloads | Supported |
| Android managed device | No | Managed-device bridge | UI Automator/ADB under explicit device-owner policy | Experimental |
| iPhone/iPad | No | Companion only initially | Approval, notification, viewing, and explicit system integrations | Companion |
| Raspberry Pi/edge Linux | Optional | Lightweight arm64 Node | Shell, files, approved device adapters | Experimental |
| GPU workstation | Optional | Compute/coder Node | Model, media, and batch providers | Experimental |

## Structured host identity

Protocol `0.9.0` already declares:

- operating system and version;
- CPU architecture;
- device class: server, desktop, mobile, VM, container, or edge;
- isolation class: dedicated host, user session, VM, container, or managed device;
- trust tier, capacity, temporary legacy aliases, and versioned Provider capability descriptors.

Provider package versions, screen/input transports, supported policy profiles, health details, and
update channels remain planned. The handshake is an execution claim, not an authorization grant.

The current channel bounds enrollment and messages, verifies ping/pong liveness, and keeps Run
assignments Server-owned. A short-lived one-time token creates one individually revocable Node
credential; the Server stores only digests. The credential is still a copyable bearer value, so
proof of possession, native keyring storage, mTLS, rotation, and replay protection remain planned;
see [ADR-0023](decisions/0023-one-time-node-enrollment.md).

Bot configuration should select a capability policy, not an OS enum. It may optionally pin an
employee to a specific host, but the model cannot change that pin or select another host.

## Capability naming

Capabilities use stable names and major versions, for example:

```text
browser.observe@1
browser.input@1
desktop.observe@1
desktop.input@1
shell.execute@1
filesystem.read@1
filesystem.write@1
computer.takeover@1
```

Provider availability describes possibility; a Server policy and a Run-scoped lease provide
authority. Advertising `desktop.input@1` never authorizes arbitrary input by itself.

Run offers now require exact capability majors. Server routing and the Worker Host both reject
missing or incompatible versions; a legacy alias never provides a fallback. See
[Provider conformance](PROVIDER_CONFORMANCE.md) for the executable matrix and honest support
levels.

## Provider layout

```text
providers/
  browser-playwright/     portable browser semantics
  docker/                 isolated Linux browser and workspace
  shell/                  constrained command execution
  windows-uia/            Windows UI Automation
  macos-cua/              macOS Accessibility/Cua
  macos-lume/             isolated macOS VM
  linux-desktop/          accessibility desktop adapter
  android-uiautomator/    managed Android device adapter
  coder/                  isolated coding runtimes
```

The layout is a target, not a claim that these Providers already work. Each Provider reaches
`experimental`, `supported`, and `certified` only after passing the published conformance and real
device tests.

## Cross-platform constraints

- The browser Provider is the first interactive Provider because DOM, URL, and form semantics are
  safer than raw pixels and portable across host systems.
- Windows, macOS, and Linux native desktop Providers share prepare/approve/commit semantics but do
  not pretend their accessibility APIs are identical.
- Linux desktop certification follows browser and shell support because desktop behavior differs
  across display servers and environments.
- Android support is limited to owner-managed or explicitly enrolled devices.
- iOS starts as a companion surface. General unattended control is not a V1 promise.
- A Worker Host account is dedicated to employees and must not reuse an owner's primary browser,
  password store, or system administrator session.

## Packaging targets

| Target | Package |
| --- | --- |
| Server | Multi-architecture OCI image and Docker Compose |
| Linux Node | Signed archive, systemd unit, then deb/rpm packages |
| Windows Node | Signed installer and Windows Service |
| macOS Node | Signed/notarized package and launchd service |
| Android bridge | Signed companion/bridge package for managed devices |

All releases publish checksums, dependency notices, SBOMs, protocol compatibility, and an explicit
support tier. Production deployments consume immutable versions rather than `main`.

## Acceptance journey

The cross-platform beta passes when a user can run the Server on Linux/NAS/cloud, open a channel
from a phone, assign a task to an employee, have the Server select an authorized Windows, macOS, or
Linux Worker Host, approve a frozen side effect, observe or take over the Run, and retain the same
employee identity and history after replacing the Host.
