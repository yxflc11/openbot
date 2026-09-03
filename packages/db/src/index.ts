import { fileURLToPath } from "node:url";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.js";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
// The two-key namespace is stable across processes and reserved for OpenBot schema migration work.
const migrationLockNamespace = 0x4f50454e;
const migrationLockId = 0x424f5401;

export interface AppliedMigration {
  hash: string;
  createdAt: number;
}

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10 });
  return {
    client,
    db: drizzle(client, { schema }),
    async migrate() {
      await migrateDatabase(url);
    },
    async close() {
      await client.end();
    },
  };
}

/**
 * Reject a migration journal or database history that is not an exact prefix of the repository.
 * Drizzle uses a high-water timestamp, so this check prevents a drifted row from silently skipping
 * a pending migration.
 */
export function assertMigrationHistory(
  expected: readonly Pick<MigrationMeta, "folderMillis" | "hash">[],
  applied: readonly AppliedMigration[],
  requireComplete = false,
): void {
  for (let index = 0; index < expected.length; index += 1) {
    const current = expected[index];
    const previous = expected[index - 1];
    if (current === undefined) continue;
    if (previous !== undefined && current.folderMillis <= previous.folderMillis) {
      throw new Error(
        `Migration journal timestamps are not strictly increasing at index ${index}.`,
      );
    }
  }

  if (applied.length > expected.length) {
    throw new Error("Database migration history is ahead of this OpenBot build.");
  }

  for (let index = 0; index < applied.length; index += 1) {
    const actual = applied[index];
    const planned = expected[index];
    if (
      actual === undefined ||
      planned === undefined ||
      actual.createdAt !== planned.folderMillis ||
      actual.hash !== planned.hash
    ) {
      throw new Error(`Database migration history diverges from the repository at index ${index}.`);
    }
  }

  if (requireComplete && applied.length !== expected.length) {
    throw new Error(
      `Database migration history is incomplete: expected ${expected.length}, found ${applied.length}.`,
    );
  }
}

async function migrateDatabase(url: string): Promise<void> {
  // Drizzle's Postgres.js adapter requires a dedicated max-one connection for migrations.
  const migrationClient = postgres(url, { max: 1, max_lifetime: null });
  let locked = false;
  try {
    await migrationClient`select pg_advisory_lock(${migrationLockNamespace}, ${migrationLockId})`;
    locked = true;
    const expected = readMigrationFiles({ migrationsFolder });
    assertMigrationHistory(expected, await readAppliedMigrations(migrationClient));
    await migrate(drizzle(migrationClient), { migrationsFolder });
    assertMigrationHistory(expected, await readAppliedMigrations(migrationClient), true);
  } finally {
    try {
      if (locked) {
        await migrationClient`select pg_advisory_unlock(${migrationLockNamespace}, ${migrationLockId})`;
      }
    } finally {
      await migrationClient.end();
    }
  }
}

async function readAppliedMigrations(connection: postgres.Sql): Promise<AppliedMigration[]> {
  const relation = await connection<Array<{ name: string | null }>>`
    select to_regclass('drizzle.__drizzle_migrations')::text as name
  `;
  if (relation[0]?.name === null || relation[0]?.name === undefined) return [];

  const rows = await connection<Array<{ createdAt: string; hash: string }>>`
    select hash, created_at::text as "createdAt"
    from drizzle.__drizzle_migrations
    order by created_at asc, id asc
  `;
  return rows.map((row) => ({ hash: row.hash, createdAt: Number(row.createdAt) }));
}

export * from "./schema.js";
