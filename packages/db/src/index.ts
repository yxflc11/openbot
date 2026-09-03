import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10 });
  return {
    client,
    db: drizzle(client, { schema }),
    async migrate() {
      await migrate(drizzle(client, { schema }), {
        migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
      });
    },
    async close() {
      await client.end();
    },
  };
}

export * from "./schema.js";
