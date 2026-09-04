import { DESKTOP_ENTRY_URL } from "./local-content.js";

export interface DesktopIpcSender {
  sender: unknown;
  senderFrame: Readonly<{ top: unknown; url: string }> | null;
}

export interface ExpectedDesktopContents {
  mainFrame: unknown;
}

export function isTrustedDesktopIpcSender(
  event: DesktopIpcSender,
  expectedContents: ExpectedDesktopContents | undefined,
): boolean {
  const frame = event.senderFrame;
  return (
    expectedContents !== undefined &&
    event.sender === expectedContents &&
    frame !== null &&
    frame === expectedContents.mainFrame &&
    frame.top === frame &&
    frame.url === DESKTOP_ENTRY_URL
  );
}
