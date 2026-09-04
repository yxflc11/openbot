# Research: Employee profile realtime invalidation

- Status: Accepted
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: #
- Acceptance journey: An Owner changes an Employee's skills or memory on one connected device and
  another connected OpenBot Client refreshes that same Employee profile without a manual reload.
- Security boundary: The Server remains authoritative. The event carries only an Employee id,
  bounded section names, and a Server timestamp; memory text, evidence, credentials, authority, and
  imported package contents never enter the realtime stream. A dropped or malformed event causes a
  fresh authenticated profile read rather than a partial local write.

## Search evidence

- Search date: 2026-09-04
- GitHub queries:
  - `hermes-agent task_events live event socket completed blocked notification`
  - `letta SSE agent memory update event`
  - `hono SSE streamSSE reconnect event id`
  - `kubernetes client-go watch resourceVersion reconnect snapshot watch`
- Standards and primary documentation queries:
  - Hono `streamSSE` framing, event names, ids, and patched CR/LF validation;
  - Kubernetes list/watch and `RetryWatcher` snapshot-recovery behavior.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - ADR-0006, `ChannelRealtimeEvent`, `WorkspaceRealtimeEvent`,
    `RealtimeEventBuffer`, the Web reconnect watchdog, and the realtime overload row in
    `docs/OPEN_SOURCE_REUSE.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Hermes Agent task events and live drawer refresh | [`63279301`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d) | MIT | Active project with event-ledger and dashboard coverage | Strong product evidence for invalidating an open detail view after a typed event; its Python/SQLite/WebSocket implementation is not an OpenBot control-plane fit | Adopt the behavior and attribution, not source |
| Hono SSE helper | [`4.13.5` / `e2740d5a`](https://github.com/honojs/hono/tree/e2740d5a1bd0b4254e517e3af8b60789284bc7bd) | MIT | Released, already pinned, upstream tests; version is newer than the 4.12.4 SSE control-field security fix | Exact fit for the existing authenticated, bounded Server-to-Client stream | Reuse existing dependency |
| Kubernetes list/watch recovery | [`client-go v0.35.1`](https://github.com/kubernetes/client-go/tree/v0.35.1) | Apache-2.0 | Maintained release train with watch/retry tests | Strong reference for treating a fresh list as authority after missed/expired events; importing Go client code would be inappropriate | Adopt recovery invariant only |
| Letta agent SSE | [`0.16.7` / `f3332476`](https://github.com/letta-ai/letta/tree/f33324768950e6752f80d6c725873cc92d22f8b2) | Apache-2.0 | Maintained, broad streaming coverage | Streams model step output and memory-aware execution; too broad and may expose content that this invalidation path must omit | Reject for this boundary |

## Reuse decision

- Selected option: released dependency plus OpenBot-specific local gap
- Selected upstream or standard: existing Hono 4.13.5 SSE transport; Hermes typed UI refresh
  behavior; Kubernetes authoritative snapshot recovery invariant.
- Why this is the first viable option: OpenBot already has a tested, bounded workspace SSE hub and
  Web reconnect watchdog. Adding another broker, WebSocket stack, or agent event protocol would
  duplicate transport and create a second state authority.
- Exact OpenBot-specific gap: publish one content-free `employee.profile.changed` invalidation only
  after a Server-owned Employee mutation commits, then reload the selected profile through its
  authenticated REST aggregate.
- Upgrade, replacement, or exit plan: keep the event payload transport-neutral. A future shared
  event bus may replace the in-process hub without changing the public event or profile endpoint.
- Failure behavior when the upstream is missing, incompatible, or compromised: the Client retains
  explicit reload and reconnect snapshot recovery; mutation responses remain authoritative for the
  initiating device. The Server fails its pinned dependency checks rather than falling back to an
  unbounded stream.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: no upstream source is copied; only documented behavior is applied
  to OpenBot's existing domain union, Hono route callbacks, and React subscriber.
- Required copyright or license notice location: existing dependency lockfile and project notices
  remain sufficient.

## Verification plan

- Automated tests: domain/type checks; workspace hub delivery; authenticated SSE frames; every
  Employee mutation route publishes the expected bounded section set; Web parser accepts only the
  strict event shape.
- Negative and fail-closed tests: malformed, unknown, duplicated, or content-bearing fields are not
  used as profile state; missed events reconcile through `workspace.ready` plus REST.
- Platforms and devices: transport is browser/HTTP based and independent of Worker Host OS. The
  current evidence covers the existing Web Client and single Server process, not native clients or
  multi-Server delivery.
- User-visible documentation and translations: update the English API/Employee documents and their
  Simplified Chinese translations.
- Support level that the evidence permits: authenticated same-Server multi-device profile refresh.

## Unresolved questions

- Durable replay and multi-Server ordering require a separate review of PostgreSQL `LISTEN/NOTIFY`,
  Redis Streams, NATS, or another shared log.
- Native-client background notifications are outside this invalidation event and need a separate
  permission and privacy design.
