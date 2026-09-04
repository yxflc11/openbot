import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateSecurityWorkflow } from "./check-security-workflow.mjs";

const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("accepts the pinned required portable matrix", () => {
  assert.doesNotThrow(() => validateSecurityWorkflow(workflow));
});

test("requires the exact npm CLI and a clean lock tree before auditing", () => {
  assert.throws(
    () => validateSecurityWorkflow(workflow.replace("npm@10.9.9", "npm@latest")),
    /missing required fragment/,
  );
  assert.throws(
    () =>
      validateSecurityWorkflow(
        workflow.replace("npm ci --ignore-scripts --audit=false", "npm install"),
      ),
    /missing required fragment/,
  );
  const auditFirst = workflow
    .replace("        run: npm ci --ignore-scripts --audit=false\n", "")
    .replace(
      "        run: npm audit --omit=dev --audit-level=high\n",
      "        run: npm audit --omit=dev --audit-level=high\n      - run: npm ci --ignore-scripts --audit=false\n",
    );
  assert.throws(() => validateSecurityWorkflow(auditFirst), /install the lock tree, then audit/);
});

test("rejects dependency audit bypasses and mutation", () => {
  assert.throws(
    () =>
      validateSecurityWorkflow(
        workflow.replace(
          "run: npm audit --omit=dev --audit-level=high",
          "run: npm audit --omit=dev --audit-level=high || true",
        ),
      ),
    /read-only and fail closed/,
  );
  assert.throws(
    () =>
      validateSecurityWorkflow(
        workflow.replace(
          "run: npm audit --omit=dev --audit-level=high",
          "run: npm audit fix --force",
        ),
      ),
    /missing required fragment|read-only and fail closed/,
  );
});

test("rejects a missing platform or moving runner label", () => {
  assert.throws(
    () =>
      validateSecurityWorkflow(workflow.replace("runner: windows-2025", "runner: windows-latest")),
    /missing required fragment|explicit runner labels/,
  );
});

test("rejects a matrix member that is allowed to fail", () => {
  const changed = workflow.replace(
    "    timeout-minutes: 15\n    strategy:\n      fail-fast: false",
    "    timeout-minutes: 15\n    continue-on-error: true\n    strategy:\n      fail-fast: false",
  );
  assert.throws(() => validateSecurityWorkflow(changed), /members must be required/);
});

test("rejects action, Node, or checkout-security drift in the portable job", () => {
  const portableStart = workflow.indexOf("\n  portable:\n");
  const windowsWorkerHostStart = workflow.indexOf("\n  windows-worker-host:\n");
  const beforePortable = workflow.slice(0, portableStart);
  const portableJob = workflow.slice(portableStart, windowsWorkerHostStart);
  const afterPortable = workflow.slice(windowsWorkerHostStart);

  assert.throws(
    () =>
      validateSecurityWorkflow(
        `${beforePortable}${portableJob.replace(
          "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version: 22.22.2",
          "actions/setup-node@v7\n        with:\n          node-version: 22",
        )}${afterPortable}`,
      ),
    /missing required fragment/,
  );

  const portableWithoutCheckoutProtection = portableJob.replace(
    "          persist-credentials: false\n",
    "",
  );
  const changed = `${beforePortable}${portableWithoutCheckoutProtection}${afterPortable}`;
  assert.throws(() => validateSecurityWorkflow(changed), /missing required fragment/);
});

test("rejects removal or broadening of the native macOS plist gate", () => {
  assert.throws(
    () =>
      validateSecurityWorkflow(
        workflow.replace("        if: runner.os == 'macOS'", "        if: runner.os != 'Windows'"),
      ),
    /missing required fragment/,
  );
  assert.throws(
    () =>
      validateSecurityWorkflow(
        workflow.replace(
          "/usr/bin/plutil -lint apps/worker-host-macos/Resources/com.openbot.worker-host.node.plist",
          "echo skipped",
        ),
      ),
    /missing required fragment/,
  );
  assert.throws(
    () =>
      validateSecurityWorkflow(
        workflow.replace("          npm run worker-host:macos:native-check\n", ""),
      ),
    /missing required fragment/,
  );
});
