import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { desktopProfileCompatibility } from "./profile-compatibility.js";
const root = "/fixture";
const legacy = join(root, "OpenBot Preview", "openbot", "setup-plan.json");
const canonical = join(root, "OpenBot", "openbot", "setup-plan.json");
describe("canonical Desktop name with retained Preview identity", () => {
  it("preserves the configured Preview profile only for canonical macOS OpenBot", () => {
    const exists = (path: string) => path === legacy;
    expect(desktopProfileCompatibility(root, "darwin", "OpenBot", exists)).toEqual({
      userData: join(root, "OpenBot Preview"),
      encryptionName: "OpenBot Preview",
    });
    expect(desktopProfileCompatibility(root, "win32", "OpenBot", exists)).toBeUndefined();
    expect(desktopProfileCompatibility(root, "darwin", "OpenBot Preview", exists)).toBeUndefined();
  });
  it("never replaces canonical data and leaves new installations canonical", () => {
    expect(
      desktopProfileCompatibility(root, "darwin", "OpenBot", (path) =>
        [legacy, canonical].includes(path),
      ),
    ).toBeUndefined();
    expect(desktopProfileCompatibility(root, "darwin", "OpenBot", () => false)).toBeUndefined();
  });
});
