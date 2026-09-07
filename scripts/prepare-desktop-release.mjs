import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyInstallerManifest } from "../apps/desktop/scripts/installer-policy.mjs";

export function validateDesktopReleaseRun(run, repository) {
  if (
    run.repository?.full_name !== repository ||
    run.path !== ".github/workflows/ci.yml" ||
    run.event !== "push" ||
    run.head_branch !== "main" ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    !/^[a-f0-9]{40}$/u.test(run.head_sha)
  )
    throw new Error(
      "Desktop releases require a successful main-branch push CI run in this repository.",
    );
  return run.head_sha;
}

export async function prepareDesktopRelease({
  inputDirectory,
  outputDirectory,
  version,
  sourceCommit,
}) {
  const targets = ["darwin-arm64", "win32-x64", "linux-x64"];
  const children = await readdir(inputDirectory);
  const allFiles = [];
  const manifests = [];
  for (const target of targets) {
    const name = `openbot-installers-${target}-${sourceCommit}`;
    if (!children.includes(name))
      throw new Error(`Missing successful CI installer target: ${target}`);
    const directory = join(inputDirectory, name);
    const manifest = await verifyInstallerManifest(directory, { version, sourceCommit });
    if (`${manifest.platform}-${manifest.arch}` !== target)
      throw new Error("Installer target was swapped.");
    manifests.push(manifest);
    for (const file of manifest.files) allFiles.push({ ...file, directory });
  }
  // A release set is assembled only after every target and checksum has passed.
  await mkdir(outputDirectory, { recursive: false });
  for (const file of allFiles)
    await copyFile(join(file.directory, file.name), join(outputDirectory, file.name));
  await writeFile(
    join(outputDirectory, "SHA256SUMS"),
    allFiles.map((file) => `${file.sha256}  ${file.name}\n`).join(""),
  );
  await writeFile(
    join(outputDirectory, "desktop-manifest.json"),
    `${JSON.stringify({ version, sourceCommit, targets: manifests }, null, 2)}\n`,
  );
  return { version, sourceCommit, assetCount: allFiles.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, runPath, version, repository] = process.argv.slice(2);
  if (!input || !output || !runPath || !version || !repository || process.argv.length !== 7) {
    throw new Error(
      "Usage: prepare-desktop-release <downloads> <new-output-dir> <run-json> <version> <owner/repo>",
    );
  }
  const sourceCommit = validateDesktopReleaseRun(
    JSON.parse(await readFile(runPath, "utf8")),
    repository,
  );
  console.info(
    await prepareDesktopRelease({
      inputDirectory: resolve(input),
      outputDirectory: resolve(output),
      version,
      sourceCommit,
    }),
  );
}
