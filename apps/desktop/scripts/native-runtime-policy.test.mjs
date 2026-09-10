import { expect, it } from "vitest";
import { nativeOptionalPackageApplies } from "./native-runtime-policy.mjs";

it("selects only the target-specific optional native library and honors npm exclusions", () => {
  expect(nativeOptionalPackageApplies({ os: ["win32"], cpu: ["x64"] }, "win32", "x64")).toBe(true);
  expect(nativeOptionalPackageApplies({ os: ["darwin"], cpu: ["arm64"] }, "win32", "x64")).toBe(
    false,
  );
  expect(nativeOptionalPackageApplies({ os: ["!win32"] }, "win32", "x64")).toBe(false);
  expect(nativeOptionalPackageApplies({}, "win32", "x64")).toBe(true);
  expect(() => nativeOptionalPackageApplies({ os: "win32" }, "win32", "x64")).toThrow();
});
