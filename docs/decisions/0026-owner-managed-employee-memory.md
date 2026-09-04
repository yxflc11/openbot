# ADR-0026: Keep Employee memory Owner-managed and Server-audited

- Status: Accepted
- Date: 2026-09-04

## Context

The Employee profile can display typed memories, but no supported command creates, edits, or
deletes them. The user needs a useful personal profile while preserving the central rule that an
Employee package does not silently carry private history. Models, external memory services, and
Worker Hosts must not become an authority over Employee memory.

Memory content can be private, stale, poisoned, or concurrently edited. A safe first lifecycle
therefore needs bounded Owner commands, stale-write protection, content erasure, and an audit trail
that does not retain the very content an Owner deleted.

## Upstream review

The exact repositories, commits, releases, licenses, source locations, maintenance evidence, and
rejected integration choices are recorded in
[the research note](../research/owner-managed-employee-memory.md).

- Hermes Agent `63279301` (MIT) provides the direct inspiration: bounded visible entries,
  add/replace/remove operations, a memory/skill learning graph, promptware scanning, and a separate
  provider contract.
- Letta `0.16.7` (Apache-2.0) confirms that manual memory editing must be a first-class API action.
- Mem0 Node SDK `ts-v3.0.5` (Apache-2.0) confirms stable memory IDs and lifecycle history.
- LangMem `f8c7ebd6` (MIT) provides a maintained typed-memory reference and keeps automatic deletion
  disabled by default.
- PostgreSQL, Drizzle, Zod, Hono, and React are already pinned OpenBot dependencies. They cover the
  needed storage, transaction, validation, HTTP, and UI mechanics.

## Reuse decision

Reuse the existing OpenBot PostgreSQL store and dependencies. Adopt upstream lifecycle behavior,
but do not add another memory runtime or copy its source: it would create a second persistence and
authority plane. Implement only the missing OpenBot-specific command, revision, audit, and profile
editing layer.

## Source incorporation

No upstream source is copied or substantially adapted. Product and safety behaviors are attributed
in the research note, Employee specification, and reuse ledger. No additional notices are required.

## Verification plan

- Protocol tests prove strict bounds and prevent clients from requesting immediate package
  inclusion.
- Store and HTTP tests prove atomic audit, optimistic concurrency, ownership isolation, deletion,
  credential-value blocking, and content-free events.
- A disposable PostgreSQL database applies every migration and runs the lifecycle end to end.
- The existing Employee profile receives an accessible inline editor and explicit second-step
  delete confirmation, followed by the repository's normal Web tests and build.
- Canonical English documentation and matching Simplified Chinese documents describe exactly what
  is implemented and what remains unsafe or planned.

## Decision

1. `employee_memories` gains a monotonically increasing integer `revision`, beginning at `1`.
2. The authenticated Owner may create a memory with a bounded title and content, a declared type,
   sensitivity, and portability of `never` or `owner-selectable`.
3. No command may set `included`. The v1 Employee package continues to contain zero memories.
4. Updates and deletion require the current `expectedRevision`. A stale revision changes nothing
   and returns conflict.
5. `secret-reference` records always use `restricted` sensitivity and `never` portability. Their
   content is a reference, never a credential value.
6. Titles and content reuse the credential/private-key scanner already applied to Employee export.
   Local-only memories may still contain machine-local paths.
7. Every mutation writes an immutable `employee_memory_events` row in the same transaction. The
   row stores the Employee ID, memory ID, action, revision, changed field names, actor, and time;
   it never stores title, content, provenance, or content hashes.
8. Deletion physically removes the memory content while preserving the content-free lifecycle
   event. The UI requires a distinct confirmation action.
9. This API is Owner-only. Models and Worker Hosts cannot call it, and autonomous writes remain
   disabled until a separate proposal/review lifecycle exists.
10. Future memory Providers may retrieve or propose records through an adapter. They never own
   Employee identity, authorization, portability, or the Owner audit trail.

## Consequences

Owners can correct or erase what an Employee remembers, and concurrent tabs cannot silently
overwrite one another. Deletion remains auditable without retaining deleted private text. The
Server gains one small table and an extra profile projection. Automatic learning, retrieval,
prompt injection into execution context, memory version restoration, and selective transfer are
intentionally not solved by this decision.
