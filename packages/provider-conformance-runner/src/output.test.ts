import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProviderConformanceReport,
  serializeProviderConformanceReport,
} from "@openbot/provider-sdk";
import { writeNewProviderConformanceReport } from "./output.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

function report() {
  return buildProviderConformanceReport({
    provider: {
      id: "fixture-provider",
      displayName: "Fixture Provider",
      platforms: ["linux"],
      capabilities: ["browser"],
      capabilityManifest: [
        {
          id: "browser.observe",
          version: 1,
          providerId: "fixture-provider",
          constraints: {},
        },
      ],
    },
    providerVersion: "0.1.0",
    target: {
      platform: "linux",
      architecture: "x64",
      osVersion: "6.8.0",
      evidenceLevel: "hermetic",
    },
    stage: "declaration",
    suiteVersion: "1.0.0",
    generatedAt: "2026-09-04T00:00:00.000Z",
  });
}

describe("Provider conformance evidence output", () => {
  it("creates a deterministic private file and refuses to replace it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-provider-conformance-"));
    temporaryDirectories.push(directory);
    const output = join(directory, "report.json");
    const value = report();

    await writeNewProviderConformanceReport(output, value);
    const original = await readFile(output, "utf8");
    expect(original).toBe(serializeProviderConformanceReport(value));
    if (process.platform !== "win32") {
      expect((await stat(output)).mode & 0o777).toBe(0o600);
    }

    await expect(writeNewProviderConformanceReport(output, value)).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(output, "utf8")).toBe(original);
  });
});
