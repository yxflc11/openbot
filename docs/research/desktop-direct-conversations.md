# Research: Server-owned direct Bot conversations

- Status: Accepted for implementation
- Date: 2026-09-09
- Owner: @yxflc11
- Acceptance journey: clicking a Bot repeatedly or concurrently reopens the same persistent conversation; messages remain assigned to that exact Bot.
- Security boundary: authenticated Owner mutation and trusted Origin remain required. The Server assigns `directBotId`, creates fixed membership, and rejects membership changes; names and descriptions carry no authority.

## Search evidence

- GitHub queries: `drizzle-team drizzle-orm 0.45.2 onConflictDoNothing`.
- Primary documentation query: `site.postgresql.org docs 17 INSERT ON CONFLICT unique index row lock`.
- Reviewed existing Channel/ChannelBot/message/run store, the PostgreSQL migration-integrity and Channel-first Desktop inspector entries in `OPEN_SOURCE_REUSE.md`, and the existing authenticated channel routes.
- PostgreSQL 17 [INSERT](https://www.postgresql.org/docs/17/sql-insert.html) and [row locks](https://www.postgresql.org/docs/17/explicit-locking.html): unique constraints are database-enforced; a Bot row lock can serialize creation without a process-local mutex.
- Drizzle [releases](https://github.com/drizzle-team/drizzle-orm/releases) and issue [#2474](https://github.com/drizzle-team/drizzle-orm/issues/2474): `DO NOTHING RETURNING` does not return an existing row. Avoid interpreting an empty return as a missing entity.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Existing PostgreSQL and Drizzle transaction adapter | PostgreSQL 17 `ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1`; Drizzle 0.45.2 `e7dfa14519f363229ccc3ead7b1b2f2051937efb`; Postgres.js 3.4.9 | PostgreSQL License; Apache-2.0; Unlicense | Released dependencies already pinned and migration/concurrency-tested in this repository; relevant upstream RETURNING issue reviewed | Server stores one nullable FK plus unique index, locks existing Bot before create, preserves current message/run APIs on every client platform | Selected standard + thin adapter |
| Dedicated external messaging service | None added | N/A | Not evaluated for introduction because existing transaction primitive is viable | Would duplicate current identity, routing and audit authority | Unnecessary |

## Reuse decision

Reuse the maintained existing database stack. The narrow OpenBot-specific gap is the mapping from one Bot identity to one fixed-membership Channel. Normal Channel names retain uniqueness independently of direct conversations. A missing Bot returns not-found; mismatched Bot selection and all direct membership joins fail closed. PostgreSQL protects singleton creation across Server processes. No new dependency or upstream code is copied or substantially adapted.

## Verification plan

Authenticated/origin-negative API tests; idempotent direct selection, fixed membership and exact-ID routing; dedicated disposable PostgreSQL integration test for concurrent creation, audit uniqueness, persistence across store instances and name collisions. Run repository checks before handoff. This proves Server API behavior; desktop native support remains subject to the parent platform build and UI verification.

## Verified evidence

- Server and domain/database builds passed.
- All 41 Server API tests and 3 migration-history unit tests passed.
- The dedicated PostgreSQL test passed against an isolated local embedded PostgreSQL fixture: 12 parallel opens through 2 database clients returned one Channel and exactly one creation audit; persistence, fixed membership, routing, rename stability and normal-name uniqueness passed.
