import { randomUUID } from "node:crypto";

const databaseUrl = process.env.OPENBOT_DATABASE_URL;
if (databaseUrl === undefined) throw new Error("OPENBOT_DATABASE_URL is required.");

const parsedUrl = new URL(databaseUrl);
const databaseName = parsedUrl.pathname.slice(1);
if (!databaseName.endsWith("_test")) {
  throw new Error("Database verification refuses to run unless the database name ends with _test.");
}

const { createDatabase } = await import("../packages/db/dist/index.js");
const { NodeIdentityService } = await import("../apps/server/dist/node-identity.js");
const { PostgresNodeIdentityStore } = await import(
  "../apps/server/dist/postgres-node-identity-store.js"
);
const first = createDatabase(databaseUrl);
const second = createDatabase(databaseUrl);
const verificationNodeId = `db-verification-${randomUUID()}`;
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
  const identity = new NodeIdentityService(new PostgresNodeIdentityStore(first.db));
  // Concurrent Owner requests serialize per Node: both calls complete, and only the later active
  // token can be consumed.
  const issuedTokens = await Promise.all([
    identity.issueEnrollmentToken({ nodeId: verificationNodeId, expiresInSeconds: 60 }),
    identity.issueEnrollmentToken({ nodeId: verificationNodeId, expiresInSeconds: 60 }),
  ]);
  const exchanges = await Promise.allSettled([
    ...issuedTokens.map((issued) =>
      identity.enroll({ nodeId: verificationNodeId, token: issued.token }),
    ),
    ...issuedTokens.map((issued) =>
      identity.enroll({ nodeId: verificationNodeId, token: issued.token }),
    ),
  ]);
  const successful = exchanges.filter((item) => item.status === "fulfilled");
  if (successful.length !== 1) {
    throw new Error("Concurrent Node enrollment did not consume its token exactly once.");
  }
  const enrolled = successful[0].value;
  if (!(await identity.authenticate(verificationNodeId, enrolled.credential))) {
    throw new Error("Issued Node credential did not authenticate.");
  }
  const listed = (await identity.list()).find((item) => item.nodeId === verificationNodeId);
  if (listed === undefined || listed.revokedAt !== null || listed.lastAuthenticatedAt === null) {
    throw new Error("Enrolled Node metadata was not projected from PostgreSQL.");
  }
  await identity.revoke(verificationNodeId);
  if (await identity.authenticate(verificationNodeId, enrolled.credential)) {
    throw new Error("Revoked Node credential still authenticated.");
  }
  const revoked = (await identity.list()).find((item) => item.nodeId === verificationNodeId);
  if (revoked?.revokedAt === null || revoked?.revokedAt === undefined) {
    throw new Error("Revoked Node metadata was not projected from PostgreSQL.");
  }
  console.info(`Database verification passed with ${result.migrations} applied migrations.`);
} finally {
  await Promise.allSettled([
    first.client`delete from node_identity_events where node_id = ${verificationNodeId}`,
    first.client`delete from node_credentials where node_id = ${verificationNodeId}`,
    first.client`delete from node_enrollment_tokens where node_id = ${verificationNodeId}`,
  ]);
  await Promise.allSettled([first.close(), second.close()]);
}
