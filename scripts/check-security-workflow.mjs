import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateSecurityWorkflow(workflow) {
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

  const portableJobStart = workflow.indexOf("\n  portable:\n");
  const windowsWorkerHostJobStart = workflow.indexOf("\n  windows-worker-host:\n");
  const databaseJobStart = workflow.indexOf("\n  database:\n");
  if (
    portableJobStart === -1 ||
    windowsWorkerHostJobStart <= portableJobStart ||
    databaseJobStart <= windowsWorkerHostJobStart
  ) {
    throw new Error(
      "CI must define the portable matrix before the Windows Worker Host and database jobs.",
    );
  }

  const portableJob = workflow.slice(portableJobStart, windowsWorkerHostJobStart);
  const requiredPortableFragments = [
    "name: Portable ($" + "{{ matrix.name }})",
    "runs-on: $" + "{{ matrix.runner }}",
    "timeout-minutes: 15",
    "fail-fast: false",
    "- name: Linux x64\n            runner: ubuntu-24.04",
    "- name: Windows x64\n            runner: windows-2025",
    "- name: macOS arm64\n            runner: macos-15",
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
    "persist-credentials: false",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "node-version: 22.22.2",
    "cache: npm",
    "- run: npm ci",
    "- run: npm run typecheck",
    "- run: npm run test",
    "- run: npm run build",
  ];

  for (const fragment of requiredPortableFragments) {
    if (!portableJob.includes(fragment)) {
      throw new Error(`CI portable matrix is missing required fragment: ${fragment}`);
    }
  }

  if (/continue-on-error:|(?:ubuntu|windows|macos)-latest/.test(portableJob)) {
    throw new Error("CI portable matrix members must be required and use explicit runner labels.");
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  validateSecurityWorkflow(workflow);
  console.info("CI security workflow checks passed.");
}
