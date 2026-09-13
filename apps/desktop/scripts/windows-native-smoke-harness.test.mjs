import { spawn } from "node:child_process";
import { once } from "node:events";
import { expect, it } from "vitest";
import {
  BASE_SMOKE_CHECKS,
  COLD_START_ROUNDS,
  assertNewProcessIdentity,
  assertPreviousChildrenEnded,
  buildFinalSmokeChecks,
  buildFinalSmokeReceipt,
  buildRoundSmokeReceipt,
  coldStartCheckName,
  createColdStartState,
  createLiveHarnessProcesses,
  createProcessIdentity,
  digestCiphertext,
  isColdStartState,
  isProcessAlive,
  isProcessIdentity,
  observeProcessIdentity,
  processIdentitiesEqual,
  readLinuxProcStartTimeToken,
  readPostmasterPid,
  stopProcessIfIdentityMatches,
} from "./windows-native-smoke-harness.mjs";

it("keeps historical smoke checks and requires exactly ten cold starts on the final receipt", () => {
  expect(COLD_START_ROUNDS).toBe(10);
  expect(BASE_SMOKE_CHECKS).toContain("postgresql");
  expect(BASE_SMOKE_CHECKS).toContain("cleanup");
  expect(buildFinalSmokeChecks({ coldStarts: 10 })).toEqual([
    ...BASE_SMOKE_CHECKS,
    "cold-start-10",
  ]);
  expect(buildFinalSmokeReceipt({ coldStarts: 10 }).checks.at(-1)).toBe("cold-start-10");
  expect(() => buildFinalSmokeReceipt({ coldStarts: 9 })).toThrow(/exactly 10/);
  expect(coldStartCheckName(10)).toBe("cold-start-10");
});

it("parses postmaster pid lines and rejects garbage", () => {
  expect(readPostmasterPid("4321\nC:\\fixture\\postgres\n100\n6543\n")).toBe(4321);
  expect(readPostmasterPid("not-a-pid\n")).toBeNull();
  expect(readPostmasterPid("")).toBeNull();
  expect(readLinuxProcStartTimeToken("1 (x) S 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 99 0")).toBe(
    "linux-ticks:99",
  );
});

it("treats only ESRCH as exited; EPERM must not look dead", () => {
  expect(isProcessAlive(process.pid)).toBe(true);
  expect(isProcessAlive(-1)).toBe(false);
  expect(isProcessAlive(2_147_483_647)).toBe(false);
  // PID 1 yields EPERM for unprivileged kill(pid,0) on Linux — must count as alive.
  if (process.platform === "linux") {
    expect(isProcessAlive(1)).toBe(true);
  }
});

it("compares cold-start identity by start time and path, not PID alone", () => {
  const first = createProcessIdentity({
    pid: 100,
    startTimeUtc: "2026-01-01T00:00:00.0000000Z",
    executablePath: "/tmp/a",
  });
  const reusedPidNewProcess = createProcessIdentity({
    pid: 100,
    startTimeUtc: "2026-01-02T00:00:00.0000000Z",
    executablePath: "/tmp/a",
  });
  const same = createProcessIdentity({
    pid: 100,
    startTimeUtc: "2026-01-01T00:00:00.0000000Z",
    executablePath: "/tmp/a",
  });
  expect(processIdentitiesEqual(first, same)).toBe(true);
  expect(processIdentitiesEqual(first, reusedPidNewProcess)).toBe(false);
  expect(() => assertNewProcessIdentity(first, same)).toThrow(/new process identity/);
  expect(() => assertNewProcessIdentity(first, reusedPidNewProcess)).not.toThrow();
  expect(() =>
    assertNewProcessIdentity(
      createProcessIdentity({ pid: 100, startTimeUtc: null, executablePath: null }),
      createProcessIdentity({ pid: 100, startTimeUtc: null, executablePath: null }),
    ),
  ).toThrow(/inconclusive/);
});

it("builds receipts with identity fields, login counts, and ciphertext digest only", () => {
  const electron = createProcessIdentity({
    pid: 11,
    startTimeUtc: "t1",
    executablePath: "/electron",
  });
  const receipt = buildRoundSmokeReceipt({
    mode: "cold-start",
    platform: "win32",
    arch: "x64",
    loginCount: 1,
    ciphertextDigest: digestCiphertext('{"fixture":true}'),
    electron,
    postgres: createProcessIdentity({ pid: 22, startTimeUtc: "t2", executablePath: "/postgres" }),
    server: createProcessIdentity({ pid: 33, startTimeUtc: "t3", executablePath: "/server" }),
    coldStartsCompleted: 3,
    checks: ["postgresql", "cold-start-3"],
  });
  expect(receipt.loginCount).toBe(1);
  expect(receipt.ciphertextDigest).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(receipt)).not.toContain("databasePassword");
  expect(receipt).not.toHaveProperty("encryptedBootstrap");
  expect(isProcessIdentity(receipt.electron)).toBe(true);
  const state = createColdStartState({
    encryptedBootstrap: '{"ciphertext":"fixture"}',
    electron,
    postgres: null,
    server: null,
    bootstrapComplete: true,
  });
  expect(isColdStartState(state)).toBe(true);
  expect(createLiveHarnessProcesses({ electron, postgres: null, server: null }).electron.pid).toBe(
    11,
  );
  expect(() => createColdStartState({ encryptedBootstrap: "" })).toThrow(/incomplete/);
});

it("spawns a real child and refuses to kill on wrong identity", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  try {
    await once(child, "spawn");
    expect(child.pid).toBeTypeOf("number");
    const identity = observeProcessIdentity(child.pid);
    expect(identity).not.toBeNull();
    expect(identity.pid).toBe(child.pid);
    expect(identity.startTimeUtc).toBeTruthy();

    const wrongStart = createProcessIdentity({
      pid: child.pid,
      startTimeUtc: "linux-ticks:1",
      executablePath: identity.executablePath ?? process.execPath,
    });
    const wrongPath = createProcessIdentity({
      pid: child.pid,
      startTimeUtc: identity.startTimeUtc,
      executablePath: "/definitely/not/this/binary",
    });
    expect(stopProcessIfIdentityMatches(wrongStart).reason).toBe("identity-mismatch");
    expect(stopProcessIfIdentityMatches(wrongPath).reason).toBe("identity-mismatch");
    expect(isProcessAlive(child.pid)).toBe(true);

    const matched = stopProcessIfIdentityMatches(identity, {
      stop: (pid) => process.kill(pid, "SIGTERM"),
    });
    expect(matched.stopped).toBe(true);
    await once(child, "exit");
    expect(isProcessAlive(child.pid)).toBe(false);

    expect(() =>
      assertPreviousChildrenEnded({
        electron: identity,
        postgres: null,
        server: null,
      }),
    ).not.toThrow();
  } finally {
    if (child.exitCode == null && child.signalCode == null) {
      child.kill("SIGKILL");
    }
  }
});

it("does not treat a living observer pid as ended when identity still matches", () => {
  const self = observeProcessIdentity(process.pid);
  expect(self).not.toBeNull();
  expect(() => assertPreviousChildrenEnded({ electron: self })).toThrow(/still alive/);
  expect(() =>
    assertPreviousChildrenEnded({
      electron: createProcessIdentity({
        pid: 2_147_483_647,
        startTimeUtc: "linux-ticks:0",
        executablePath: "/nope",
      }),
    }),
  ).not.toThrow();
});
