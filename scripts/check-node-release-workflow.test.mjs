import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateNodeReleaseWorkflow } from "./check-node-release-workflow.mjs";

const workflow = await readFile(
  new URL("../.github/workflows/node-linux-release.yml", import.meta.url),
  "utf8",
);

test("accepts the tag-only reproducible attestation workflow", () => {
  assert.doesNotThrow(() => validateNodeReleaseWorkflow(workflow));
});

test("rejects widened triggers or publication authority", () => {
  assert.throws(
    () =>
      validateNodeReleaseWorkflow(workflow.replace("  push:\n", "  workflow_dispatch:\n  push:\n")),
    /broadens/,
  );
  assert.throws(
    () => validateNodeReleaseWorkflow(workflow.replace("contents: read", "contents: write")),
    /missing|required|broadens/,
  );
  assert.throws(
    () => validateNodeReleaseWorkflow(`${workflow}\n      - run: gh release create node-v1.2.3\n`),
    /broadens/,
  );
});

test("rejects a runner context before a release job is assigned", () => {
  assert.throws(
    () =>
      validateNodeReleaseWorkflow(
        workflow.replace(
          "RELEASE_ROOT: ${{ github.workspace }}-node-release-${{ matrix.arch }}",
          "RELEASE_ROOT: ${{ runner.temp }}/openbot-node-release-${{ matrix.arch }}",
        ),
      ),
    /missing required fragment|broadens/,
  );
});

test("rejects moving action references and omitted attestations", () => {
  assert.throws(
    () =>
      validateNodeReleaseWorkflow(
        workflow.replace(
          "actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6",
          "actions/attest@v4",
        ),
      ),
    /exact attest pin/,
  );
  assert.throws(
    () =>
      validateNodeReleaseWorkflow(
        workflow.replace(
          / {6}- name: Attest archive SBOM[\s\S]*?(?= {6}- name: Upload archive for review)/,
          "",
        ),
      ),
    /missing|required|exact attest pin/,
  );
});

test("rejects omitted ancestry, repeat-build, or direct-upload gates", () => {
  assert.throws(
    () =>
      validateNodeReleaseWorkflow(
        workflow.replace(
          'git merge-base --is-ancestor "$GITHUB_SHA" refs/remotes/origin/main',
          'git merge-base --is-ancestor "$GITHUB_SHA" refs/remotes/origin/release',
        ),
      ),
    /missing required fragment/,
  );
  assert.throws(
    () =>
      validateNodeReleaseWorkflow(
        workflow.replace("npm run release:node-linux:archive --", "npm run omitted-archive --"),
      ),
    /construct each archive twice/,
  );
  assert.throws(
    () => validateNodeReleaseWorkflow(workflow.replace("          archive: false\n", "")),
    /directly upload all three/,
  );
  assert.throws(
    () =>
      validateNodeReleaseWorkflow(
        workflow.replace("npm run release:node-linux:smoke --", "npm run omitted-smoke --"),
      ),
    /missing required fragment|smoke-test/,
  );
});
