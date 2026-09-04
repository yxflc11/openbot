import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_ENTRY_URL,
  isDesktopAssetRequestMethod,
  resolveDesktopAssetPath,
} from "./local-content.js";

const rendererRoot = "/opt/openbot/dist/renderer";

describe("Desktop local content protocol", () => {
  it("maps application assets beneath the immutable renderer root", () => {
    expect(resolveDesktopAssetPath(rendererRoot, DESKTOP_ENTRY_URL)).toBe(
      join(rendererRoot, "index.html"),
    );
    expect(resolveDesktopAssetPath(rendererRoot, "openbot://app/assets/client.js?v=1#main")).toBe(
      join(rendererRoot, "assets", "client.js"),
    );
  });

  it("permits reads but rejects side-effecting protocol methods", () => {
    expect(isDesktopAssetRequestMethod("GET")).toBe(true);
    expect(isDesktopAssetRequestMethod("POST")).toBe(false);
    expect(isDesktopAssetRequestMethod("DELETE")).toBe(false);
  });

  it.each([
    "not a URL",
    "https://app/index.html",
    "openbot://other/index.html",
    "openbot://app/",
    "openbot://app/%2e%2e/secret.txt",
    "openbot://app/assets/%2Fetc%2Fpasswd",
    "openbot://app/assets/%5Cwindows.ini",
    "openbot://app/assets/%00secret",
    "openbot://app/assets/%E0%A4%A",
  ])("rejects an untrusted or escaping URL: %s", (requestUrl) => {
    expect(resolveDesktopAssetPath(rendererRoot, requestUrl)).toBeUndefined();
  });
});
