import { expect, it } from "vitest";
import {
  BASE_SMOKE_CHECKS,
  COLD_START_ROUNDS,
  EXPECTED_FINAL_CHECKS_JOINED,
  assertNewProcessIdentity,
  assertPreviousChildrenEnded,
  buildFinalSmokeChecks,
  buildFinalSmokeReceipt,
  coldStartCheckName,
  createColdStartState,
  isColdStartState,
  isProcessAlive,
  readPostmasterPid,
} from "./windows-native-smoke-harness.mjs";

it("keeps the historical smoke check inventory and appends cold-start-10", () => {
  expect(COLD_START_ROUNDS).toBe(10);
  expect(BASE_SMOKE_CHECKS).toEqual([
    "postgresql",
    "migrations",
    "dpapi",
    "owner-login",
    "retained-data",
    "stop",
    "restart",
    "cleanup",
  ]);
  expect(EXPECTED_FINAL_CHECKS_JOINED).toBe(
    "postgresql,migrations,dpapi,owner-login,retained-data,stop,restart,cleanup,cold-start-10",
  );
  expect(buildFinalSmokeReceipt({ coldStarts: 10 }).checks).toEqual([
    ...BASE_SMOKE_CHECKS,
    "cold-start-10",
  ]);
  expect(() => buildFinalSmokeReceipt({ coldStarts: 9 })).toThrow(/exactly 10/);
});

it("parses postmaster pid lines and rejects garbage", () => {
  expect(readPostmasterPid("4321\nC:\\fixture\\postgres\n100\n6543\n")).toBe(4321);
  expect(readPostmasterPid("not-a-pid\n")).toBeNull();
  expect(readPostmasterPid("")).toBeNull();
});

it("detects living and dead process identities with process.kill(pid, 0)", () => {
  expect(isProcessAlive(process.pid)).toBe(true);
  expect(isProcessAlive(-1)).toBe(false);
  expect(isProcessAlive(2_147_483_647)).toBe(false);
  expect(() => assertNewProcessIdentity(100, 100)).toThrow(/new process identity/);
  expect(() => assertNewProcessIdentity(100, 101)).not.toThrow();
  expect(() => assertPreviousChildrenEnded({ electronPid: process.pid })).toThrow(
    /still alive/,
  );
  expect(() =>
    assertPreviousChildrenEnded({
      electronPid: 2_147_483_647,
      postgresPid: null,
      serverPid: null,
    }),
  ).not.toThrow();
});

it("validates and constructs cold-start state without secrets beyond ciphertext bytes", () => {
  const state = createColdStartState({
    encryptedBootstrap: '{"ciphertext":"fixture"}',
    electronPid: 11,
    postgresPid: 22,
    serverPid: 33,
    bootstrapComplete: true,
  });
  expect(isColdStartState(state)).toBe(true);
  expect(state.smokeMarker).toContain("retained");
  expect(coldStartCheckName(10)).toBe("cold-start-10");
  expect(buildFinalSmokeChecks({ coldStarts: 0 })).toEqual([...BASE_SMOKE_CHECKS]);
  expect(() => createColdStartState({ encryptedBootstrap: "" })).toThrow(/incomplete/);
  expect(isColdStartState({ schemaVersion: 1 })).toBe(false);
});
