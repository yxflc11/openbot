import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateSecurityWorkflow(workflow) {
  const requiredFragments = [
    "permissions:\n  contents: read",
    "fetch-depth: 0",
    "persist-credentials: false",
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

  const securityJobStart = workflow.indexOf("\n  security:\n");
  const checkJobStart = workflow.indexOf("\n  check:\n");
  if (securityJobStart === -1 || checkJobStart <= securityJobStart) {
    throw new Error("CI must define the security job before the check job.");
  }
  const securityJob = workflow.slice(securityJobStart, checkJobStart);
  const requiredSecurityFragments = [
    "npm install --global npm@10.9.9 --ignore-scripts --no-audit --no-fund",
    'test "$(npm --version)" = "10.9.9"',
    "npm ci --ignore-scripts --audit=false",
    "npm audit --omit=dev --audit-level=high",
  ];
  for (const fragment of requiredSecurityFragments) {
    if (!securityJob.includes(fragment)) {
      throw new Error(`CI security job is missing required fragment: ${fragment}`);
    }
  }
  const selectedNpm = securityJob.indexOf(requiredSecurityFragments[0]);
  const verifiedNpm = securityJob.indexOf(requiredSecurityFragments[1]);
  const cleanInstall = securityJob.indexOf(requiredSecurityFragments[2]);
  const audit = securityJob.indexOf(requiredSecurityFragments[3]);
  if (
    selectedNpm === -1 ||
    verifiedNpm <= selectedNpm ||
    cleanInstall <= verifiedNpm ||
    audit <= cleanInstall
  ) {
    throw new Error(
      "CI security job must select and verify npm, install the lock tree, then audit.",
    );
  }
  if (
    /continue-on-error:|npm audit fix|(?:npm ci|npm audit)[^\n]*(?:\|\||;)\s*true/.test(securityJob)
  ) {
    throw new Error("CI dependency auditing must remain read-only and fail closed.");
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
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    "node-version: 22.22.2",
    "cache: npm",
    "- run: npm ci",
    "- run: npm run typecheck",
    "- run: npm run test",
    "- run: npm run build",
    "name: Validate macOS LaunchAgent contract with native plist parser",
    "if: runner.os == 'macOS'",
    "npm run worker-host:macos:check",
    "npm run worker-host:macos:native-check",
    "/usr/bin/plutil -lint apps/worker-host-macos/Resources/com.openbot.worker-host.node.plist",
    "/usr/bin/plutil -lint apps/worker-host-macos/Resources/Info.plist.template",
    "/usr/bin/plutil -lint apps/worker-host-macos/Resources/OpenBotWorkerHost.entitlements.template.plist",
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
