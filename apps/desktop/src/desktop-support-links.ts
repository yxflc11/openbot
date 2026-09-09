import { DESKTOP_ENTRY_URL } from "./local-content.js";

const SUPPORT_DESTINATIONS = new Set([
  "https://github.com/yxflc11/openbot#readme",
  "https://github.com/yxflc11/openbot/issues/new",
]);

interface SupportLinkContents {
  readonly mainFrame: { readonly url: string };
  isDestroyed(): boolean;
  isLoadingMainFrame(): boolean;
}

/** Fixed product links do not carry renderer-controlled query data or protocol authority. */
export async function openDesktopSupportLink(
  url: string,
  source: SupportLinkContents,
  expectedSource: SupportLinkContents | undefined,
  openExternal: (destination: string) => Promise<void>,
): Promise<boolean> {
  if (
    !SUPPORT_DESTINATIONS.has(url) ||
    source !== expectedSource ||
    source.isDestroyed() ||
    source.isLoadingMainFrame() ||
    source.mainFrame.url !== DESKTOP_ENTRY_URL
  ) {
    return false;
  }
  await openExternal(url);
  return true;
}
