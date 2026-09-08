/** Explicit task intent shared by Server routing and the Worker; page/model text cannot add it. */
export function hasBrowserClickIntent(instruction: string): boolean {
  return /click button|点击按钮/iu.test(instruction);
}

export function parseBrowserClickInstruction(
  instruction: string,
): { target: string; buttonName: string } | undefined {
  if (!hasBrowserClickIntent(instruction)) return undefined;
  const names = [
    ...instruction.matchAll(/(?:click button|点击按钮)\s*["“]([^"”\r\n]{1,120})["”]/giu),
  ];
  const urls = [...instruction.matchAll(/https?:\/\/[^\s<>"'“”]+/giu)];
  if (names.length !== 1 || urls.length !== 1)
    throw new Error("Name exactly one URL and one button to click.");
  const buttonName = names[0]?.[1]?.trim();
  const raw = urls[0]?.[0]?.replace(/[),.;!?，。；！？）]+$/u, "");
  if (!buttonName || !raw) throw new Error("A named button and URL are required.");
  if ([...buttonName].some((character) => character.charCodeAt(0) < 32))
    throw new Error("Invalid button name.");
  if (raw.length > 2048) throw new Error("Browser URL exceeds the task limit.");
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    !(url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1"))
  )
    throw new Error("Clicks require HTTPS or an explicitly configured loopback test origin.");
  return { target: url.href, buttonName };
}

export function browserClickApprovalMatches(
  instruction: string,
  target: string,
  beforeState: Record<string, unknown>,
): boolean {
  try {
    const intent = parseBrowserClickInstruction(instruction);
    return Boolean(
      intent &&
        intent.target === target &&
        intent.buttonName === beforeState.buttonName &&
        typeof beforeState.ref === "string" &&
        /^(?:f[0-9]{1,8})?e[0-9]{1,8}$/u.test(beforeState.ref) &&
        Number.isSafeInteger(beforeState.snapshotId) &&
        Number(beforeState.snapshotId) > 0 &&
        typeof beforeState.screenshotSha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(beforeState.screenshotSha256),
    );
  } catch {
    return false;
  }
}
