import { expect, it } from "vitest";
import { shortcutLabel } from "./desktop-shortcuts";

it.each([
  ["darwin", "⌘B"],
  ["win32", "Ctrl+B"],
  ["linux", "Ctrl+B"],
  ["unknown", "Ctrl+B"],
])("labels shortcuts for %s", (platform, expected) => {
  expect(shortcutLabel("B", platform)).toBe(expected);
});
