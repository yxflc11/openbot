# Research: Channel/workspace SSE reconnect single-flight

- Status: Accepted
- Date: 2026-09-13
- Owner: @yxflc11
- Related issue: DEV-006
- Acceptance journey: After disconnect, Web opens exactly one replacement EventSource and does not double-deliver channel/workspace projections
- Security boundary: Client reconnect hygiene only; Server auth, membership, cancel-tree, and RealtimeEventBuffer fail-closed overflow unchanged

## Search evidence

- Search date: 2026-09-13
- GitHub queries: EventSource close onerror re-entry; HTML SSE reconnect
- Standards and primary documentation queries: HTML Living Standard Server-sent events
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: docs/research/desktop-stream-lifecycle.md; apps/web/src/api.ts subscribers; RealtimeEventBuffer

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| HTML EventSource (browser) | Living Standard | N/A | Platform API | Already used by OpenBot Web | Keep |
| Third-party SSE client | n/a | varies | Would add a dependency | Out of scope for this defect | Reject |

## Reuse decision

- Selected option: local gap
- Selected upstream or standard: HTML Living Standard EventSource close/reconnect semantics
- Why this is the first viable option: OpenBot already uses EventSource; the bug is ordering inside our reconnect helper
- Exact OpenBot-specific gap: scheduleReconnect closed the socket before arming reconnectTimer, so close-driven onerror re-entered and could schedule two connect() calls; connect() did not close a prior socket
- Upgrade, replacement, or exit plan: remain on browser EventSource; no new dependency
- Failure behavior when the upstream is missing, incompatible, or compromised: N/A (platform API)

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: n/a
- Required copyright or license notice location: n/a

## Verification plan

- Automated tests: apps/web/src/api.realtime-reconnect.test.ts mocks EventSource with close→onerror and asserts a single live replacement plus one message.created delivery
- Manual checks: optional channel disconnect/reconnect in Web; not required for Draft
- Residual risk: environments that never fire onerror from close are unaffected; watchdog/onerror still share the same single-flight timer
