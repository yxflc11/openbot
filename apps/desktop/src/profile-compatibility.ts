import { existsSync } from "node:fs";
import { join } from "node:path";

/** Keep the established encryption namespace when replacing the early macOS Preview. */
export function desktopProfileCompatibility(
  appData: string,
  platform: string,
  productName: string,
  exists: (path: string) => boolean = existsSync,
): Readonly<{ userData: string; encryptionName: string }> | undefined {
  if (platform !== "darwin" || productName !== "OpenBot") return undefined;
  const canonical = join(appData, "OpenBot");
  const legacy = join(appData, "OpenBot Preview");
  if (exists(join(canonical, "openbot", "setup-plan.json"))) return undefined;
  if (!exists(join(legacy, "openbot", "setup-plan.json"))) return undefined;
  return { userData: legacy, encryptionName: "OpenBot Preview" };
}
