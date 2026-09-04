import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ATTEST_PIN = "actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6";
const UPLOAD_PIN = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";

export function validateNodeReleaseWorkflow(workflow) {
  const requiredFragments = [
    "name: Node Linux provenance",
    'tags:\n      - "node-v*"',
    "permissions:\n  contents: read\n  id-token: write\n  attestations: write",
    "group: node-linux-provenance-$" + "{{ github.ref }}",
    "cancel-in-progress: false",
    "runs-on: $" + "{{ matrix.runner }}",
    "RELEASE_ROOT: $" + "{{ github.workspace }}-node-release-${{ matrix.arch }}",
    "timeout-minutes: 30",
    "fail-fast: false",
    "- arch: x64\n            runner: ubuntu-24.04",
    "- arch: arm64\n            runner: ubuntu-24.04-arm",
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
    "fetch-depth: 0",
    "persist-credentials: false",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "node-version: 22.22.2",
    'git merge-base --is-ancestor "$GITHUB_SHA" refs/remotes/origin/main',
    "https://nodejs.org/dist/v22.22.2/node-v22.22.2-linux-$" + "{RELEASE_ARCH}.tar.xz",
    "npm@10.9.9",
    "d60fba8cb42f688b81e33c2f1cbef2ad7b977166700ec0ad057f1b6d60ea6ef2524abf673e20c35931cd8305d1dbb8887134d6eefdc0e7b8435bd458bf65b862",
    "npm run release:node-linux:candidate --",
    "npm run release:node-linux:archive --",
    "--dpkg-query /usr/bin/dpkg-query",
    "--gnu-tar /usr/bin/tar",
    "--xz /usr/bin/xz",
    'cmp "$RELEASE_ROOT/archives-1/$artifact" "$RELEASE_ROOT/archives-2/$artifact"',
    'sha256sum --check "$artifact.SHA256SUMS"',
    '/usr/bin/xz --test "$artifact"',
    "name: Smoke packaged runtime on matching architecture",
    "npm run release:node-linux:smoke --",
    "name: Attest build provenance",
    "name: Attest archive SBOM",
    "sbom-path:",
    "if-no-files-found: error",
    "retention-days: 14",
    "overwrite: false",
    "archive: false",
  ];
  for (const fragment of requiredFragments) {
    if (!workflow.includes(fragment)) {
      throw new Error(`Node release workflow is missing required fragment: ${fragment}`);
    }
  }

  if ((workflow.match(new RegExp(escapeRegExp(ATTEST_PIN), "g")) ?? []).length !== 2) {
    throw new Error("Node release workflow must use the exact attest pin twice.");
  }
  if ((workflow.match(new RegExp(escapeRegExp(UPLOAD_PIN), "g")) ?? []).length !== 3) {
    throw new Error("Node release workflow must use the exact upload pin three times.");
  }
  if ((workflow.match(/npm run release:node-linux:archive --/g) ?? []).length !== 2) {
    throw new Error("Node release workflow must construct each archive twice.");
  }
  if ((workflow.match(/archive: false/g) ?? []).length !== 3) {
    throw new Error("Node release workflow must directly upload all three review files.");
  }
  if ((workflow.match(/npm run release:node-linux:smoke --/g) ?? []).length !== 1) {
    throw new Error("Node release workflow must smoke-test each native matrix package.");
  }

  const compare = workflow.indexOf("Build twice and require byte-identical archives");
  const smoke = workflow.indexOf("name: Smoke packaged runtime on matching architecture");
  const attest = workflow.indexOf("name: Attest build provenance");
  const upload = workflow.indexOf("name: Upload archive for review");
  if (compare === -1 || smoke <= compare || attest <= smoke || upload <= attest) {
    throw new Error(
      "Node release workflow must compare, smoke, attest, then upload in that order.",
    );
  }

  if (
    /workflow_dispatch:|pull_request:|branches:|contents: write|packages: write|continue-on-error:|uses: [^\n]+@(v|main\b)|gh release|create-release|softprops\/action-gh-release|push-to-registry:\s*true|RELEASE_ROOT:\s*\$\{\{ runner\./.test(
      workflow,
    )
  ) {
    throw new Error(
      "Node release workflow broadens its trigger, authority, action pins, or output.",
    );
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const workflow = await readFile(
    new URL("../.github/workflows/node-linux-release.yml", import.meta.url),
    "utf8",
  );
  validateNodeReleaseWorkflow(workflow);
  console.info("Node Linux release workflow checks passed.");
}
