# Research: Server-owned recurring tasks

- Status: Accepted for a bounded first implementation
- Date: 2026-09-05
- Owner: OpenBot contributors
- Acceptance journey: An authenticated Owner creates an interval schedule for a channel and Bot, pauses/resumes/deletes it, and observes its next run and previous submission in the existing channel.
- Security boundary: Only Server/PostgreSQL can schedule or submit work. Each submission enters the existing routing, Run, approval, and audit path. A schedule is not an approval or capability grant.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `timgit/pg-boss releases scheduling cron singleton`, `node-cron/node-cron releases noOverlap`, and open scheduling issues in both repositories.
- Primary documentation: PostgreSQL 17 SELECT locking, timestamp arithmetic, and Node timers. Existing pinned PostgreSQL 17 source review `ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1` remains applicable; no database runtime upgrade is part of this change.
- Existing entries checked: reuse ledger “Multi-Server scheduling and event distribution” (partial), Server authority, task routing, bounded shutdown, and Desktop channel workspace. This review completes only recurring task submission; it does not claim multi-Server dispatch or realtime support.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL row locks and atomic transactions | PostgreSQL 17 / `ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1`; existing Drizzle 0.45.2 and Postgres.js 3.4.9 | PostgreSQL; Apache-2.0; Unlicense | Existing database migration and Run transactions; PostgreSQL documents queue-like uses of `FOR UPDATE SKIP LOCKED` | A due-row claim, source Message, Run, audit event, and next timestamp can commit together in the existing authoritative database | Selected standard/database mechanism, with a thin OpenBot adapter |
| [pg-boss](https://github.com/timgit/pg-boss/tree/12.26.0) | 12.26.0 / release `31a4cf0093b0df73d077782689b738bcd0292021` | MIT | Inspected release, `src/timekeeper.ts`, `test/scheduleTest.ts`, LICENSE, issue [773](https://github.com/timgit/pg-boss/issues/773), and singleton discussion 285 | Maintained durable queue with schema management and cron; would create a second job state machine and require adapting existing Drizzle task transactions, retries, and ownership | Viable for future general queue replacement; unnecessary after the first viable PostgreSQL mechanism |
| [node-cron](https://github.com/node-cron/node-cron/tree/v4.6.0) | v4.6.0 / release `0be2ca03ffebc79fa823081b8a44bff6f731a583` | ISC | Inspected scheduler runner, `src/scheduler/runner.test.ts` and `runner-unref.test.ts`, LICENSE, releases and DST issue [518](https://github.com/node-cron/node-cron/issues/518); recent fixes cover gaps and long timer drift | Runs on the Server Node runtime, but its timer/overlap controls do not atomically create an existing OpenBot Run with database schedule advancement | Not selected; fixed elapsed intervals require no cron parser or timezone calendar engine |

## Reuse decision

- Selected option: standard plus thin adapter. Reuse PostgreSQL transactions/row locks, the existing strict Zod request boundary, and the exact existing task-submission function inside the same database transaction.
- First viable option: database row locks already satisfy durable, duplicate-free task insertion and bounded interval advancement before introducing a second queue dependency.
- Exact local gap: Owner CRUD, an elapsed-minute recurrence record, a bounded due-row transaction, and lifecycle polling that publishes committed Runs through the existing dispatcher. Polling has no authority outside persisted records.
- Boundaries: at most 50 schedules; 15–10,080 minute intervals; first occurrence in the next 366 days; name 80 characters and prompt 8,000 characters. One submitted Run per schedule may be active. A late scheduler submits at most one occurrence, then advances directly past downtime. Resume advances an expired occurrence into the future. No cron expressions, shell commands, external URLs, automatic approvals, or “run now” endpoint.
- Daily/weekly presets mean elapsed 24 hours / 7 days; they do not promise wall-clock recurrence across daylight-saving transitions. The first timestamp is an explicit UTC instant supplied by the client after local-time conversion.
- Failure behavior: database errors roll back both claim and task insertion. Missing membership pauses the schedule with a stable outcome. An unfinished previous Run skips that occurrence. HTTP stops accepting requests immediately at shutdown; scheduler drain is bounded to five seconds before dispatcher/database shutdown. PostgreSQL transaction, statement, and lock timeouts are set, and the existing Postgres.js `end({ timeout: 5 })` terminates outstanding connections after grace. Committed but unpublished Runs recover on dispatcher restart. No work runs while the Server is off, and the existing execution engine's capability limits remain.
- Replacement plan: migrate recurrence records into a reviewed durable queue only when general calendar recurrence or multi-Server dispatch becomes a milestone. Do not silently change fixed-interval semantics.

## Source incorporation

- Source copied or substantially adapted: no.
- Required notices: no added dependencies; existing PostgreSQL, Drizzle, and Postgres.js notices remain.

## Verification plan

- Pure interval and input-boundary tests; scheduler coalescing, errors, and stop/drain tests.
- Owner authentication and Origin enforcement; unknown/oversized fields rejected.
- Real isolated PostgreSQL test: competing claimers, transaction rollback, restart persistence, missed periods, overlap skip, pause/resume, missing membership, and audit link.
- No live Worker or external provider executes a test schedule.
- User documentation and Chinese translation describe availability, fixed intervals, and approval boundaries.

## Primary references

- [PostgreSQL 17 SELECT locking](https://www.postgresql.org/docs/17/sql-select.html)
- [PostgreSQL 17 date/time operators](https://www.postgresql.org/docs/17/functions-datetime.html)
- [Node.js timers](https://nodejs.org/docs/latest-v22.x/api/timers.html)

## Unresolved questions

- Calendar/timezone recurrence and full multi-Server dispatch remain outside this bounded implementation.

## Verification results

- Server typecheck and 41 unit/API tests pass (including a streamed oversized request without Content-Length and a stalled database pool during shutdown).
- Six real PostgreSQL 17 integration cases pass in a disposable loopback cluster with no Worker attached. Tests cover competing claimers, transaction rollback, overlap, pause/resume/delete, membership, a concurrent 50-schedule limit, and the unchanged interactive route.
- No npm dependency or upstream source was added.
