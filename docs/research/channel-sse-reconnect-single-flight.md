# Research: Channel/workspace SSE reconnect single-flight

- Status: Accepted as **defensive hardening** (not a proven production defect)
- Date: 2026-09-13
- Owner: @yxflc11
- Related issue: DEV-006 (partial / open — scene ① not proven on native EventSource)
- Acceptance journey: After disconnect, Web opens exactly one replacement EventSource and does not double-deliver channel/workspace projections
- Security boundary: Client reconnect hygiene only; Server auth, membership, cancel-tree, and RealtimeEventBuffer fail-closed overflow unchanged

## WHATWG / Chromium close() semantics

HTML Living Standard `EventSource.close()` ([dom-eventsource-close](https://html.spec.whatwg.org/multipage/server-sent-events.html#dom-eventsource-close)):

1. Abort any fetch started for this object.
2. Set `readyState` to `CLOSED`.

It does **not** queue an `error` event. Spec `error` firing is limited to **reestablish the connection** (transient) and **fail the connection** (fatal), both of which bail out if `readyState` is already `CLOSED`.

Blink (`third_party/blink/renderer/modules/eventsource/event_source.cc`):

- `close()` sets `state_ = kClosed`, stops reconnect timer, cancels loader.
- `DidFail`: if `error.IsCancellation() && state_ == kClosed`, returns without `DispatchEvent(error)`.

Headless Chromium on this Linux box (google-chrome, virtual-time probe against live `text/event-stream` and against connect-fail): `close()` did **not** increment `onerror` (`close_extra=false`).

## Production EventSource path

| Surface | EventSource implementation |
| --- | --- |
| Formal Web (`apps/web` product UI, ChannelWorkspace / App) | Native browser `new EventSource(...)` in `apps/web/src/api.ts` (`subscribeToChannelEvents` ~L614, `subscribeToWorkspaceEvents` ~L736) |
| Desktop renderer | Builds `@openbot/web` desktop bundle (`apps/desktop` `build:renderer`); Electron 44 Chromium loads that bundle — **no** JS EventSource polyfill/adapter in `apps/desktop/src` |
| Interactive demo only | `apps/web/src/demo/install.ts` replaces `window.EventSource` with `DemoEventSource`; demo `close()` sets CLOSED and disconnects — also does **not** fire `onerror` |
| Vitest only | `api.realtime-reconnect.test.ts` stubs `EventSource` with optional `fireErrorOnClose` |

**Verdict:** No production-path evidence that native `close()` re-enters `onerror`. Mock `fireErrorOnClose=true` is **not** proof of a real browser/Desktop bug.

## Fail-before / fail-after (ordering under the mock)

With the **new** test and **old** `scheduleReconnect` from `main@b78c74f` (`close()` before arming `reconnectTimer` / clearing `source`):

- `fireErrorOnClose=true` → after one error + timer advance, `MockEventSource.instances.length === 3` (initial + **two** reconnect sockets; prior live socket not closed by old `connect()`).
- `fireErrorOnClose=false` → old code **passes** (`length === 2`).

There is **no** `RangeError` / stack overflow in this fail-before path (the nested re-entry is bounded: second `close()` is a no-op once `readyState === 2`).

After the single-flight reorder (arm timer + clear `source` before `close()`, and `connect()` closes any prior socket): mock with `fireErrorOnClose=true` yields `length === 2` and one live delivery.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| HTML EventSource (browser) | Living Standard | N/A | Platform API | Already used by OpenBot Web/Desktop | Keep |
| Third-party SSE client | n/a | varies | Would add a dependency | Out of scope | Reject |

## Reuse decision

- Selected option: local gap / **defensive hardening**
- Selected upstream or standard: HTML Living Standard EventSource close/reconnect semantics
- Why keep the change: ordering is still good practice if any environment ever delivered synchronous close→error, and `connect()` closing a prior socket prevents leaks under double-timer races; not claimed as a shipped Chromium/Desktop product defect
- Exact OpenBot-specific gap (hypothetical): if `close()` synchronously invoked `onerror` while `source` still pointed at the live instance and before `reconnectTimer` was set, old order could arm two timers → two EventSources
- Upgrade, replacement, or exit plan: remain on browser EventSource; no new dependency
- Failure behavior when the upstream is missing, incompatible, or compromised: N/A (platform API)

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: n/a
- Required copyright or license notice location: n/a

## Verification plan

- Automated tests: `apps/web/src/api.realtime-reconnect.test.ts` — channel + workspace subscribers; mock may fire close→onerror; asserts single live replacement
- Fail-before evidence: new test + `api.ts` from `b78c74f` → `instances.length === 3` when `fireErrorOnClose=true`; passes when `false`
- Manual / native: Chromium headless probe on Linux — `close()` did not fire extra `onerror`
- Residual risk: native production path does not exhibit the mock hazard; DEV-006 scene ① remains unproven as a product defect; continue hunting scene ② / ③
- DEV-006 status: **not complete**; do not merge solely on this Draft
