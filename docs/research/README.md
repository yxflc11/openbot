# Feature research records

[English](README.md) · [简体中文](README.zh-CN.md)

Every behavior-changing OpenBot feature starts with evidence that maintained open-source code and
standards were considered before local implementation. This directory stores a lightweight record
when an issue or full ADR is not the better home.

Use [the template](TEMPLATE.md) before implementation. One record should cover one acceptance
journey and should remain useful after the original author leaves. The record is a decision aid,
not a star-count contest: activity, tests, platform fit, permission model, API stability, and
license compatibility matter more than popularity alone.

An issue is sufficient when it contains every template field and remains permanently linkable. Use
an ADR when the choice changes a public contract, trust boundary, persistence format, dependency,
or long-lived architecture. Tiny spelling, translation, and mechanical formatting changes do not
need a record.

Implementation may start only after the record identifies one of these decisions:

1. adopt an open standard;
2. depend on a released package or separate service;
3. write a thin adapter pinned to an upstream contract;
4. contribute the general gap upstream;
5. maintain a narrow fork with an update plan;
6. implement the precisely documented OpenBot-specific gap.

No-result research must include the date, actual queries, repositories inspected, and the gap that
made them unsuitable. It must not be used to avoid attribution or license review.

Accepted records include [Owner-managed Employee memory](owner-managed-employee-memory.md), which
attributes the evolution/memory direction to Hermes and compares Letta, Mem0, and LangMem before
selecting the existing OpenBot PostgreSQL boundary, and
[Employee profile realtime invalidation](employee-profile-realtime-invalidation.md), which reuses
the current Hono SSE transport while keeping profile content behind authenticated REST. The
[Owner skill review surface](owner-skill-review-surface.md) then maps the already-authoritative
skill lifecycle into an inspectable profile workflow without installing executable code. The
[Employee evolution archive](employee-evolution-archive.md) explicitly credits Hermes and adapts
its truthful dated-journey interaction to OpenBot's append-only Server records. The
[Owner-managed Employee profile details](owner-employee-profile-details.md) review then reuses the
existing revision mutation path and Hermes/Kubernetes conflict semantics for descriptive fields.
The [Portable Employee profile review](portable-employee-profile-review.md) closes the matching
transfer-safety gap by showing that biography inside the existing digest-bound quarantine before
activation.
