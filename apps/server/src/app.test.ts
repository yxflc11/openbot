import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("server app", () => {
  it("reports health", async () => {
    const app = createApp({ listNodes: () => [] });
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, service: "openbot-server" });
  });

  it("projects connected node count into bootstrap", async () => {
    const app = createApp({
      listNodes: () => [
        {
          id: "node-1",
          name: "Linux worker",
          platform: "linux",
          capabilities: ["browser"],
          connectedAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const response = await app.request("/api/v1/bootstrap");

    expect(await response.json()).toMatchObject({ counts: { connectedNodes: 1 } });
  });
});
