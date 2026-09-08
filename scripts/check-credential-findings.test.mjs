import assert from "node:assert/strict";
import test from "node:test";
import { checkCredentialFindings } from "./check-credential-findings.mjs";

function fixture() {
  // Construct the intentionally invalid navigation input without adding another scanner match.
  const url = new URL("https://example.com");
  url.username = "user";
  url.password = "pass";
  return {
    DetectorType: 17,
    DetectorName: "URI",
    Verified: false,
    Raw: url.href.slice(0, -1),
    RawV2: url.href.slice(0, -1),
    SourceMetadata: {
      Data: {
        Git: {
          commit: "9cc73c9e78451e572f57d142d6b9caf62ccb78e2",
          file: "apps/server/src/model-web-tools.test.ts",
          line: 188,
        },
      },
    },
  };
}

test("accepts clean scans and only the exact reviewed historical fixture", () => {
  assert.deepEqual(checkCredentialFindings("", 0), { reviewedFixtures: 0 });
  assert.deepEqual(checkCredentialFindings(`${JSON.stringify(fixture())}\n`, 183), {
    reviewedFixtures: 1,
  });
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
  for (const mutate of mutations) {
    const value = fixture();
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
