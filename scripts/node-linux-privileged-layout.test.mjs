import assert from "node:assert/strict";
import test from "node:test";
import {
  LINUX_PRIVILEGED_INSTALL_LAYOUT,
  validateLinuxPrivilegedLayoutSnapshot,
  validateLinuxPrivilegedRuntime,
} from "./node-linux-privileged-layout.mjs";

const expectedPaths = [
  "/",
  "/opt",
  LINUX_PRIVILEGED_INSTALL_LAYOUT.installRoot,
  LINUX_PRIVILEGED_INSTALL_LAYOUT.stagingRoot,
  LINUX_PRIVILEGED_INSTALL_LAYOUT.versionsRoot,
  "/var",
  "/var/lib",
  LINUX_PRIVILEGED_INSTALL_LAYOUT.stateRoot,
  LINUX_PRIVILEGED_INSTALL_LAYOUT.importsRoot,
];

test("accepts only the fixed root Linux runtime and install layout", () => {
  assert.doesNotThrow(() =>
    validateLinuxPrivilegedRuntime({
      effectiveGroupId: 0,
      effectiveUserId: 0,
      platform: "linux",
    }),
  );
  assert.deepEqual(
    validateLinuxPrivilegedLayoutSnapshot(validSnapshot()),
    LINUX_PRIVILEGED_INSTALL_LAYOUT,
  );
});

test("rejects non-root, non-Linux, symlinked, and non-root-owned layouts", () => {
  assert.throws(
    () =>
      validateLinuxPrivilegedRuntime({
        effectiveGroupId: 20,
        effectiveUserId: 501,
        platform: "darwin",
      }),
    /run as root on Linux/,
  );

  for (const change of [
    { path: "/opt", value: metadata({ symbolicLink: true }) },
    { path: LINUX_PRIVILEGED_INSTALL_LAYOUT.installRoot, value: metadata({ uid: 1000 }) },
    { path: LINUX_PRIVILEGED_INSTALL_LAYOUT.stateRoot, value: metadata({ gid: 1000 }) },
  ]) {
    const snapshot = validSnapshot();
    snapshot[change.path] = change.value;
    assert.throws(() => validateLinuxPrivilegedLayoutSnapshot(snapshot), /root-owned directory/);
  }
});

test("rejects writable ancestors and exact child-mode drift", () => {
  const writableAncestor = validSnapshot();
  writableAncestor["/var/lib"] = metadata({ mode: 0o775 });
  assert.throws(
    () => validateLinuxPrivilegedLayoutSnapshot(writableAncestor),
    /writable or inaccessible/,
  );

  const publicState = validSnapshot();
  publicState[LINUX_PRIVILEGED_INSTALL_LAYOUT.stateRoot] = metadata({ mode: 0o755 });
  assert.throws(
    () => validateLinuxPrivilegedLayoutSnapshot(publicState),
    /wrong mode/,
  );
});

test("rejects unknown paths and cross-filesystem staging or imports", () => {
  assert.throws(
    () => validateLinuxPrivilegedLayoutSnapshot({ ...validSnapshot(), "/tmp": metadata() }),
    /missing or unknown/,
  );

  const crossInstall = validSnapshot();
  crossInstall[LINUX_PRIVILEGED_INSTALL_LAYOUT.stagingRoot] = metadata({ dev: 2, mode: 0o700 });
  assert.throws(
    () => validateLinuxPrivilegedLayoutSnapshot(crossInstall),
    /share the install filesystem/,
  );

  const crossState = validSnapshot();
  crossState[LINUX_PRIVILEGED_INSTALL_LAYOUT.importsRoot] = metadata({ dev: 3, mode: 0o700 });
  assert.throws(
    () => validateLinuxPrivilegedLayoutSnapshot(crossState),
    /share one filesystem/,
  );
});

function validSnapshot() {
  return Object.fromEntries(
    expectedPaths.map((entryPath) => [entryPath, metadata({ mode: expectedMode(entryPath) })]),
  );
}

function expectedMode(entryPath) {
  if (
    entryPath === LINUX_PRIVILEGED_INSTALL_LAYOUT.stagingRoot ||
    entryPath === LINUX_PRIVILEGED_INSTALL_LAYOUT.stateRoot ||
    entryPath === LINUX_PRIVILEGED_INSTALL_LAYOUT.importsRoot
  ) {
    return 0o700;
  }
  return 0o755;
}

function metadata({ dev = 1, directory = true, gid = 0, mode = 0o755, symbolicLink = false, uid = 0 } = {}) {
  return {
    dev,
    gid,
    isDirectory: () => directory,
    isSymbolicLink: () => symbolicLink,
    mode,
    uid,
  };
}
