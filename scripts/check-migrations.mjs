import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = join(repositoryRoot, "packages/db/migrations");
const journalPath = join(migrationsDirectory, "meta/_journal.json");

export function validateMigrationManifest(journal, sqlFileNames) {
  if (journal === null || typeof journal !== "object" || !Array.isArray(journal.entries)) {
    throw new Error("Migration journal must contain an entries array.");
  }

  const expectedFiles = [];
  const seenTags = new Set();
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  for (const [position, entry] of journal.entries.entries()) {
    if (entry === null || typeof entry !== "object") {
      throw new Error(`Migration journal entry ${position} must be an object.`);
    }
    if (entry.idx !== position) {
      throw new Error(
        `Migration journal index ${entry.idx} is out of sequence at position ${position}.`,
      );
    }
    if (!Number.isSafeInteger(entry.when) || entry.when <= previousTimestamp) {
      throw new Error(
        `Migration journal timestamp is not strictly increasing at index ${position}.`,
      );
    }
    if (typeof entry.tag !== "string" || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag)) {
      throw new Error(`Migration journal tag is invalid at index ${position}.`);
    }
    const numericPrefix = Number(entry.tag.slice(0, 4));
    if (numericPrefix !== position) {
      throw new Error(`Migration filename prefix does not match index ${position}.`);
    }
    if (seenTags.has(entry.tag)) throw new Error(`Duplicate migration tag: ${entry.tag}.`);
    seenTags.add(entry.tag);
    expectedFiles.push(`${entry.tag}.sql`);
    previousTimestamp = entry.when;
  }

  const actualFiles = sqlFileNames.filter((name) => name.endsWith(".sql")).sort();
  expectedFiles.sort();
  const missing = expectedFiles.filter((name) => !actualFiles.includes(name));
  const untracked = actualFiles.filter((name) => !expectedFiles.includes(name));
  if (missing.length > 0)
    throw new Error(`Migration files missing from disk: ${missing.join(", ")}.`);
  if (untracked.length > 0) {
    throw new Error(`SQL files missing from the migration journal: ${untracked.join(", ")}.`);
  }
}

export async function checkMigrationManifest() {
  const [journalSource, directoryEntries] = await Promise.all([
    readFile(journalPath, "utf8"),
    readdir(migrationsDirectory, { withFileTypes: true }),
  ]);
  const journal = JSON.parse(journalSource);
  const sqlFiles = directoryEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  validateMigrationManifest(journal, sqlFiles);

  for (const fileName of sqlFiles.filter((name) => name.endsWith(".sql"))) {
    const contents = await readFile(join(migrationsDirectory, fileName), "utf8");
    if (contents.trim().length === 0) throw new Error(`Migration file is empty: ${fileName}.`);
  }
  return journal.entries.length;
}

if (
  process.argv[1] !== undefined &&
  basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))
) {
  checkMigrationManifest()
    .then((count) => console.info(`Migration manifest check passed for ${count} files.`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
