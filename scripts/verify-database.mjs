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
const { PostgresControlPlaneStore } = await import("../apps/server/dist/postgres-store.js");
const { buildEmployeeTemplate, employeeTemplatePackageDigest } = await import(
  "../apps/server/dist/employee-package.js"
);
const first = createDatabase(databaseUrl);
const second = createDatabase(databaseUrl);
const verificationNodeId = `db-verification-${randomUUID()}`;
const employeeVerificationId = randomUUID();
let sourceEmployeeId;
let importedEmployeeId;
let verificationSkillId;
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

  const store = new PostgresControlPlaneStore(first.db);
  const source = await store.createBot({
    name: `Import source ${employeeVerificationId}`,
    role: "Database import verification",
    computerProfile: "none",
  });
  sourceEmployeeId = source.id;
  const candidate = await store.createEmployeeSkill(source.id, {
    slug: `database-import-${employeeVerificationId}`,
    name: "Database import verification",
    description: "Temporary skill used by the disposable database verification script.",
    version: "1.0.0",
    source: "manual",
    requiredCapabilities: [],
    dependencySkillIds: [],
    evidence: [],
    reason: "Verify portable Employee persistence.",
  });
  verificationSkillId = candidate.skill.id;
  await store.updateEmployeeSkillState(source.id, candidate.skill.id, {
    state: "verified",
    confidence: 100,
    reason: "Verified only for the disposable database test.",
    evidence: [],
    ownerReviewed: true,
  });
  const employeeTemplate = buildEmployeeTemplate(await store.getEmployeeProfile(source.id));
  const packageDigest = employeeTemplatePackageDigest(employeeTemplate.document);
  const idempotencyKey = randomUUID();
  const activationCommand = {
    document: employeeTemplate.document,
    packageDigest,
    idempotencyKey,
    employeeName: `Import copy ${employeeVerificationId}`,
    signature: { status: "unsigned" },
    reviewedBy: "owner",
    reviewedAt: new Date().toISOString(),
  };
  const concurrentActivations = await Promise.all([
    store.activateEmployeeImport(activationCommand),
    store.activateEmployeeImport(activationCommand),
  ]);
  const activated = concurrentActivations.find((item) => !item.replayed);
  const concurrentReplay = concurrentActivations.find((item) => item.replayed);
  if (activated === undefined || concurrentReplay?.employee.id !== activated.employee.id) {
    throw new Error("Concurrent Employee activation did not converge on one receipt.");
  }
  importedEmployeeId = activated.employee.id;
  const importedProfile = await store.getEmployeeProfile(activated.employee.id);
  if (
    activated.replayed ||
    activated.receipt.packageDigest !== packageDigest ||
    activated.receipt.importedSkillCount !== 1 ||
    importedProfile.skills.length !== 1 ||
    importedProfile.skills[0]?.state !== "candidate" ||
    importedProfile.skills[0]?.source !== "imported" ||
    importedProfile.skills[0]?.confidence !== 0 ||
    importedProfile.memories.length !== 0
  ) {
    throw new Error("Reviewed Employee activation did not preserve its zero-authority boundary.");
  }
  const replayed = await store.activateEmployeeImport(activationCommand);
  if (!replayed.replayed || replayed.employee.id !== activated.employee.id) {
    throw new Error("Reviewed Employee activation was not idempotent.");
  }
  console.info(`Database verification passed with ${result.migrations} applied migrations.`);
} finally {
  await Promise.allSettled([
    first.client`delete from node_identity_events where node_id = ${verificationNodeId}`,
    first.client`delete from node_credentials where node_id = ${verificationNodeId}`,
    first.client`delete from node_enrollment_tokens where node_id = ${verificationNodeId}`,
  ]);
  if (importedEmployeeId !== undefined) {
    await first.client`delete from employee_import_receipts where employee_id = ${importedEmployeeId}`;
  }
  const employeeIds = [sourceEmployeeId, importedEmployeeId].filter(
    (value) => value !== undefined,
  );
  if (employeeIds.length > 0) {
    await first.client`delete from run_events where bot_id = any(${employeeIds})`;
    await first.client`delete from bots where id = any(${employeeIds})`;
  }
  if (verificationSkillId !== undefined) {
    await first.client`delete from skills where id = ${verificationSkillId}`;
  }
  await Promise.allSettled([first.close(), second.close()]);
}
