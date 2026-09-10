// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PendingPluginCall } from "../plugin-api";
import { interact, renderComponent } from "../test/render-component";
import { PluginCallApproval, PluginCallApprovals } from "./PluginCallApprovals";

const call: PendingPluginCall = {
  id: "call",
  pluginId: "plugin",
  pluginName: "Service",
  toolName: "write",
  botId: "bot",
  channelId: "channel",
  runId: "run",
  arguments: { target: "<script>bad()</script>", value: "exact" },
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};
afterEach(() => vi.unstubAllGlobals());

describe("per-call plugin approval", () => {
  it("shows exact escaped arguments and submits only the chosen call decision", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ decided: true }) });
    vi.stubGlobal("fetch", fetcher);
    const decided = vi.fn();
    const view = await renderComponent(
      <PluginCallApproval
        call={call}
        botName="Researcher"
        endpoint="https://example.com/mcp"
        unavailable={false}
        onDecided={decided}
        onInspectRun={vi.fn()}
      />,
    );
    try {
      expect(view.container.querySelector("pre")?.textContent).toContain('"value": "exact"');
      expect(view.container.querySelector("script")).toBeNull();
      await interact(() =>
        Array.from(view.container.querySelectorAll("button"))
          .find((button) => button.textContent === "批准这次调用")
          ?.click(),
      );
      expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/plugin-calls/call/decision");
      expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({ decision: "approve" });
      expect(decided).toHaveBeenCalledOnce();
    } finally {
      await view.unmount();
    }
  });
  it.each([
    { expired: true, unavailable: false, endpoint: "https://example.com" },
    { expired: false, unavailable: true, endpoint: "https://example.com" },
    { expired: false, unavailable: false, endpoint: undefined },
  ])(
    "disables decisions without a current inspectable call: %j",
    async ({ expired, unavailable, endpoint }) => {
      const view = await renderComponent(
        <PluginCallApproval
          call={{ ...call, expiresAt: expired ? "2020-01-01" : call.expiresAt }}
          botName="Bot"
          endpoint={endpoint}
          unavailable={unavailable}
          onDecided={vi.fn()}
          onInspectRun={vi.fn()}
        />,
      );
      try {
        expect(view.container.querySelectorAll<HTMLButtonElement>("button")[0]?.disabled).toBe(
          true,
        );
        expect(view.container.querySelectorAll<HTMLButtonElement>("button")[1]?.disabled).toBe(
          true,
        );
      } finally {
        await view.unmount();
      }
    },
  );
  it("does not expose another channel's pending arguments", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ plugins: [], pendingCalls: [call] }) }),
    );
    const view = await renderComponent(
      <PluginCallApprovals channelId="other" bots={[]} onInspectRun={vi.fn()} />,
    );
    try {
      expect(view.container.textContent).toBe("");
    } finally {
      await view.unmount();
    }
  });
});
