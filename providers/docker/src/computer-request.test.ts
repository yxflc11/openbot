import { describe, expect, it, vi } from "vitest";
import { computerRequest } from "./computer-request.js";

describe("bounded computer transport", () => {
  it("rejects over-limit chunks, redirects and raw upstream errors", async () => {
    for (const response of [
      Response.json({ value: "x".repeat(100) }),
      new Response("private detail", {
        status: 302,
        headers: { location: "https://outside.example/" },
      }),
      Response.json({ error: "private detail" }, { status: 500 }),
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        computerRequest(
          fetcher,
          "http://127.0.0.1:4100/control",
          "fixture-token",
          "bot",
          new AbortController().signal,
          {},
          32,
        ),
      ).rejects.not.toThrow("private detail");
      expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe("error");
    }
  });
  it("does not start a request after cancellation", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort();
    await expect(
      computerRequest(
        fetcher,
        "http://127.0.0.1:4100/control",
        "fixture-token",
        "bot",
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
