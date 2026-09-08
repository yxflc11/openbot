import { describe, expect, it } from "vitest";
import { browserClickApprovalMatches, parseBrowserClickInstruction } from "./browser-click.js";

describe("explicit reviewed browser click", () => {
  it("parses one URL and one quoted observed button name", () => {
    expect(parseBrowserClickInstruction("打开 https://example.com/ 并点击按钮“Preview”")).toEqual({
      target: "https://example.com/",
      buttonName: "Preview",
    });
    expect(
      parseBrowserClickInstruction("Open https://example.com/ and take a screenshot"),
    ).toBeUndefined();
  });
  it.each([
    "https://example.com/ click button Preview",
    'https://example.com/ https://example.org/ click button "Preview"',
    'https://example.com/ click button "First" click button "Second"',
    'http://remote.example/ click button "Preview"',
  ])("rejects ambiguous targets: %s", (instruction) =>
    expect(() => parseBrowserClickInstruction(instruction)).toThrow(),
  );
  it("binds Server approval evidence to task intent without trusting Worker summaries", () => {
    const instruction = 'https://example.com/ click button "Preview"';
    const evidence = {
      buttonName: "Preview",
      ref: "f2e4",
      snapshotId: 1,
      screenshotSha256: "a".repeat(64),
    };
    expect(browserClickApprovalMatches(instruction, "https://example.com/", evidence)).toBe(true);
    expect(browserClickApprovalMatches(instruction, "https://other.example/", evidence)).toBe(
      false,
    );
    expect(
      browserClickApprovalMatches(instruction, "https://example.com/", {
        ...evidence,
        buttonName: "Delete",
      }),
    ).toBe(false);
    expect(
      browserClickApprovalMatches(instruction, "https://example.com/", {
        ...evidence,
        ref: "css=button",
      }),
    ).toBe(false);
    expect(browserClickApprovalMatches("Just observe", "https://example.com/", evidence)).toBe(
      false,
    );
  });
});
