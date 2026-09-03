# ADR-0022: Fail closed on PostgreSQL migration drift

- Status: Accepted
- Date: 2026-09-04

## Context

The Server applied migrations through the same ten-connection Postgres.js pool used for application
queries. It did not serialize concurrent Server starts, compare recorded hashes with repository SQL,
or prove after migration that every journal entry was applied. A stale or manually repaired Drizzle
high-water timestamp could therefore skip a pending migration while startup appeared successful.

The repository journal itself also lacked a check for duplicate prefixes, missing SQL files, extra
SQL files, and non-monotonic timestamps. Backup and restore remained an undocumented promise.

## Upstream review

- [Drizzle ORM 0.45.2 `e7dfa145`](https://github.com/drizzle-team/drizzle-orm/tree/e7dfa14519f363229ccc3ead7b1b2f2051937efb)
  (Apache-2.0) explicitly requires a separate `max: 1` Postgres.js migration client. Its current
  PostgreSQL dialect records a SQL hash and journal timestamp, then selects only the latest
  `created_at` value before applying later entries.
- Drizzle issues [#5769](https://github.com/drizzle-team/drizzle-orm/issues/5769) and
  [#5774](https://github.com/drizzle-team/drizzle-orm/issues/5774) document, respectively,
  high-water timestamps silently skipping work and stale journals causing filename collisions.
  Drizzle's [migration process proposal](https://github.com/drizzle-team/drizzle-orm/discussions/2624)
  lists a proper concurrent migration lock as future work.
- [Postgres.js 3.4.9](https://github.com/porsager/postgres/tree/v3.4.9) (Unlicense) exposes the
  required one-connection pool, explicit `.end()`, and a `null` maximum connection lifetime.
- [PostgreSQL 17 `ec3f6a6a`](https://github.com/postgres/postgres/tree/ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1)
  (PostgreSQL License) supplies database-scoped session advisory locks and the authoritative
  `pg_dump` / `pg_restore` recovery tools.
- [Docker Official Image source `2603e26e`](https://github.com/docker-library/postgres/tree/2603e26e245e558218728ee14e0a42dcb020dc7f)
  (MIT plus PostgreSQL components) publishes PostgreSQL 17.11 for amd64 and arm64. Debian bookworm
  is selected because the Alpine 3.23 variant has an open Apple Silicon crash report.
- GitHub's maintained PostgreSQL service-container guidance was reviewed for the real-database CI
  shape. It uses an Ubuntu runner, explicit credentials, a published PostgreSQL image, and
  `pg_isready` health checks.

## Reuse decision

Keep Drizzle's released migrator and Postgres.js driver. Configure the adapter exactly as upstream
requires, then add only OpenBot's missing safety boundary: a stable PostgreSQL advisory lock and an
exact-prefix history check before and after Drizzle runs.

Use PostgreSQL's own dump and restore programs for recovery. Do not add a JavaScript backup format,
a second migration framework, or a long-lived fork of Drizzle. Track the upstream migration work
and remove local guards only after a compatible release proves equivalent behavior.

## Source incorporation

No upstream source or documentation was copied or substantially adapted. OpenBot calls published
APIs and PostgreSQL functions; all behavior and attribution are recorded here and in the reuse
ledger.

## Verification plan

- Unit tests cover valid prefixes, SQL hash drift, high-water timestamp drift, non-monotonic
  journals, and databases ahead of the checked-out build.
- A repository check compares journal indexes, timestamps, tags, and the exact SQL filename set.
- A GitHub Actions PostgreSQL service runs two migrations concurrently against an empty test
  database and then repeats startup.
- Local verification uses a disposable `_test` database and never modifies migration history to
  make a failed check pass.
- Backup acceptance requires restoring both PostgreSQL and file artifacts into an isolated test
  deployment; listing an archive alone is not recovery evidence.

## Decision

1. Migration SQL is append-only. Journal indexes and filename prefixes are contiguous, timestamps
   strictly increase, and every SQL file has exactly one journal entry.
2. Server startup uses a dedicated Postgres.js client with one non-expiring connection. It obtains
   a database-scoped advisory lock before reading or applying migration state.
3. Applied database records must be an exact hash-and-timestamp prefix of the repository plan.
   Startup fails before changes on divergence and verifies a complete plan afterward.
4. The business query pool is created separately and cannot execute work until migration succeeds.
5. CI uses a real PostgreSQL 17 service to exercise concurrent first startup and idempotent repeat
   startup. The verification script refuses any database name that does not end in `_test`.
6. The supported Docker baseline is `postgres:17.11-bookworm`; upgrades are explicit changes with
   backup and restore evidence.
7. Operators use native `pg_dump` and `pg_restore`, keep encrypted off-host copies, and restore into
   an isolated database before relying on a backup. Artifact binaries are backed up separately
   while Server writes are quiesced.

## Consequences

- A changed historical migration, stale journal, wrong branch, or manually edited migration table
  now stops startup instead of producing an unknown schema.
- Concurrent Server starts serialize schema ownership even though OpenBot remains a single-active-
  Server product at this milestone.
- Startup opens one temporary database connection in addition to the business pool and may wait for
  another migrator.
- Existing development databases with genuine hash drift require investigation or recreation;
  OpenBot will not rewrite their history automatically.
- Point-in-time recovery, scheduled encrypted backups, retention enforcement, and full database plus
  artifact restore automation remain future operations work.
