/** The separate computer is untrusted: no redirects, raw error forwarding or unbounded JSON. */
export async function computerRequest<T>(
  fetcher: typeof fetch,
  url: string,
  token: string,
  botId: string,
  signal: AbortSignal,
  init: RequestInit = {},
  maximumBytes = 8 * 1024 * 1024,
): Promise<T> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  deadline.throwIfAborted();
  const response = await fetcher(url, {
    ...init,
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "x-openbot-bot-id": botId,
      "x-openbot-computer-token": token,
    },
    signal: deadline,
  }).catch(() => {
    throw new Error("Computer connection failed or was cancelled.");
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Computer returned no response body.");
  try {
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
      throw new Error("Computer request was refused or unavailable.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      deadline.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maximumBytes) throw new Error("Computer response exceeded its limit.");
      chunks.push(next.value);
    }
    deadline.throwIfAborted();
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new Error("Computer response was invalid, refused, over limit or cancelled.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
