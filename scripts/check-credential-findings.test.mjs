import assert from "node:assert/strict";
import test from "node:test";
import { checkCredentialFindings } from "./check-credential-findings.mjs";

function fixture(index = 0) {
  // Construct intentionally invalid inputs without creating fresh literal scanner matches.
  const definitions = [
    {
      url: "https://example.com",
      password: "pass",
      commit: "9cc73c9e78451e572f57d142d6b9caf62ccb78e2",
      file: "apps/server/src/model-web-tools.test.ts",
      line: 188,
    },
    {
      url: "https://github.com/yxflc11/openbot/issues/new",
      password: "password",
      commit: "c095669dbb4e241d2999867e3778b1b4408a83fa",
      file: "apps/desktop/src/desktop-support-links.test.ts",
      line: 29,
    },
    {
      url: "https://api.moonshot.cn/v1",
      password: "password",
      commit: "e8fa933dbd94751ee01974bb16e53158760f1c26",
      file: "apps/server/src/native-web-tools.test.ts",
      line: 99,
    },
  ];
  const definition = definitions[index];
  const url = new URL(definition.url);
  url.username = "user";
  url.password = definition.password;
  const rawV2 = index === 0 ? url.href.slice(0, -1) : url.href;
  url.pathname = "/";
  return {
    DetectorType: 17,
    DetectorName: "URI",
    Verified: false,
    Raw: url.href.slice(0, -1),
    RawV2: rawV2,
    SourceMetadata: {
      Data: { Git: { commit: definition.commit, file: definition.file, line: definition.line } },
    },
  };
}

test("accepts clean scans and only the three exact reviewed historical fixtures", () => {
  assert.deepEqual(checkCredentialFindings("", 0), { reviewedFixtures: 0 });
  const findings = [0, 1, 2].map((index) => JSON.stringify(fixture(index)));
  for (const finding of findings)
    assert.deepEqual(checkCredentialFindings(finding, 183), { reviewedFixtures: 1 });
  assert.deepEqual(checkCredentialFindings(findings.join("\n"), 183), { reviewedFixtures: 3 });
});

test("does not exempt another value, detector, verified result, or source location", () => {
  const mutations = [
    (value) => {
      value.Raw += "different";
    },
    (value) => {
      value.RawV2 += "different";
    },
    (value) => {
      value.DetectorType = 1;
    },
    (value) => {
      value.DetectorName = "Other";
    },
    (value) => {
      value.Verified = true;
    },
    (value) => {
      delete value.Verified;
    },
    (value) => {
      value.SourceMetadata.Data.Git.commit = "a".repeat(40);
    },
    (value) => {
      value.SourceMetadata.Data.Git.file = "another.test.ts";
    },
    (value) => {
      value.SourceMetadata.Data.Git.line += 1;
    },
  ];
  for (const index of [0, 1, 2])
    for (const mutate of mutations) {
      const value = fixture(index);
      mutate(value);
      assert.throws(() => checkCredentialFindings(JSON.stringify(value), 183), /Unreviewed/);
      assert.throws(
        () => checkCredentialFindings([fixture(), value].map(JSON.stringify).join("\n"), 183),
        /Unreviewed/,
      );
    }
});

test("fails closed on scanner errors, inconsistent results, malformed and oversized output", () => {
  for (const code of [1, 2, 125, 137, undefined, NaN]) {
    assert.throws(() => checkCredentialFindings(JSON.stringify(fixture()), code), /scan error/);
  }
  assert.throws(() => checkCredentialFindings("", 183), /inconsistent/);
  assert.throws(() => checkCredentialFindings(JSON.stringify(fixture()), 0), /inconsistent/);
  for (const output of ["null", "[]", "{}", "42"]) {
    assert.throws(() => checkCredentialFindings(output, 183), /Unreviewed/);
  }
  assert.throws(() => checkCredentialFindings(" ".repeat(16 * 1024 * 1024 + 1), 0), /limit/);
  const candidate = "sensitive-candidate-must-never-be-printed";
  assert.throws(
    () => checkCredentialFindings(`{"Raw":"${candidate}`, 183),
    (error) => {
      assert.equal(error.message, "Credential scanner produced invalid JSON.");
      assert.ok(!error.message.includes(candidate));
      return true;
    },
  );
});
