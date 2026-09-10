import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  DESKTOP_INSTALLER_FORMAT,
  hashInstaller,
  installerFileNames,
} from "../apps/desktop/scripts/installer-policy.mjs";
import { prepareDesktopRelease, validateDesktopReleaseRun } from "./prepare-desktop-release.mjs";

const sourceCommit = "a".repeat(40);
const version = "0.1.0-alpha.2";
const run = {
  repository: { full_name: "yxflc11/openbot" },
  path: ".github/workflows/ci.yml",
  event: "push",
  head_branch: "main",
  status: "completed",
  conclusion: "success",
  head_sha: sourceCommit,
};

test("release authority requires this repository's successful main push CI", () => {
  assert.equal(validateDesktopReleaseRun(run, "yxflc11/openbot"), sourceCommit);
  for (const changed of [
    { repository: { full_name: "someone/fork" } },
    { event: "pull_request" },
    { head_branch: "feature" },
    { status: "in_progress" },
    { conclusion: "failure" },
    { path: ".github/workflows/other.yml" },
    { head_sha: "main" },
  ])
    assert.throws(() => validateDesktopReleaseRun({ ...run, ...changed }, "yxflc11/openbot"));
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "openbot-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const inputDirectory = join(root, "downloads");
  await mkdir(inputDirectory);
  for (const [platform, arch] of [
    ["darwin", "arm64"],
    ["win32", "x64"],
    ["linux", "x64"],
  ]) {
    const directory = join(
      inputDirectory,
      `openbot-installers-${platform}-${arch}-${sourceCommit}`,
    );
    await mkdir(directory);
    const files = [];
    for (const name of installerFileNames(version, platform, arch)) {
      await writeFile(join(directory, name), `fixture-${platform}`);
      files.push({ name, ...(await hashInstaller(join(directory, name))) });
    }
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify({
        format: DESKTOP_INSTALLER_FORMAT,
        version,
        platform,
        arch,
        sourceCommit,
        signing: "unsigned-development",
        files,
      }),
    );
  }
  return { inputDirectory, outputDirectory: join(root, "release"), version, sourceCommit };
}

test("assembles four verified assets with a source-pinned manifest and checksums", async (t) => {
  const options = await fixture(t);
  assert.equal((await prepareDesktopRelease(options)).assetCount, 4);
  const manifest = JSON.parse(
    await readFile(join(options.outputDirectory, "desktop-manifest.json"), "utf8"),
  );
  assert.equal(manifest.sourceCommit, sourceCommit);
  assert.equal(manifest.targets.length, 3);
  assert.equal(
    (await readFile(join(options.outputDirectory, "SHA256SUMS"), "utf8")).trim().split("\n").length,
    4,
  );
  await assert.rejects(prepareDesktopRelease(options), { code: "EEXIST" });
});

test("does not assemble a partial, altered or wrong-commit release", async (t) => {
  const options = await fixture(t);
  const directory = join(options.inputDirectory, `openbot-installers-linux-x64-${sourceCommit}`);
  await writeFile(join(directory, installerFileNames(version, "linux", "x64")[0]), "tampered");
  await assert.rejects(prepareDesktopRelease(options), /checksum/u);
  await assert.rejects(
    prepareDesktopRelease({ ...options, sourceCommit: "b".repeat(40) }),
    /Missing/u,
  );
  await rm(directory, { recursive: true });
  await assert.rejects(prepareDesktopRelease(options), /Missing/u);
  await assert.rejects(readFile(join(options.outputDirectory, "desktop-manifest.json")), {
    code: "ENOENT",
  });
});

test("explicit Windows-only release requires and describes exactly the Windows artifact", async (t) => {
  const options = await fixture(t);
  for (const target of ["darwin-arm64", "linux-x64"])
    await rm(join(options.inputDirectory, `openbot-installers-${target}-${sourceCommit}`), {
      recursive: true,
    });
  await assert.rejects(prepareDesktopRelease(options), /Missing/u);
  assert.equal((await prepareDesktopRelease({ ...options, windowsOnly: true })).assetCount, 1);
  const manifest = JSON.parse(
    await readFile(join(options.outputDirectory, "desktop-manifest.json"), "utf8"),
  );
  assert.equal(manifest.targets.length, 1);
  assert.equal(manifest.targets[0].platform, "win32");
  assert.equal(manifest.targets[0].arch, "x64");
  assert.equal(
    (await readFile(join(options.outputDirectory, "SHA256SUMS"), "utf8")).trim().split("\n").length,
    1,
  );
});

test("Windows-only scope never bypasses missing, altered or swapped Windows artifacts", async (t) => {
  const options = await fixture(t);
  await assert.rejects(prepareDesktopRelease({ ...options, windowsOnly: "true" }), /boolean/u);
  const directory = join(options.inputDirectory, `openbot-installers-win32-x64-${sourceCommit}`);
  await writeFile(join(directory, installerFileNames(version, "win32", "x64")[0]), "tampered");
  await assert.rejects(prepareDesktopRelease({ ...options, windowsOnly: true }), /checksum/u);
  await rm(directory, { recursive: true });
  await assert.rejects(prepareDesktopRelease({ ...options, windowsOnly: true }), /Missing/u);
  await assert.rejects(readFile(join(options.outputDirectory, "desktop-manifest.json")), {
    code: "ENOENT",
  });
});

test("CLI accepts only the explicit final Windows flag and assembles its selected manifest", async (t) => {
  const options = await fixture(t);
  const runPath = join(options.inputDirectory, "run.json");
  await writeFile(runPath, JSON.stringify(run));
  const script = fileURLToPath(new URL("./prepare-desktop-release.mjs", import.meta.url));
  const args = [
    script,
    options.inputDirectory,
    options.outputDirectory,
    runPath,
    version,
    "yxflc11/openbot",
  ];
  await assert.rejects(promisify(execFile)(process.execPath, [...args, "--unknown"]), /Usage/u);
  await promisify(execFile)(process.execPath, [...args, "--windows-only"]);
  const manifest = JSON.parse(
    await readFile(join(options.outputDirectory, "desktop-manifest.json"), "utf8"),
  );
  assert.equal(manifest.targets.length, 1);
  assert.equal(manifest.targets[0].platform, "win32");
});
