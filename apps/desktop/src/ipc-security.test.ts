import { describe, expect, it } from "vitest";
import { DESKTOP_ENTRY_URL } from "./local-content.js";
import { isTrustedDesktopIpcSender } from "./ipc-security.js";

describe("Desktop IPC sender policy", () => {
  it("accepts only the exact top frame of the active local window", () => {
    const frame: { top?: unknown; url: string } = { url: DESKTOP_ENTRY_URL };
    frame.top = frame;
    const contents = { mainFrame: frame };

    expect(isTrustedDesktopIpcSender({ sender: contents, senderFrame: frame }, contents)).toBe(
      true,
    );
  });

  it("rejects absent windows, foreign contents, subframes, and navigated frames", () => {
    const frame: { top?: unknown; url: string } = { url: DESKTOP_ENTRY_URL };
    frame.top = frame;
    const contents = { mainFrame: frame };
    const subframe = { top: frame, url: DESKTOP_ENTRY_URL };

    expect(isTrustedDesktopIpcSender({ sender: contents, senderFrame: frame }, undefined)).toBe(
      false,
    );
    expect(isTrustedDesktopIpcSender({ sender: {}, senderFrame: frame }, contents)).toBe(false);
    expect(isTrustedDesktopIpcSender({ sender: contents, senderFrame: subframe }, contents)).toBe(
      false,
    );
    expect(
      isTrustedDesktopIpcSender(
        { sender: contents, senderFrame: { top: frame, url: "https://attacker.example" } },
        contents,
      ),
    ).toBe(false);
    expect(isTrustedDesktopIpcSender({ sender: contents, senderFrame: null }, contents)).toBe(
      false,
    );
  });
});
