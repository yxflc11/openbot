import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertLinuxInstallLease,
  discardIncompleteLock,
  enterLinuxInstallLease,
  withLinuxInstallLease,
} from "./node-linux-install-lease.mjs";

const TOKEN_NAME = "lease.token";
const TOKEN_BYTES = 32;

test("holds one private directory lease across nested installer operations", async () => {
  const stateRoot = await createStateRoot();
  const lockPath = path.join(stateRoot, "transaction.lock");

  await withLinuxInstallLease({ stateRoot }, async (lease) => {
    assert.equal((await lstat(lockPath)).isDirectory(), true);
    await assertLinuxInstallLease(lease, stateRoot);
    const leaveNestedOperation = await enterLinuxInstallLease(stateRoot, lease);
    await leaveNestedOperation();
    assert.equal((await lstat(lockPath)).isDirectory(), true);
  });

  await assert.rejects(lstat(lockPath), { code: "ENOENT" });
});

test("an operation without an outer lease acquires and releases its own lock", async () => {
  const stateRoot = await createStateRoot();
  const lockPath = path.join(stateRoot, "transaction.lock");

  const leave = await enterLinuxInstallLease(stateRoot);
  assert.equal((await lstat(lockPath)).isDirectory(), true);
  await leave();

  await assert.rejects(lstat(lockPath), { code: "ENOENT" });
});

test("rejects forged, released, cross-root, and concurrent leases", async () => {
  const stateRoot = await createStateRoot();
  const otherRoot = await createStateRoot();
  let released;

  await withLinuxInstallLease({ stateRoot }, async (lease) => {
    released = lease;
    await assert.rejects(assertLinuxInstallLease({}, stateRoot), /forged/);
    await assert.rejects(assertLinuxInstallLease(lease, otherRoot), /another root/);
    await assert.rejects(
      withLinuxInstallLease({ stateRoot }, async () => undefined),
      /stale lock exists/,
    );
  });

  await assert.rejects(assertLinuxInstallLease(released, stateRoot), /released/);
});

test("does not remove a lock directory that was replaced while held", async () => {
  const stateRoot = await createStateRoot();
  const lockPath = path.join(stateRoot, "transaction.lock");

  await assert.rejects(
    withLinuxInstallLease({ stateRoot }, async () => {
      await rmdirAndReplace(lockPath);
    }),
    /removed or replaced/,
  );

  assert.equal((await lstat(lockPath)).isDirectory(), true);
});

test("release refuses a same-length nonce rewrite and retains the replacement token", async () => {
  const stateRoot = await createStateRoot();
  const lockPath = path.join(stateRoot, "transaction.lock");
  const tokenPath = path.join(lockPath, TOKEN_NAME);
  const replacement = randomBytes(TOKEN_BYTES);

  await assert.rejects(
    withLinuxInstallLease({ stateRoot }, async () => {
      const handle = await open(tokenPath, "r+");
      await handle.write(replacement, 0, TOKEN_BYTES, 0);
      await handle.sync();
      await handle.close();
    }),
    /removed or replaced/,
  );

  assert.equal((await lstat(lockPath)).isDirectory(), true);
  assert.equal((await lstat(tokenPath)).isFile(), true);
  assert.deepEqual(await readFile(tokenPath), replacement);
});

test("release refuses a token path replaced by a symlink without deleting the target", async () => {
  const stateRoot = await createStateRoot();
  const lockPath = path.join(stateRoot, "transaction.lock");
  const tokenPath = path.join(lockPath, TOKEN_NAME);
  const targetPath = path.join(stateRoot, "foreign-token");
  const foreign = randomBytes(TOKEN_BYTES);
  await writeFile(targetPath, foreign, { mode: 0o600 });

  await assert.rejects(
    withLinuxInstallLease({ stateRoot }, async () => {
      await rm(tokenPath);
      await symlink(targetPath, tokenPath);
    }),
    /removed or replaced/,
  );

  assert.equal((await lstat(tokenPath)).isSymbolicLink(), true);
  assert.deepEqual(await readFile(targetPath), foreign);
  assert.equal((await lstat(lockPath)).isDirectory(), true);
});

test("discardIncompleteLock retains a foreign token and refuses unsafe cleanup", async () => {
  const stateRoot = await createStateRoot();
  const lockPath = path.join(stateRoot, "transaction.lock");
  const tokenPath = path.join(lockPath, TOKEN_NAME);
  await mkdir(lockPath, { mode: 0o700 });
  const foreign = randomBytes(TOKEN_BYTES);
  await writeFile(tokenPath, foreign, { mode: 0o600 });

  await assert.rejects(
    discardIncompleteLock(lockPath, tokenPath, undefined),
    /could not be removed safely/,
  );
  assert.deepEqual(await readFile(tokenPath), foreign);

  const claimed = randomBytes(TOKEN_BYTES);
  await assert.rejects(
    discardIncompleteLock(lockPath, tokenPath, claimed),
    /owned token cleanup is unsafe/,
  );
  assert.deepEqual(await readFile(tokenPath), foreign);

  const symlinkTarget = path.join(stateRoot, "symlink-target-token");
  await writeFile(symlinkTarget, foreign, { mode: 0o600 });
  await rm(tokenPath);
  await symlink(symlinkTarget, tokenPath);
  await assert.rejects(
    discardIncompleteLock(lockPath, tokenPath, claimed),
    /owned token cleanup is unsafe/,
  );
  assert.equal((await lstat(tokenPath)).isSymbolicLink(), true);
  assert.deepEqual(await readFile(symlinkTarget), foreign);
});

async function createStateRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "openbot-linux-lease-test-"));
  const stateRoot = path.join(root, "state");
  await mkdir(stateRoot, { mode: 0o700 });
  return stateRoot;
}

async function rmdirAndReplace(lockPath) {
  await rm(lockPath, { recursive: true });
  await mkdir(lockPath, { mode: 0o700 });
}
