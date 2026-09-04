import { open, rm } from "node:fs/promises";
import type { ProviderConformanceReport } from "@openbot/protocol";
import { serializeProviderConformanceReport } from "@openbot/provider-sdk";

/** Create one evidence file without replacing an earlier run or following a pre-existing path. */
export async function writeNewProviderConformanceReport(
  path: string,
  report: ProviderConformanceReport,
): Promise<void> {
  const serialized = serializeProviderConformanceReport(report);
  const handle = await open(path, "wx", 0o600);
  let complete = false;
  try {
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    complete = true;
  } finally {
    await handle.close();
    if (!complete) await rm(path, { force: true });
  }
}
