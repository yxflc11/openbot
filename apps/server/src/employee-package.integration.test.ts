import { randomUUID } from "node:crypto";
import { createDatabase } from "@openbot/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseSkillDocument } from "./agent-skills.js";
import {
  buildEmployeeTemplate,
  employeeTemplatePackageDigest,
  employeeTemplatePayloadChecksum,
  inspectEmployeeTemplate,
} from "./employee-package.js";
import { skillCatalog, readSkillDocument } from "./postgres-agent-skills.js";
import { PostgresControlPlaneStore } from "./postgres-store.js";

const url = process.env.OPENBOT_IMPORT_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/openbot_import_test_[a-z0-9_]+$/.test(target.pathname)
  )
    throw new Error("Import tests require a disposable loopback openbot_import_test_* database.");
}

describe.skipIf(!url)("portable instruction persistence and recipient review", () => {
  const database = url ? createDatabase(url) : undefined;
  beforeAll(async () => {
    await database?.migrate();
  });
  afterAll(async () => {
    await database?.close();
  });
  it("imports into an empty skill catalog, requires digest review, and refuses a conflicting definition", async () => {
    if (!database) throw new Error("Missing fixture database");
    const store = new PostgresControlPlaneStore(database.db);
    const source = await store.createBot({
      name: `Source-${randomUUID().slice(0, 8)}`,
      role: "Summarize notes",
      computerProfile: "none",
    });
    const slug = `summarize-${randomUUID().slice(0, 8)}`;
    const parsed = parseSkillDocument(
      `---\nname: ${slug}\ndescription: Summarize supplied notes.\nlicense: MIT\nmetadata:\n  author: OpenBot test fixture\n---\nReturn exactly three concise bullets based on the supplied notes.\n`,
    );
    const candidate = await store.createEmployeeSkill(source.id, {
      skillMarkdown: parsed.markdown,
      slug,
      name: "Summarize",
      description: parsed.description,
      version: "1.0.0",
      source: "manual",
      requiredCapabilities: [],
      dependencySkillIds: [],
      evidence: [],
      reason: "Fixture instructions",
    });
    await store.updateEmployeeSkillState(source.id, candidate.skill.id, {
      state: "verified",
      reviewedContentSha256: parsed.sha256,
      confidence: 1,
      reason: "Reviewed exact fixture",
      evidence: [],
      ownerReviewed: true,
    });
    const exported = buildEmployeeTemplate(await store.getEmployeeProfile(source.id), {
      includeSkillContent: true,
    });
    expect(exported.preview.blocked).toBe(false);
    expect(exported.document.payload.skills[0]?.content?.markdown).toBe(parsed.markdown);
    // Remove only the source fixture definition to prove the recipient does not depend on it.
    await database.client`delete from employee_skills where bot_id = ${source.id}`;
    await database.client`delete from skills where id = ${candidate.skill.id}`;
    const preview = inspectEmployeeTemplate(exported.document, []);
    expect(preview.blocked).toBe(false);
    const command = {
      document: exported.document,
      packageDigest: employeeTemplatePackageDigest(exported.document),
      idempotencyKey: randomUUID(),
      employeeName: `Imported-${randomUUID().slice(0, 8)}`,
      signature: { status: "unsigned" as const },
      reviewedBy: "owner" as const,
      reviewedAt: new Date().toISOString(),
    };
    const result = await store.activateEmployeeImport(command);
    expect(result.employee.id).not.toBe(source.id);
    const imported = (await store.getEmployeeProfile(result.employee.id)).skills[0];
    expect(imported).toMatchObject({
      state: "candidate",
      skillMarkdown: parsed.markdown,
      contentSha256: parsed.sha256,
      modelUseEnabled: false,
    });
    expect((await skillCatalog(database.db, result.employee.id)).skills).toHaveLength(0);
    await expect(
      store.updateEmployeeSkillState(result.employee.id, imported!.id, {
        state: "verified",
        reviewedContentSha256: "a".repeat(64),
        confidence: 1,
        reason: "Wrong digest",
        evidence: [],
        ownerReviewed: true,
      }),
    ).rejects.toThrow();
    await store.updateEmployeeSkillState(result.employee.id, imported!.id, {
      state: "verified",
      reviewedContentSha256: parsed.sha256,
      confidence: 1,
      reason: "Recipient reviews exact content",
      evidence: [],
      ownerReviewed: true,
    });
    const catalog = await skillCatalog(database.db, result.employee.id);
    expect(catalog.skills).toHaveLength(1);
    expect(
      (await readSkillDocument(database.db, result.employee.id, catalog.skills[0]!)).markdown,
    ).toBe(parsed.markdown);
    expect((await store.activateEmployeeImport(command)).replayed).toBe(true);
    const altered = structuredClone(exported.document);
    altered.payload.packageId = randomUUID();
    const changed = parseSkillDocument(`${parsed.markdown}Changed definition.\n`);
    altered.payload.skills[0]!.content = {
      markdown: changed.markdown,
      sha256: changed.sha256,
      license: "MIT",
    };
    altered.integrity.digest = employeeTemplatePayloadChecksum(altered.payload);
    await expect(
      store.activateEmployeeImport({
        ...command,
        document: altered,
        packageDigest: employeeTemplatePackageDigest(altered),
        idempotencyKey: randomUUID(),
        employeeName: `Conflict-${randomUUID().slice(0, 8)}`,
      }),
    ).rejects.toThrow(/different definition/);
    expect(
      (await readSkillDocument(database.db, result.employee.id, catalog.skills[0]!)).markdown,
    ).toBe(parsed.markdown);
  });
});
