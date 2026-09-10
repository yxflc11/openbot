import { describe, expect, it } from "vitest";
import { parseWindowsPostmasterIdentity } from "./windows-postgres.js";

describe("Windows postmaster ownership", () => {
  const cluster = "C:\\Users\\Fixture\\OpenBot\\postgres";
  const record = (pid = "1234", directory = cluster, started = "100", port = "6543") =>
    `${pid}\n${directory}\n${started}\n${port}\n\n127.0.0.1\n0\nready\n`;
  it("accepts the current private cluster identity across Windows path casing", () => {
    expect(parseWindowsPostmasterIdentity(record(), cluster.toLowerCase(), 6543, 99)).toEqual({
      pid: 1234,
      started: 100,
    });
  });
  it.each([
    record("-1"),
    record("1.5"),
    record("2147483648"),
    record("1234", "C:\\another-cluster"),
    record("1234", cluster, "98"),
    record("1234", cluster, "100", "6544"),
    "",
  ])("rejects stale, unrelated or malformed stop authority", (contents) => {
    expect(() => parseWindowsPostmasterIdentity(contents, cluster, 6543, 99)).toThrow(
      "identity is invalid",
    );
  });
});
