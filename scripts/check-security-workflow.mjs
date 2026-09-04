import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const requiredFragments = [
  "permissions:\n  contents: read",
  "fetch-depth: 0",
  "persist-credentials: false",
  "npm audit --omit=dev --audit-level=high",
  "ghcr.io/trufflesecurity/trufflehog@sha256:deb2af10659a488a14d262a323addcde099d99827a1cf1dc4e93c17915c39f08",
  "--no-verification",
  "--no-update",
  "--fail-on-scan-errors",
  "$" + "{{ github.workspace }}:/repo:ro",
];

for (const fragment of requiredFragments) {
  if (!workflow.includes(fragment)) {
    throw new Error(`CI security workflow is missing required fragment: ${fragment}`);
  }
}

if (/trufflehog-action@|upload-sarif|--verifier/.test(workflow)) {
  throw new Error("CI secret scanning must stay digest-pinned, local, and non-uploading.");
}

console.info("CI security workflow checks passed.");
