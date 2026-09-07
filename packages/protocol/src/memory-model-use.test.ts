import { describe, expect, it } from "vitest";
import { createEmployeeMemoryInputSchema, updateEmployeeMemoryInputSchema } from "./index.js";

const memory = {
  kind: "semantic",
  title: "Fact",
  content: "Known fact",
  sensitivity: "internal",
  portability: "never",
};
describe("explicit memory model sharing", () => {
  it("keeps old create inputs valid without implicitly enabling sharing", () => {
    expect(createEmployeeMemoryInputSchema.parse(memory).modelUseEnabled).toBeUndefined();
    expect(
      createEmployeeMemoryInputSchema.parse({ ...memory, modelUseEnabled: true }).modelUseEnabled,
    ).toBe(true);
  });
  it("rejects sharing confidential, restricted and secret-reference records", () => {
    for (const patch of [
      { sensitivity: "confidential" },
      { sensitivity: "restricted" },
      { kind: "secret-reference", sensitivity: "restricted" },
    ])
      expect(
        createEmployeeMemoryInputSchema.safeParse({ ...memory, ...patch, modelUseEnabled: true })
          .success,
      ).toBe(false);
  });
  it("allows revision-bound revoke without unrelated edits and rejects unknown authority fields", () => {
    expect(
      updateEmployeeMemoryInputSchema.parse({ expectedRevision: 2, modelUseEnabled: false }),
    ).toEqual({ expectedRevision: 2, modelUseEnabled: false });
    expect(
      updateEmployeeMemoryInputSchema.safeParse({
        expectedRevision: 2,
        modelUseEnabled: true,
        force: true,
      }).success,
    ).toBe(false);
  });
});
