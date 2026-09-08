# Research: Built-in employee browser

- Status: Accepted for implementation; platform certification remains separate
- Date: 2026-09-08
- Owner: @yxflc11
- Related issue: Owner request in the current development task
- Acceptance journey: Open an employee's browser from the Web client, watch its remote page,
  acquire exclusive control, navigate/click/type/scroll, and return control without discarding login state.
- Security boundary: Server owns employee-to-Node routing, authenticated view sessions, exclusive
  control, and content-free audit. The Node accepts bounded, expiring, single-use commands only on
  its authenticated outbound connection. Browser pages, Providers, and model output are untrusted.

## Search evidence

- Search date: 2026-09-08.
- GitHub queries: `CopilotKit/openbot agent-computer control.test`,
  `microsoft/playwright v1.63.0 browserContext`, `microsoft/playwright-mcp v0.0.80`.
- Standards/docs: [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455),
  [Playwright actionability](https://playwright.dev/docs/actionability),
  [Electron embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds),
  [Chrome debugging profiles](https://developer.chrome.com/blog/remote-debugging-port).
- Existing entries: ADR-0010, OPEN_SOURCE_REUSE.md browser-computer and Provider SDK rows,
  PRODUCT.md journeys A/B, ROADMAP.md M2, CROSS_PLATFORM.md, current Docker Provider and Run Inspector.
- Downloaded the pinned upstream archive and inspected `agent-computer/src/index.ts`, `profiles.ts`,
  `control.ts`, `tests/control.test.ts`, `tests/authorisation.test.ts`, `package.json`, Dockerfile,
  and the root MIT license. Open issues include the keyboard/clipboard report
  [#424](https://github.com/CopilotKit/openbot/issues/424); the listing was available but the full
  issue body could not be fetched. This is a validation target, not proof of a reproduced defect.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| CopilotKit/OpenBot agent-computer | `257c1280d684089be9adb0b35cce262efc7064bf` | MIT | Existing pinned baseline; control, viewer and authorization tests; open interaction issues | Playwright 1.62.1, persistent employee profiles, screenshot and human-input HTTP endpoints; token protects backend, Server must own policy | Extend the existing thin adapter |
| Playwright | `v1.63.0` / `1b025d7` | Apache-2.0 | Released September 4; extensive upstream browser suite | Good portable runtime primitives but duplicates existing backend integration | Replacement candidate if a demonstrated upstream gap requires it |
| Playwright MCP | `v0.0.80` / `4c1fb03` | Apache-2.0 | Released September 1; release notes cover reconnect, profiles, sandbox and screenshots | Tool transport, explicitly not an authorization/security boundary; adds another service layer | Not required for the human browser surface |
| RFC 6455 | RFC 6455 | IETF Trust | Existing OpenBot ws implementation and connection tests | Existing authenticated outbound Node connection carries commands; no new public Worker port | Reuse |

## Reuse decision

- Selected option: existing separate service and thin adapter; standard WebSocket transport.
- Selected upstream: pinned agent-computer above. No fork or new browser engine.
- Exact local gap: Server-issued browser sessions and routing, per-viewer control ownership and
  expiry, per-employee serialization with existing Runs, bounded command/reply transport,
  content-free durable audit, and the Web supervision/input panel. Upstream's `holder: human`
  alone cannot distinguish two OpenBot clients and is not sufficient authority.
- Commands are not arbitrary URLs/endpoints, JavaScript, shell, files, or model tools. Human input
  is explicitly authorized by the Owner's current control session. Existing automated approval
  semantics are not silently upgraded into a general capability lease.
- Screenshots refresh with bounded demand-driven polling using the existing PNG path. This gives
  continuous observation without claiming video-rate streaming or exporting raw CDP to Clients.
- Upgrade/exit: keep the upstream commit and browser version aligned; replace only the Provider
  adapter after conformance and real-browser tests. Missing/incompatible backend fails visibly.
- On uncertainty, expired control or disconnect, refuse further input. Never replay an uncertain
  click/type request automatically or silently resume Agent input into a half-edited page.

## Source incorporation

- Runtime source copied or substantially adapted: no. The container build recipe is adapted from the upstream MIT Dockerfile. Calls target the upstream HTTP contract.
- Upstream source stays in its separately built runtime; its archive retains LICENSE. Distribution
  must retain that MIT license and Playwright/Chromium notices. This record is not a license audit
  of every transitive browser binary.

## Verification plan

- Protocol tests: malformed/oversized inputs and replies, expiry and replay rejection.
- Server tests: Owner/session binding, unavailable/mismatched Nodes, exclusive takeover, no input
  without control, content-free audit before mutation, disconnect and timeout cleanup.
- Provider/Node tests: endpoint allowlist, private URL refusal, per-employee serialization,
  input refusal during takeover/expiry, stale commands, backend response validation.
- Integration: real pinned runtime and a synthetic form; click, Unicode/paste, scroll, navigation,
  control return, persistent state and independent employee sessions.
- Web QA: desktop/mobile panel, empty/loading/error state, polling cleanup and actual interactions.
- Run `npm run check`; maintain English and Chinese user documentation.
- Evidence permits only tested platforms. No claim of full M2 automation, general desktop control,
  universal site login compatibility, or unrestricted production account support.

## Unresolved questions

- Video-rate transport, downloads, arbitrary tab management, and autonomous multi-step model
  interaction remain separate acceptance journeys; the current feature exposes the real browser
  through explicit human supervision and the existing read-only task path.

Build inputs additionally reviewed: [Bun 1.4.2](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2) (MIT; upstream integration ran this version), the Playwright 1.62.1 OCI digest recorded in the Dockerfile, and the SHA-256 of the exact upstream archive. The local recipe preserves the MIT license in the image and pins Bun; apt repositories and the installer script remain mutable build inputs.
