import { describe, expect, it } from "vitest";
import { DesktopMicrophonePolicy } from "./microphone-policy.js";

const request = {
  contentsId: 7,
  permission: "media",
  requestingUrl: "openbot://app/index.html",
  isMainFrame: true,
  mediaTypes: ["audio"],
};
describe("Desktop microphone permission", () => {
  it("requires an explicit unexpired lease and revokes acquisition independently of tracks", () => {
    let now = 0;
    const policy = new DesktopMicrophonePolicy(() => now);
    expect(policy.allows(request)).toBe(false);
    policy.arm(7);
    expect(policy.allows(request)).toBe(true);
    now = 10_000;
    expect(policy.allows(request)).toBe(false);
    policy.arm(7);
    policy.revoke();
    expect(policy.allows(request)).toBe(false);
  });
  it("does not rearm when permission completes after cancellation or navigation", () => {
    const policy = new DesktopMicrophonePolicy();
    const generation = policy.beginAttempt();
    policy.revoke();
    expect(policy.arm(7, generation)).toBe(false);
    expect(policy.allows(request)).toBe(false);
    const current = policy.beginAttempt();
    expect(policy.arm(7, current)).toBe(true);
  });
  it.each([
    { contentsId: 8 },
    { contentsId: undefined },
    { permission: "display-capture" },
    { permission: "clipboard-read" },
    { requestingUrl: "https://example.com/" },
    { requestingUrl: "openbot://app/plugin.html" },
    { isMainFrame: false },
    { mediaTypes: ["video"] },
    { mediaTypes: ["audio", "video"] },
    { mediaTypes: ["unknown"] },
    { mediaTypes: [] },
    { mediaTypes: undefined },
    { securityOrigin: "https://example.com" },
  ])("denies mismatched request %j", (change) => {
    const policy = new DesktopMicrophonePolicy();
    policy.arm(7);
    expect(policy.allows({ ...request, ...change })).toBe(false);
  });
});
