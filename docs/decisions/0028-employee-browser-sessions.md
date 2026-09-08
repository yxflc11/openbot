# ADR-0028: Server-owned employee browser sessions

- Status: Accepted
- Date: 2026-09-08

## Context

The Owner needs to watch and operate an employee's persistent Worker browser from any Web client.
The current Provider returns one screenshot; it does not expose a browser supervision surface.

## Upstream review

See [research and exact pins](../research/employee-browser.md). The selected MIT-licensed
CopilotKit/OpenBot agent-computer supplies persistent profiles and human-input endpoints. Its
single human-holder flag does not identify an OpenBot Client. RFC 6455 and the existing `ws`
transport supply the outbound channel, not application authorization.

## Reuse decision

Extend the existing thin Provider adapter. Local code implements only the OpenBot session,
authority, audit, relay and Web UI gap. Do not create a browser engine or adopt a desktop shell.

## Source incorporation

Runtime source is fetched unmodified. The build recipe is adapted from the upstream MIT Dockerfile and retains its attribution; the image includes `/app/licenses/CopilotKit-OpenBot.LICENSE`.

## Verification plan

Run negative tests for ownership, expiry, replay, concurrent control, unknown commands, disconnect,
backend failures and missing audit. Exercise a synthetic form in the real pinned browser, then
desktop/mobile UI and `npm run check`. Keep the old read-only path working.

## Decision

- Add `browser.session@1` and capability-gated `browser.command`/`browser.result` messages to the
  existing protocol. Old Nodes never receive these messages; no existing message shape changes.
- Authenticated Owner sessions open Server-issued view sessions. Routing follows the employee's
  `docker-linux` execution profile and prefers the already used Worker; unavailable bound Workers
  are reported rather than silently switching an employee's account state.
- At most one view session controls an employee at a time. Control expires without automatic
  Agent resumption; a new takeover and explicit return are required after an abandoned session.
- The Server serializes each employee's browser requests. The Node consumes request IDs once,
  enforces deadlines, validates replies and serializes backend operations with existing Run work.
- Every human mutation writes an intent event before transport and an outcome event afterwards.
  Audit stores employee/Node/action/request identity, not URL query strings or typed contents.
- Screenshots travel only through the authenticated Server, refresh while the panel is visible,
  and are not stored as conversation artifacts. Inputs are never exposed as model messages.
- Browser state is on the Worker and is not included in employee template exports.

## Consequences

This delivers a built-in remote browser without changing the Web-first product boundary. PNG
polling is deliberately bounded and is not video. Autonomous interaction, signed automated
approval leases, downloads and full tab management remain separate acceptance journeys. Browser
process/profile isolation does not substitute for OS/container/network isolation.

Build inputs additionally reviewed: [Bun 1.4.2](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2) (MIT; upstream integration ran this version), the Playwright 1.62.1 OCI digest recorded in the Dockerfile, and the SHA-256 of the exact upstream archive. The local recipe preserves the MIT license in the image and pins Bun; apt repositories and the installer script remain mutable build inputs.
