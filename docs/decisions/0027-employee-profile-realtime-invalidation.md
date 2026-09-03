# ADR-0027: Employee profile changes use content-free realtime invalidation

## Status

Accepted on 2026-09-04.

## Context

OpenBot Clients can remain connected from several devices while an Owner edits an Employee's
skills or memory. Mutation responses update the initiating Client, but another Client can keep a
stale profile until a manual reload. Broadcasting a full profile would copy private memory and
evidence into the workspace event stream and would turn a transient projection into another source
of truth.

The required upstream comparison is recorded in
[the research record](../research/employee-profile-realtime-invalidation.md).

## Upstream review

- Hermes Agent `63279301` (MIT) demonstrates typed task events that invalidate an open detail
  drawer and reload durable state.
- Hono `4.13.5` / `e2740d5a` (MIT) is already pinned and supplies the tested SSE framing used by the
  workspace stream, including the upstream control-field injection fix.
- Kubernetes client-go `v0.35.1` (Apache-2.0) demonstrates that a new authoritative list is the
  recovery path when a watch cannot replay every change.
- Letta `0.16.7` (Apache-2.0) was rejected here because its model-step stream is broader than a
  private profile invalidation and would not preserve OpenBot's minimal payload boundary.

Exact source locations, queries, maintenance evidence, and licenses are recorded in the linked
research record.

## Reuse decision

Reuse OpenBot's existing pinned Hono transport, bounded workspace hub, and authenticated profile
endpoint. Adopt the upstream invalidation and authoritative-reload behaviors, but implement only
the OpenBot-specific content-free Employee event. Do not add another event framework or copy
upstream code.

## Decision

After a committed Employee mutation, the Server publishes `employee.profile.changed` through the
existing bounded workspace SSE hub. The payload contains exactly:

- the Employee/Bot id;
- an allowlisted, non-empty set of changed profile sections;
- a Server timestamp.

The event is an invalidation hint, not state. It never contains memory text, skill evidence,
package data, credentials, authority, or a model-generated summary. A Client viewing that Employee
reloads the authenticated aggregate endpoint. On `workspace.ready` after reconnect, the Client also
reloads the selected profile, which recovers changes missed while disconnected.

The event is emitted only after store success. Failed validation, stale revisions, and replayed
imports do not announce a new state. The existing 128-event subscriber bound and abort-on-overflow
policy continue to apply.

## Verification plan

- HTTP tests prove successful create, import, skill, and memory mutations publish the exact section
  set, while rejected mutations and idempotent import replay do not.
- An SSE integration test proves the public event name and id while asserting the frame contains no
  profile content.
- Web tests prove only exact, non-empty, unique, allowlisted section arrays are accepted and reject
  any content-bearing extension.
- Typecheck, complete repository tests/build, and English/Chinese documentation checks run before
  commit.

## Consequences

- Multiple connected Web Clients converge without sharing private profile content through SSE.
- REST and PostgreSQL remain authoritative; event loss is recoverable.
- A mutation may cause an additional aggregate read on each Client currently viewing the Employee.
- The current in-process hub provides no durable replay or multi-Server ordering. Those deployments
  still require a reviewed shared event bus.

## Source incorporation

No upstream source is copied or substantially adapted. OpenBot reuses its pinned Hono dependency
and existing local realtime hub; Hermes and Kubernetes inform product and recovery behavior only.
