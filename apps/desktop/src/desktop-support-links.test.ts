import { describe, expect, it, vi } from "vitest";
import { openDesktopSupportLink } from "./desktop-support-links.js";
import { DESKTOP_ENTRY_URL } from "./local-content.js";

function credentialBearingTestUrl() {
  const url = new URL("https://github.com/yxflc11/openbot/issues/new");
  url.username = "user";
  url.password = "password";
  return url.href;
}

function source() {
  return {
    mainFrame: { url: DESKTOP_ENTRY_URL },
    isDestroyed: () => false,
    isLoadingMainFrame: () => false,
  };
}

describe("fixed Desktop support destinations", () => {
  it.each([
    "https://github.com/yxflc11/openbot#readme",
    "https://github.com/yxflc11/openbot/issues/new",
  ])("opens the reviewed public destination %s from current app contents", async (url) => {
    const current = source();
    const open = vi.fn(async () => undefined);
    await expect(openDesktopSupportLink(url, current, current, open)).resolves.toBe(true);
    expect(open).toHaveBeenCalledExactlyOnceWith(url);
  });

  it.each([
    "http://github.com/yxflc11/openbot#readme",
    "https://github.com/yxflc11/openbot#other",
    "https://github.com/yxflc11/openbot/issues/new?body=private",
    "https://github.com/yxflc11/openbot/issues/new#private",
    credentialBearingTestUrl(),
    "https://github.com:443/yxflc11/openbot/issues/new",
    "https://github.com.evil.example/yxflc11/openbot/issues/new",
    "https://github.com/yxflc11/openbot/issues/%6eew",
    "https://github.com/yxflc11/openbot/issues/new/",
    "https://github.com/yxflc11/openbot/../openbot/issues/new",
    "file:///tmp/openbot",
    "javascript:alert(1)",
    "mailto:private@example.com",
    " https://github.com/yxflc11/openbot#readme",
    "https://github.com/yxflc11/openbot#readme\n",
    "",
  ])("rejects an unreviewed destination without OS handoff: %s", async (url) => {
    const current = source();
    const open = vi.fn(async () => undefined);
    await expect(openDesktopSupportLink(url, current, current, open)).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects missing, stale, navigating, remote and destroyed source contents", async () => {
    const current = source();
    const stale = source();
    const remote = { ...source(), mainFrame: { url: "https://github.com/" } };
    const loading = { ...source(), isLoadingMainFrame: () => true };
    const destroyed = { ...source(), isDestroyed: () => true };
    const open = vi.fn(async () => undefined);
    for (const [sender, expected] of [
      [current, undefined],
      [stale, current],
      [remote, remote],
      [loading, loading],
      [destroyed, destroyed],
    ] as const) {
      await expect(
        openDesktopSupportLink("https://github.com/yxflc11/openbot#readme", sender, expected, open),
      ).resolves.toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });

  it("propagates OS handoff failure for the main process to display a fixed error", async () => {
    const current = source();
    const open = vi.fn(async () => {
      throw new Error("Browser unavailable");
    });
    await expect(
      openDesktopSupportLink("https://github.com/yxflc11/openbot#readme", current, current, open),
    ).rejects.toThrow("Browser unavailable");
    expect(open).toHaveBeenCalledTimes(1);
  });
});
