import assert from "node:assert/strict";
import { test } from "node:test";
import { validateMigrationManifest } from "./check-migrations.mjs";

const journal = {
  entries: [
    { idx: 0, when: 1000, tag: "0000_foundation", breakpoints: true },
    { idx: 1, when: 2000, tag: "0001_channels", breakpoints: true },
  ],
};

test("accepts an ordered journal with an exact SQL file set", () => {
  assert.doesNotThrow(() =>
    validateMigrationManifest(journal, ["0001_channels.sql", "0000_foundation.sql"]),
  );
});

test("rejects journal, timestamp, and filename drift", () => {
  assert.throws(
    () =>
      validateMigrationManifest({ entries: [journal.entries[1], journal.entries[0]] }, [
        "0000_foundation.sql",
        "0001_channels.sql",
      ]),
    /out of sequence/,
  );
  assert.throws(
    () =>
      validateMigrationManifest(
        {
          entries: [journal.entries[0], { ...journal.entries[1], when: 1000 }],
        },
        ["0000_foundation.sql", "0001_channels.sql"],
      ),
    /strictly increasing/,
  );
  assert.throws(
    () => validateMigrationManifest(journal, ["0000_foundation.sql"]),
    /missing from disk/,
  );
  assert.throws(
    () =>
      validateMigrationManifest(journal, [
        "0000_foundation.sql",
        "0001_channels.sql",
        "0002_untracked.sql",
      ]),
    /missing from the migration journal/,
  );
});
