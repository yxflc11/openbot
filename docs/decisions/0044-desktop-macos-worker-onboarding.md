# ADR-0044: Desktop guides macOS Worker setup through a signed companion

- Status: Accepted
- Date: 2026-09-05

## Context

The setup-plan slice lets a user choose a local Worker and plan several computers, but it correctly
performs no service effect. OpenBot already has one reviewed macOS Worker Host that owns Keychain,
enrollment, LaunchAgent registration, and fixed-child supervision. Requiring the user to install
that app separately would preserve security but contradict the accepted experience: install the
same OpenBot Desktop on each computer, select its role, and follow one guided configuration.

Full candidate, standards, maintenance, issue, license, and security evidence is recorded in the
[Desktop macOS Worker onboarding research](../research/desktop-macos-worker-onboarding.md).

## Upstream review

Apple macOS 13+ `SMAppService` explicitly supports helper executables and LaunchAgent property lists
inside an app bundle. Electron `44.2.0` and Electron Packager `20.3.0` expose a main-process network
boundary, fixed resource path, and extra-resource hooks without giving the renderer raw filesystem
or process access. The existing OpenBot companion at commit `8252ea4` already implements the
accepted Node `22.22.2`, Keychain, launchd, registration, package, and validation contracts.
Electron utility processes, renderer token handling, the separately installed controller as the
primary flow, and XState `5.31.1` do not close this exact lifecycle gap. The research record contains
the detailed comparison.

## Reuse decision

Refactor and extend the existing OpenBot Swift Worker Host rather than create another Worker,
service supervisor, key store, or enrollment protocol. Package it as an independently signed nested
companion with its current bundle id and access group. Add only a bounded native control envelope,
one main-process adapter, and shared-UI status flow. Add no runtime dependency.

## Decision

- A macOS Desktop package may contain exactly one `OpenBot Worker Host.app` below its fixed
  resources directory. The nested bundle preserves `com.openbot.worker-host`, its manifest,
  app-bundled LaunchAgent, Node runtime, Keychain access group, and independent inside-out signature.
- The companion adds one noninteractive `--desktop-control` mode. It reads one bounded exact JSON
  request from stdin and emits one bounded allowlisted JSON result to stdout. No secret is accepted
  through argv, environment, a URL, or a file.
- Desktop exposes only local Worker status, setup, enable, and Login Items settings operations over
  its typed bridge. The exact top-frame sender, setup plan, connection, schema, and operation state
  are validated again in the main process.
- Setup receives only a Node id from the renderer. The main process uses the dedicated authenticated
  Desktop Session to ask the configured Server for a ten-minute single-use enrollment token. It
  never returns the token to the renderer and sends it directly to the fixed companion over stdin.
- The companion derives no Server and mints no identity. Desktop converts only the already
  confirmed HTTP(S) Server origin into the corresponding WS(S) `/ws/nodes` URL; the Server issues
  the token and the companion redeems it through the existing endpoint.
- Native setup preserves the accepted order: exchange token, write and reread the Server-bound
  device-only Keychain envelope, write and reread public config, then register the fixed
  LaunchAgent. Partial failure returns a generic state and grants no capability.
- Desktop persists no `installed`, `enrolled`, `enabled`, or `supported` flag. On restart and after
  every action it asks the fixed companion for actual state. Missing, linked, tampered, timed-out,
  oversized, malformed, or unauthorized companion behavior fails closed.
- `requires-approval` is not success. The shared UI explains the required Login Items decision and
  may ask the native companion to open the first-party settings panel. Only a later status read can
  report `enabled`.
- The initial production adapter is macOS only. Windows and Linux display an honest unavailable
  state until separately reviewed adapters consume their existing service/install boundaries.
- Unsigned hosted and local packages are development evidence only. Distribution still requires
  the existing Developer ID, provisioning, entitlement, notarization, Gatekeeper, and controlled
  standard-user lifecycle gates.

## Source incorporation

No Apple sample, Electron example, Electron Packager hook, or XState source, test, or template is
copied or substantially adapted. Existing OpenBot Swift/TypeScript code is extended in place.
Existing third-party notices remain sufficient; no dependency or notice is added.

## Verification plan

Swift tests cover native protocol parsing, exact action ordering, status projection, token
disposal, and failure closure. TypeScript tests cover plan/authentication/connection gating, token
issuance without renderer exposure, exact helper process policy, bounded output, timeout, and bridge
projection. Package tests require the nested companion inventory on the macOS opt-in build and
forbid it elsewhere. Hosted Linux, Windows, and macOS jobs remain required, but only a signed
controlled macOS device can prove real Keychain, approval, login/reboot, and lifecycle behavior.

## Consequences

The primary macOS journey becomes one top-level OpenBot Desktop installation and one guided setup,
while the platform-sensitive Worker remains a narrow independently signed component. The renderer
cannot retrieve a Node bootstrap secret or start an arbitrary executable, and service state cannot
drift into a local UI flag.

This decision deliberately does not implement Server/PostgreSQL bootstrap, Windows/Linux Desktop
service adapters, signing credentials, publication, or a support claim. Those remain later Owner
checkpoints rather than implicit authority from this ADR.
