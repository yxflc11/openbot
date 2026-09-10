import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const WINDOWS_POSTGRES_SOURCE = Object.freeze({
  url: "https://ftp.postgresql.org/pub/source/v17.11/postgresql-17.11.tar.bz2",
  sha256: "dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979",
});
const manifestName = "openbot-postgresql-build.json";

/** Consume only the complete, verified output of the pinned CI source build. */
export async function stageWindowsPostgres(source, destination) {
  if (typeof source !== "string" || source.length === 0)
    throw new Error(
      "Windows packaging requires OPENBOT_WINDOWS_POSTGRES_RUNTIME from the source build.",
    );
  const manifestPath = join(source, manifestName);
  const info = await lstat(manifestPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4 * 1024 * 1024)
    throw new Error("Invalid Windows PostgreSQL build manifest.");
  const raw = await readFile(manifestPath);
  const manifest = JSON.parse(raw.toString("utf8"));
  if (
    manifest.schemaVersion !== 1 ||
    manifest.distribution !== "openbot-postgresql-source-build" ||
    manifest.postgresqlVersion !== "17.11" ||
    manifest.platform !== "win32" ||
    manifest.arch !== "x64" ||
    manifest.source?.url !== WINDOWS_POSTGRES_SOURCE.url ||
    manifest.source?.sha256 !== WINDOWS_POSTGRES_SOURCE.sha256 ||
    !Array.isArray(manifest.options) ||
    !["--auto-features=disabled", "-Dssl=none", "-Duuid=none", "-Db_vscrt=mt"].every((value) =>
      manifest.options.includes(value),
    ) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length === 0 ||
    manifest.files.length > 20_000 ||
    !Array.isArray(manifest.licenses) ||
    manifest.licenses.length === 0
  )
    throw new Error("Unexpected Windows PostgreSQL source build identity or policy.");
  const inventory = new Map();
  let total = 0;
  for (const entry of manifest.files) {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      !/^[A-Za-z0-9_. +-]+(?:\/[A-Za-z0-9_. +-]+)*$/u.test(entry.path) ||
      entry.path.split("/").some((part) => part === "." || part === ".." || /[. ]$/u.test(part)) ||
      entry.path === manifestName ||
      inventory.has(entry.path.toLowerCase()) ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      entry.size > 512 * 1024 * 1024 ||
      typeof entry.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(entry.sha256)
    )
      throw new Error("Invalid Windows PostgreSQL file inventory.");
    total += entry.size;
    if (total > 1024 * 1024 * 1024) throw new Error("Windows PostgreSQL runtime is too large.");
    inventory.set(entry.path.toLowerCase(), entry);
  }
  for (const required of ["bin/initdb.exe", "bin/postgres.exe", "bin/pg_ctl.exe", "bin/psql.exe"])
    if (!inventory.has(required)) throw new Error(`Missing source-built ${required}.`);
  if (![...inventory.values()].some((entry) => entry.path.startsWith("licenses/")))
    throw new Error("Windows PostgreSQL licenses are missing.");
  const found = new Set();
  const visit = async (relativePath) => {
    const path = join(source, relativePath);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error("Windows PostgreSQL runtime contains a link.");
    if (stat.isDirectory()) {
      for (const name of await readdir(path))
        await visit(relativePath ? `${relativePath}/${name}` : name);
      return;
    }
    if (!stat.isFile()) throw new Error("Windows PostgreSQL runtime contains a special file.");
    if (relativePath === manifestName) return;
    const entry = inventory.get(relativePath.toLowerCase());
    if (!entry || entry.path !== relativePath || stat.size !== entry.size)
      throw new Error("Windows PostgreSQL runtime differs from its inventory.");
    const bytes = await readFile(path);
    if (
      bytes.length !== entry.size ||
      createHash("sha256").update(bytes).digest("hex") !== entry.sha256
    )
      throw new Error("Windows PostgreSQL file digest mismatch.");
    found.add(entry.path);
    await mkdir(dirname(join(destination, entry.path)), { recursive: true });
    await writeFile(join(destination, entry.path), bytes, { flag: "wx" });
  };
  await visit("");
  if (found.size !== inventory.size)
    throw new Error("Windows PostgreSQL inventory has missing files.");
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, manifestName), raw, { flag: "wx" });
}
