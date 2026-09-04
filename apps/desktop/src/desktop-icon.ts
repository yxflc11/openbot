import { join } from "node:path";

export const DESKTOP_ICON_RESOURCE_NAME = "openbot-icon.png";

export function desktopWindowIconPath(input: {
  appPath: string;
  packaged: boolean;
  resourcesPath: string;
}): string {
  const root = input.packaged ? input.resourcesPath : join(input.appPath, "resources");
  return join(root, DESKTOP_ICON_RESOURCE_NAME);
}
