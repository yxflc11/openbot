const databaseUrl = process.env.OPENBOT_DATABASE_URL;
if (databaseUrl === undefined) throw new Error("OPENBOT_DATABASE_URL is required.");

const parsedUrl = new URL(databaseUrl);
const databaseName = parsedUrl.pathname.slice(1);
if (!databaseName.endsWith("_test")) {
  throw new Error("Database verification refuses to run unless the database name ends with _test.");
}

const { createDatabase } = await import("../packages/db/dist/index.js");
const first = createDatabase(databaseUrl);
const second = createDatabase(databaseUrl);
try {
  // Separate startup attempts must serialize migration ownership and converge on one complete plan.
  await Promise.all([first.migrate(), second.migrate()]);
  await first.migrate();
  const [result] = await first.client`
    select count(*)::text as migrations
    from drizzle.__drizzle_migrations
  `;
  if (result === undefined || Number(result.migrations) === 0) {
    throw new Error("Database verification found no applied migrations.");
  }
  console.info(`Database verification passed with ${result.migrations} applied migrations.`);
} finally {
  await Promise.allSettled([first.close(), second.close()]);
}
