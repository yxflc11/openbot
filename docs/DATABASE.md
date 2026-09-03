# Database operations

[English](DATABASE.md) · [简体中文](DATABASE.zh-CN.md)

OpenBot keeps channels, employees, Runs, approvals, audit records, sessions, and artifact metadata
in PostgreSQL. Artifact bytes live in a separate object directory. A usable recovery set needs both.

## Migration contract

- Never edit an applied migration. Add a new numbered SQL file and journal entry.
- `npm run migrations:check` verifies the repository journal and SQL file set.
- Server startup takes a PostgreSQL advisory lock, checks that database history is an exact prefix
  of the repository, applies pending Drizzle migrations, and verifies the complete result.
- Hash, timestamp, missing-entry, or ahead-of-build drift stops startup. Do not repair the Drizzle
  table by hand to bypass the check.
- `npm run db:verify` intentionally runs only against a database whose name ends in `_test`. It
  exercises concurrent and repeated migration startup.

For important data, investigate drift against the deployed release and restore a verified backup.
For a disposable local database, recreate it only after confirming that no data is needed.

## Backup boundary

Quiesce Server writes before capturing a complete recovery set. PostgreSQL `pg_dump` gives a
consistent database snapshot, but it cannot coordinate with artifact files being written in a
different volume.

1. Stop the OpenBot Server while leaving PostgreSQL running.
2. Create a PostgreSQL custom-format archive with `pg_dump --format=custom --no-owner
   --no-privileges`.
3. Snapshot the configured `OPENBOT_OBJECT_STORE_PATH` or its volume while Server remains stopped.
4. Record the OpenBot release, PostgreSQL major version, migration count, checksums, and capture
   time beside the two artifacts.
5. Encrypt the recovery set and copy it off the Server host. Never commit it to Git.
6. Restart Server and confirm health.

`pg_restore --list backup.dump` proves that PostgreSQL can read the archive catalog. It does not
prove that the backup is restorable or that its paired artifact snapshot is complete.

## Restore drill

Restore rehearsals must use an isolated database and artifact directory, never the live target.

1. Create an empty database whose name ends in `_test`.
2. Restore with `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges`.
3. Point a non-production OpenBot build at the restored database and isolated artifact copy.
4. Run `npm run db:verify`, then inspect representative channels, employees, Runs, approvals, audit
   entries, and downloaded artifacts.
5. Record the duration and result before deleting the isolated environment.

For production recovery, restore into a new empty database and object directory, verify it, then
switch the deployment. Do not restore over a running OpenBot database.

## Current limits

- OpenBot does not yet schedule, encrypt, upload, retain, or prune backups.
- There is no point-in-time recovery or WAL archiving workflow.
- The local object store has no transactional snapshot protocol with PostgreSQL.
- Backup credentials and storage-provider integrations are intentionally not part of Employee
  packages or Worker Hosts.

These gaps remain M6 work. Contributions should start with an upstream review and prove a complete
database-plus-artifact restore, not only successful archive creation.
