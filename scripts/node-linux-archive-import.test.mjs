import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  importLinuxReleaseArchive,
  LINUX_ARCHIVE_IMPORT_BOUNDS,
  removeImportedLinuxReleaseArchive,
} from "./node-linux-archive-import.mjs";
import { withLinuxInstallLease } from "./node-linux-install-lease.mjs";

const importIds = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
];

test("imports and removes exact bytes only while the private lease is held", async () => {
  const fixture = await createFixture();
  const sourcePath = await createSparseArchive(fixture.root, "source.tar.xz");

  await withLinuxInstallLease({ stateRoot: fixture.stateRoot }, async (installLease) => {
    const imported = await importLinuxReleaseArchive({
      importId: importIds[0],
      installLease,
      sourcePath,
      stateRoot: fixture.stateRoot,
    });
    const metadata = await lstat(imported.archivePath);
    assert.equal(imported.size, LINUX_ARCHIVE_IMPORT_BOUNDS.minimumBytes);
    assert.match(imported.archiveSha256, /^[0-9a-f]{64}$/u);
    assert.equal(metadata.mode & 0o777, 0o600);
    assert.equal(metadata.nlink, 1);
    assert.deepEqual(await readFile(imported.archivePath), await readFile(sourcePath));

    await removeImportedLinuxReleaseArchive({
      archivePath: imported.archivePath,
      archiveSha256: imported.archiveSha256,
      installLease,
      stateRoot: fixture.stateRoot,
    });
  });

  assert.deepEqual(await readdir(fixture.importsRoot), []);
});

test("rejects symlink, undersized, and changed sources before retaining an import", async () => {
  const fixture = await createFixture();
  const sourcePath = await createSparseArchive(fixture.root, "source.tar.xz");
  const sourceLink = path.join(fixture.root, "source-link.tar.xz");
  await symlink(sourcePath, sourceLink);

  await withLinuxInstallLease({ stateRoot: fixture.stateRoot }, async (installLease) => {
    await assert.rejects(
      importLinuxReleaseArchive({
        importId: importIds[0],
        installLease,
        sourcePath: sourceLink,
        stateRoot: fixture.stateRoot,
      }),
      /reviewed-size regular file/,
    );

    const undersized = path.join(fixture.root, "small.tar.xz");
    await writeFile(undersized, "small");
    await assert.rejects(
      importLinuxReleaseArchive({
        importId: importIds[0],
        installLease,
        sourcePath: undersized,
        stateRoot: fixture.stateRoot,
      }),
      /reviewed-size regular file/,
    );

    const hostileOpen = async (filePath, flags, mode) => {
      const handle = await open(filePath, flags, mode);
      if (filePath === sourcePath && flags === "r") {
        const writer = await open(sourcePath, "r+");
        await writer.write(Buffer.from([1]), 0, 1, 0);
        await writer.close();
      }
      return handle;
    };
    await assert.rejects(
      importLinuxReleaseArchive({
        importId: importIds[1],
        installLease,
        openFile: hostileOpen,
        sourcePath,
        stateRoot: fixture.stateRoot,
      }),
      /changed while it was opened/,
    );
  });

  assert.deepEqual(await readdir(fixture.importsRoot), []);
});

test("exclusive import never overwrites an existing private path", async () => {
  const fixture = await createFixture();
  const sourcePath = await createSparseArchive(fixture.root, "source.tar.xz");
  const destination = path.join(
    fixture.importsRoot,
    `openbot-node-import-${importIds[0]}.tar.xz`,
  );
  await writeFile(destination, "keep", { mode: 0o600 });

  await withLinuxInstallLease({ stateRoot: fixture.stateRoot }, async (installLease) => {
    await assert.rejects(
      importLinuxReleaseArchive({
        importId: importIds[0],
        installLease,
        sourcePath,
        stateRoot: fixture.stateRoot,
      }),
      { code: "EEXIST" },
    );
  });

  assert.equal(await readFile(destination, "utf8"), "keep");
});

test("cleanup preserves imported bytes when the expected digest is wrong", async () => {
  const fixture = await createFixture();
  const sourcePath = await createSparseArchive(fixture.root, "source.tar.xz");

  await withLinuxInstallLease({ stateRoot: fixture.stateRoot }, async (installLease) => {
    const imported = await importLinuxReleaseArchive({
      importId: importIds[0],
      installLease,
      sourcePath,
      stateRoot: fixture.stateRoot,
    });
    await assert.rejects(
      removeImportedLinuxReleaseArchive({
        archivePath: imported.archivePath,
        archiveSha256: "0".repeat(64),
        installLease,
        stateRoot: fixture.stateRoot,
      }),
      /does not match/,
    );
    assert.equal((await lstat(imported.archivePath)).isFile(), true);
  });
});

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "openbot-linux-import-test-"));
  const stateRoot = path.join(root, "state");
  const importsRoot = path.join(stateRoot, "imports");
  await mkdir(importsRoot, { recursive: true, mode: 0o700 });
  return { importsRoot, root, stateRoot };
}

async function createSparseArchive(root, name) {
  const sourcePath = path.join(root, name);
  const handle = await open(sourcePath, "wx", 0o600);
  await handle.truncate(LINUX_ARCHIVE_IMPORT_BOUNDS.minimumBytes);
  await handle.write(Buffer.from("openbot-import-test"), 0, 19, 0);
  await handle.close();
  return sourcePath;
}
