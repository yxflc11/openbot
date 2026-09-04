import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertLinuxInstallLease,
  enterLinuxInstallLease,
  withLinuxInstallLease,
} from "./node-linux-install-lease.mjs";

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
