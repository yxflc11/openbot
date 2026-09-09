import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 16 * 1024 * 1024;
const REVIEWED_FIXTURES = Object.freeze([
  {
    commit: "9cc73c9e78451e572f57d142d6b9caf62ccb78e2",
    file: "apps/server/src/model-web-tools.test.ts",
    line: 188,
    raw: "1231625e7e70c4e56347672932d37a1c35eff89051483b37cbd09f7b9c58337e",
    rawV2: "1231625e7e70c4e56347672932d37a1c35eff89051483b37cbd09f7b9c58337e",
  },
  {
    commit: "c095669dbb4e241d2999867e3778b1b4408a83fa",
    file: "apps/desktop/src/desktop-support-links.test.ts",
    line: 29,
    raw: "5cb295befc1b5d1ef305b1741773eb77b2488034068900f6303cff28085306e9",
    rawV2: "867b18066ef99681db5cac0d82c24537671436661eb4e73669beaaece989885c",
  },
  {
    commit: "e8fa933dbd94751ee01974bb16e53158760f1c26",
    file: "apps/server/src/native-web-tools.test.ts",
    line: 99,
    raw: "10a105928f8eee716169d4b157b0976a7ac565f1262cfb11c2aee2d4f711a07d",
    rawV2: "41a0b7336302d4c7c07f4f5620b3f87a03d8ef3c2e08a925d7eb91f3e54de986",
  },
]);

function digest(value) {
  return typeof value === "string" ? createHash("sha256").update(value).digest("hex") : undefined;
}

function reviewedFixture(finding) {
  const source = finding?.SourceMetadata?.Data?.Git;
  // This exception binds an immutable synthetic test line, never an entire file or detector.
  // Review evidence: docs/research/credential-scan-fixture-triage.md.
  return (
    finding?.DetectorType === 17 &&
    finding.DetectorName === "URI" &&
    finding.Verified === false &&
    REVIEWED_FIXTURES.some(
      (fixture) =>
        source?.commit === fixture.commit &&
        source.file === fixture.file &&
        source.line === fixture.line &&
        digest(finding.Raw) === fixture.raw &&
        digest(finding.RawV2) === fixture.rawV2,
    )
  );
}

export function checkCredentialFindings(output, scannerExit) {
  if (scannerExit !== 0 && scannerExit !== 183) {
    throw new Error("Credential scanner failed; findings cannot override a scan error.");
  }
  if (Buffer.byteLength(output) > MAX_BYTES) {
    throw new Error("Credential scanner output exceeds the review limit.");
  }
  const lines = output.split("\n").filter((line) => line.trim() !== "");
  if ((scannerExit === 0 && lines.length !== 0) || (scannerExit === 183 && lines.length === 0)) {
    throw new Error("Credential scanner exit and findings are inconsistent.");
  }
  for (const line of lines) {
    let finding;
    try {
      finding = JSON.parse(line);
    } catch {
      // JSON parser messages can contain candidate fragments; never forward them into CI logs.
      throw new Error("Credential scanner produced invalid JSON.");
    }
    if (!reviewedFixture(finding)) {
      throw new Error(
        "Unreviewed credential-like content detected; inspect locally without uploads.",
      );
    }
  }
  return { reviewedFixtures: lines.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [, , resultsPath, exitText] = process.argv;
    if (!resultsPath || !/^(0|183)$/.test(exitText ?? "")) {
      throw new Error("Credential scanner failed or its result arguments are invalid.");
    }
    if ((await stat(resultsPath)).size > MAX_BYTES) {
      throw new Error("Credential scanner output exceeds the review limit.");
    }
    const result = checkCredentialFindings(await readFile(resultsPath, "utf8"), Number(exitText));
    console.info(`Credential scan passed; ${result.reviewedFixtures} exact historical fixture(s).`);
  } catch {
    console.error(
      "Credential scan failed closed. Inspect results locally; candidate values are suppressed.",
    );
    process.exitCode = 1;
  }
}
