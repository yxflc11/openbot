import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  verifyWindowsPrivateDirectory,
  windowsNativeEnvironment,
} from "./windows-native-security.js";

describe("Windows native runtime boundary", () => {
  it("retains required OS paths without forwarding injection or model credentials", () => {
    expect(
      windowsNativeEnvironment({
        SystemRoot: "C:\\Windows",
        TEMP: "C:\\Temp",
        NODE_OPTIONS: "--require attacker",
        OPENAI_API_KEY: "secret",
        PATH: "C:\\attacker",
      }),
    ).toEqual({
      SystemRoot: "C:\\Windows",
      WINDIR: "C:\\Windows",
      COMSPEC: "C:\\Windows\\System32\\cmd.exe",
      PATH: "C:\\Windows\\System32",
      TEMP: "C:\\Temp",
      LANG: "C",
      LC_ALL: "C",
    });
  });
  it.each([undefined, "relative", "C:\\Windows\nforged", "\\\\server\\Windows"])(
    "rejects unsafe Windows system root %s",
    (SystemRoot) => {
      expect(() => windowsNativeEnvironment({ SystemRoot })).toThrow();
    },
  );
  it.skipIf(process.platform !== "win32")(
    "protects a newly created directory and validates its retained DACL",
    async () => {
      const parent = await mkdtemp(join(tmpdir(), "openbot-acl-"));
      const directory = join(parent, "private ' literal & folder");
      try {
        await mkdir(directory);
        await verifyWindowsPrivateDirectory(directory, true);
        await verifyWindowsPrivateDirectory(directory, false);
        const child = join(directory, "inherited");
        await mkdir(child);
        await verifyWindowsPrivateDirectory(child, true);
        await verifyWindowsPrivateDirectory(child, false);
      } finally {
        await rm(parent, { recursive: true, force: true });
      }
    },
    // Four real PowerShell checks, each with its own 15-second production deadline.
    65_000,
  );
  it.skipIf(process.platform === "win32")(
    "cannot simulate a successful Windows ACL check on another OS",
    async () => {
      await expect(verifyWindowsPrivateDirectory("C:\\untrusted", false)).rejects.toThrow(
        "require Windows",
      );
    },
  );
});
