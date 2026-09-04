import { describe, expect, it } from "vitest";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { join, resolve } from "node:path";
import {
  createDesktopFuseConfig,
  DESKTOP_WINDOWS_METADATA,
  packagedElectronTarget,
  shouldIgnoreDesktopSource,
} from "./package-policy.mjs";

describe("Desktop package source policy", () => {
  const appRoot = resolve("workspace", "apps", "desktop");

  it.each([
    ["package.json", false],
    [join("dist", "main.js"), false],
    [join("dist", "renderer", "index.html"), false],
    [join("src", "main.ts"), true],
    [join("scripts", "package.mjs"), true],
    [join("node_modules", ".vite", "results.json"), true],
    [join("out", "OpenBot.app"), true],
  ])("applies the package allowlist to %s", (candidate, ignored) => {
    expect(shouldIgnoreDesktopSource(appRoot, join(appRoot, candidate))).toBe(ignored);
  });

  it("accepts Packager's slash-relative callback paths", () => {
    expect(shouldIgnoreDesktopSource(appRoot, "/package.json")).toBe(false);
    expect(shouldIgnoreDesktopSource(appRoot, "/dist/main.js")).toBe(false);
    expect(shouldIgnoreDesktopSource(appRoot, "/node_modules/.vite/results.json")).toBe(true);
  });

  it("normalizes callback paths independently of the CI host separator", () => {
    expect(shouldIgnoreDesktopSource(appRoot, "\\package.json")).toBe(false);
    expect(shouldIgnoreDesktopSource(appRoot, "\\dist\\renderer\\index.html")).toBe(false);
    expect(shouldIgnoreDesktopSource(appRoot, "\\src\\main.ts")).toBe(true);
  });

  it("fails closed for paths outside the Desktop workspace", () => {
    expect(shouldIgnoreDesktopSource(appRoot, join(appRoot, "..", "web", "dist"))).toBe(true);
    expect(shouldIgnoreDesktopSource(appRoot, "/dist/../src/main.ts")).toBe(true);
    expect(shouldIgnoreDesktopSource(appRoot, "\\dist\\..\\src\\main.ts")).toBe(true);
  });

  it("maps the three declared platforms without inventing another target", () => {
    expect(packagedElectronTarget("/tmp/OpenBot-darwin-arm64", "darwin")).toMatch(/OpenBot\.app$/u);
    expect(packagedElectronTarget("/tmp/OpenBot-win32-x64", "win32")).toMatch(/openbot\.exe$/u);
    expect(packagedElectronTarget("/tmp/OpenBot-linux-x64", "linux")).toMatch(/openbot$/u);
    expect(() => packagedElectronTarget("/tmp/OpenBot", "freebsd")).toThrow(/Unsupported/u);
  });

  it("declares neutral Windows executable metadata without inventing a company", () => {
    expect(DESKTOP_WINDOWS_METADATA).toEqual({ CompanyName: "OpenBot contributors" });
    expect(Object.isFrozen(DESKTOP_WINDOWS_METADATA)).toBe(true);
  });

  it("requires every known fuse and does not request a missing custom V8 snapshot", () => {
    const fuses = createDesktopFuseConfig("darwin", "arm64");

    expect(fuses.version).toBe(FuseVersion.V1);
    expect(fuses.strictlyRequireAllFuses).toBe(true);
    expect(fuses.resetAdHocDarwinSignature).toBe(true);
    expect(fuses[FuseV1Options.RunAsNode]).toBe(false);
    expect(fuses[FuseV1Options.EnableCookieEncryption]).toBe(true);
    expect(fuses[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(false);
    expect(fuses[FuseV1Options.EnableNodeCliInspectArguments]).toBe(false);
    expect(fuses[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(true);
    expect(fuses[FuseV1Options.OnlyLoadAppFromAsar]).toBe(true);
    expect(fuses[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]).toBe(false);
    expect(fuses[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(false);
    expect(fuses[FuseV1Options.WasmTrapHandlers]).toBe(false);
  });
});
