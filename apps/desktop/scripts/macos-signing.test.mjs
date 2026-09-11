import { describe, expect, it } from "vitest";
import { macosSigningOptions } from "./macos-signing.mjs";
describe("explicit signed distribution prerequisites", () => {
  const env = {
    OPENBOT_DESKTOP_MACOS_SIGNING_IDENTITY: "Developer ID Application: Fixture (ABCDEFGHIJ)",
    OPENBOT_DESKTOP_MACOS_NOTARY_PROFILE: "openbot-notary",
  };
  it("keeps development packaging independent of distribution credentials", () => {
    expect(macosSigningOptions({}, "darwin")).toBeUndefined();
    expect(macosSigningOptions({}, "win32")).toBeUndefined();
  });
  it("fails closed for incomplete, wrong-platform, preview or ad hoc signing", () => {
    for (const invalid of [
      { OPENBOT_DESKTOP_MACOS_SIGNING_IDENTITY: env.OPENBOT_DESKTOP_MACOS_SIGNING_IDENTITY },
      { ...env, OPENBOT_DESKTOP_MACOS_SIGNING_IDENTITY: "-" },
    ])
      expect(() => macosSigningOptions(invalid, "darwin")).toThrow();
    expect(() => macosSigningOptions(env, "win32")).toThrow();
    expect(() => macosSigningOptions(env, "darwin", true)).toThrow();
  });
  it("uses the existing Packager signing and notary profile adapters with strict failure", () => {
    const options = macosSigningOptions(env, "darwin");
    expect(options.osxSign.continueOnError).toBe(false);
    expect(options.osxSign.optionsForFile().hardenedRuntime).toBe(true);
    expect(options.osxNotarize).toEqual({ keychainProfile: "openbot-notary" });
  });
});
