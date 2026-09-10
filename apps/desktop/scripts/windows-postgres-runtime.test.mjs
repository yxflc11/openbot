import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { stageWindowsPostgres, WINDOWS_POSTGRES_SOURCE } from "./windows-postgres-runtime.mjs";

const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "openbot-pg-source-"));
  roots.push(root);
  const source = join(root, "source");
  const destination = join(root, "stage");
  const files = [];
  for (const path of [
    "bin/initdb.exe",
    "bin/postgres.exe",
    "bin/pg_ctl.exe",
    "bin/psql.exe",
    "licenses/COPYRIGHT",
    "share/timezone/Etc/GMT+0",
  ]) {
    const bytes = Buffer.from(`synthetic ${path}`);
    await mkdir(dirname(join(source, path)), { recursive: true });
    await writeFile(join(source, path), bytes);
    files.push({
      path,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const manifest = {
    schemaVersion: 1,
    distribution: "openbot-postgresql-source-build",
    postgresqlVersion: "17.11",
    platform: "win32",
    arch: "x64",
    source: WINDOWS_POSTGRES_SOURCE,
    options: ["--auto-features=disabled", "-Dssl=none", "-Duuid=none", "-Db_vscrt=mt"],
    files,
    licenses: ["licenses/COPYRIGHT"],
  };
  const save = () =>
    writeFile(join(source, "openbot-postgresql-build.json"), JSON.stringify(manifest));
  await save();
  return { source, destination, manifest, save };
}
it("stages verified source-build bytes and complete manifest", async () => {
  const data = await fixture();
  await stageWindowsPostgres(data.source, data.destination);
  expect(await readFile(join(data.destination, "bin/postgres.exe"), "utf8")).toBe(
    "synthetic bin/postgres.exe",
  );
  expect(
    JSON.parse(await readFile(join(data.destination, "openbot-postgresql-build.json"), "utf8")),
  ).toEqual(data.manifest);
});
it("rejects altered bytes and unlisted runtime files", async () => {
  const data = await fixture();
  await writeFile(join(data.source, "bin/postgres.exe"), "tampered");
  await expect(stageWindowsPostgres(data.source, data.destination)).rejects.toThrow(
    /inventory|digest/,
  );
  const extra = await fixture();
  await writeFile(join(extra.source, "libintl-9.dll"), "unexpected");
  await expect(stageWindowsPostgres(extra.source, extra.destination)).rejects.toThrow(/inventory/);
});
it("rejects a missing source pin, optional feature policy, or inventory entry", async () => {
  for (const change of [
    (manifest) => {
      manifest.source = { ...manifest.source, sha256: "0".repeat(64) };
    },
    (manifest) => {
      manifest.options = [];
    },
    (manifest) => {
      manifest.files[0].path = "../escape.exe";
    },
    (manifest) => {
      manifest.files.push({ ...manifest.files[0] });
    },
  ]) {
    const data = await fixture();
    change(data.manifest);
    await data.save();
    await expect(stageWindowsPostgres(data.source, data.destination)).rejects.toThrow();
  }
  const data = await fixture();
  await rm(join(data.source, "bin/psql.exe"));
  await expect(stageWindowsPostgres(data.source, data.destination)).rejects.toThrow(
    /missing files/,
  );
});
it.skipIf(process.platform === "win32")("rejects linked runtime files", async () => {
  const data = await fixture();
  await rm(join(data.source, "bin/psql.exe"));
  await symlink("postgres.exe", join(data.source, "bin/psql.exe"));
  await expect(stageWindowsPostgres(data.source, data.destination)).rejects.toThrow(/link/);
});
it("never falls back to an installed npm binary", async () => {
  await expect(stageWindowsPostgres(undefined, "/unused")).rejects.toThrow(
    /OPENBOT_WINDOWS_POSTGRES_RUNTIME/,
  );
});
