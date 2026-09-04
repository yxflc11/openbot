import { describe, expect, it } from "vitest";
import { type AppliedMigration, assertMigrationHistory } from "./index.js";

const expected = [
  { folderMillis: 1000, hash: "first" },
  { folderMillis: 2000, hash: "second" },
  { folderMillis: 3000, hash: "third" },
];

describe("migration history", () => {
  it("accepts an exact applied prefix and requires the full plan after migration", () => {
    const prefix: AppliedMigration[] = [
      { createdAt: 1000, hash: "first" },
      { createdAt: 2000, hash: "second" },
    ];

    expect(() => assertMigrationHistory(expected, prefix)).not.toThrow();
    expect(() => assertMigrationHistory(expected, prefix, true)).toThrow("incomplete");
    expect(() =>
      assertMigrationHistory(expected, [...prefix, { createdAt: 3000, hash: "third" }], true),
    ).not.toThrow();
  });

  it("rejects changed SQL fingerprints and high-water timestamp drift", () => {
    expect(() => assertMigrationHistory(expected, [{ createdAt: 1000, hash: "changed" }])).toThrow(
      "diverges",
    );
    expect(() => assertMigrationHistory(expected, [{ createdAt: 3000, hash: "first" }])).toThrow(
      "diverges",
    );
  });

  it("rejects non-monotonic journals and databases ahead of the build", () => {
    expect(() =>
      assertMigrationHistory(
        [
          { folderMillis: 2000, hash: "first" },
          { folderMillis: 1000, hash: "second" },
        ],
        [],
      ),
    ).toThrow("strictly increasing");
    expect(() =>
      assertMigrationHistory(expected, [
        { createdAt: 1000, hash: "first" },
        { createdAt: 2000, hash: "second" },
        { createdAt: 3000, hash: "third" },
        { createdAt: 4000, hash: "future" },
      ]),
    ).toThrow("ahead");
  });
});
