import type { ProviderFrame, ProviderRunInput } from "@openbot/provider-sdk";
import { describe, expect, it, vi } from "vitest";
import { createDockerProvider } from "./index.js";

const onePixelPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString(
  "base64",
);

const input: ProviderRunInput = {
  runId: "00000000-0000-4000-8000-000000000001",
  channelId: "00000000-0000-4000-8000-000000000002",
  botId: "00000000-0000-4000-8000-000000000003",
  title: "页面截图",
  instruction: "打开 https://example.test/form 并截图",
  executionProfile: "docker-linux",
};

const context = {
  nodeId: "linux-node",
  workDirectory: "/tmp/openbot-test",
  signal: new AbortController().signal,
};

describe("CopilotKit agent-computer adapter", () => {
  it("navigates and returns a bounded PNG artifact", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ url: "https://example.test/form", title: "Example form" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          base64: onePixelPng,
          width: 1280,
          height: 800,
          capturedAt: "2026-09-03T00:00:00.000Z",
          url: "https://example.test/form",
        }),
      );
    const provider = createDockerProvider({
      computerUrl: "http://127.0.0.1:4100/",
      computerToken: "computer-token-for-tests",
      fetcher,
      resolveHost: async () => ["203.0.113.10"],
    });
    const progress: string[] = [];
    const frames: ProviderFrame[] = [];

    const result = await provider.execute?.(
      context,
      input,
      (event) => progress.push(event.stage),
      (frame) => frames.push(frame),
    );

    expect(result).toMatchObject({
      ok: true,
      summary: "已打开 Example form 并截取画面。",
      artifacts: [{ name: "页面截图.png", mediaType: "image/png" }],
    });
    expect(progress).toEqual(["navigate", "screenshot"]);
    expect(frames).toEqual([
      {
        mediaType: "image/png",
        base64: onePixelPng,
        width: 1280,
        height: 800,
        capturedAt: "2026-09-03T00:00:00.000Z",
      },
    ]);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:4100/navigate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-openbot-bot-id": input.botId,
          "x-openbot-computer-token": "computer-token-for-tests",
        }),
      }),
    );
  });

  it("refuses ambiguous and private navigation before calling the computer", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = createDockerProvider({
      computerUrl: "http://127.0.0.1:4100",
      computerToken: "computer-token-for-tests",
      fetcher,
      resolveHost: async () => ["127.0.0.1"],
    });

    await expect(
      provider.execute?.(context, { ...input, instruction: "打开测试页" }, () => undefined),
    ).rejects.toThrow("明确的 http(s) URL");
    await expect(provider.execute?.(context, input, () => undefined)).rejects.toThrow(
      "Private-network navigation is disabled",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("blocks cloud metadata even when private hosts are explicitly enabled", async () => {
    const provider = createDockerProvider({
      computerUrl: "http://127.0.0.1:4100",
      computerToken: "computer-token-for-tests",
      allowPrivateHosts: true,
      fetcher: vi.fn<typeof fetch>(),
    });

    await expect(
      provider.execute?.(
        context,
        { ...input, instruction: "打开 http://169.254.169.254/latest/meta-data" },
        () => undefined,
      ),
    ).rejects.toThrow("metadata");
  });
});
