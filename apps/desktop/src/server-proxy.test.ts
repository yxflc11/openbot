import { describe, expect, it, vi } from "vitest";
import {
  MAXIMUM_DESKTOP_PROXY_REQUEST_BYTES,
  parseDesktopApiRequestUrl,
  proxyDesktopServerRequest,
} from "./server-proxy.js";

const configured = { status: "configured" as const, serverUrl: "https://openbot.example" };

describe("Desktop Server proxy routing", () => {
  it("handles only exact local API URLs", () => {
    expect(parseDesktopApiRequestUrl("openbot://app/api/v1/session")?.pathname).toBe(
      "/api/v1/session",
    );
    for (const url of [
      "openbot://app/index.html",
      "openbot://other/api/v1/session",
      "https://app/api/v1/session",
      "openbot://app/api/v2/session",
      "openbot://app/api/v1/session#fragment",
    ]) {
      expect(parseDesktopApiRequestUrl(url)).toBeUndefined();
    }
  });

  it("leaves immutable renderer assets to the asset handler", async () => {
    await expect(
      proxyDesktopServerRequest(new Request("openbot://app/index.html"), configured, vi.fn()),
    ).resolves.toBeUndefined();
  });

  it("returns a bounded setup response before any Server is configured", async () => {
    const fetcher = vi.fn();
    const response = await proxyDesktopServerRequest(
      new Request("openbot://app/api/v1/session"),
      { status: "unconfigured" },
      fetcher,
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: "OpenBot Desktop is not connected to a Server.",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards only narrow request data and sets the exact Server origin on mutations", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: {
            "Content-Type": "application/json",
            ETag: '"one"',
            "Set-Cookie": "secret=never-expose",
            "X-Private-Backend": "hidden",
          },
        }),
    );
    const response = await proxyDesktopServerRequest(
      new Request("openbot://app/api/v1/channels?limit=2", {
        body: JSON.stringify({ name: "ops" }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Renderer-Secret": "drop-me",
        },
        method: "POST",
      }),
      configured,
      fetcher,
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toBe("application/json");
    expect(response?.headers.get("etag")).toBe('"one"');
    expect(response?.headers.has("set-cookie")).toBe(false);
    expect(response?.headers.has("x-private-backend")).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    const [target, init] = fetcher.mock.calls[0] ?? [];
    expect(target).toBe("https://openbot.example/api/v1/channels?limit=2");
    expect(init).toMatchObject({ credentials: "include", method: "POST", redirect: "manual" });
    const headers = new Headers(init?.headers);
    expect(headers.get("origin")).toBe("https://openbot.example");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("x-renderer-secret")).toBe(false);
    expect(new TextDecoder().decode(init?.body as Uint8Array)).toBe('{"name":"ops"}');
  });

  it.each(["Authorization", "Cookie", "Proxy-Authorization"])(
    "rejects renderer-supplied %s credentials",
    async (name) => {
      const fetcher = vi.fn();
      const response = await proxyDesktopServerRequest(
        new Request("openbot://app/api/v1/session", { headers: { [name]: "secret" } }),
        configured,
        fetcher,
      );
      expect(response?.status).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("rejects unsupported methods and oversized bodies before network access", async () => {
    const fetcher = vi.fn();
    const methodResponse = await proxyDesktopServerRequest(
      new Request("openbot://app/api/v1/session", { method: "PUT" }),
      configured,
      fetcher,
    );
    expect(methodResponse?.status).toBe(405);
    expect(methodResponse?.headers.get("allow")).toBe("DELETE, GET, PATCH, POST");

    const bodyResponse = await proxyDesktopServerRequest(
      new Request("openbot://app/api/v1/session", {
        body: "x".repeat(MAXIMUM_DESKTOP_PROXY_REQUEST_BYTES + 1),
        method: "POST",
      }),
      configured,
      fetcher,
    );
    expect(bodyResponse?.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed on transport errors and Server redirects", async () => {
    const request = () => new Request("openbot://app/api/v1/session");
    const failed = await proxyDesktopServerRequest(
      request(),
      configured,
      vi.fn(async () => Promise.reject(new Error("private network detail"))),
    );
    expect(failed?.status).toBe(502);

    const redirected = await proxyDesktopServerRequest(
      request(),
      configured,
      vi.fn(
        async () =>
          new Response(null, { headers: { Location: "https://other.example" }, status: 302 }),
      ),
    );
    expect(redirected?.status).toBe(502);
  });

  it("streams Server responses without converting them into privileged values", async () => {
    const response = await proxyDesktopServerRequest(
      new Request("openbot://app/api/v1/events", { headers: { Accept: "text/event-stream" } }),
      configured,
      vi.fn(
        async () =>
          new Response("event: ready\ndata: {}\n\n", {
            headers: { "Content-Type": "text/event-stream", "X-Request-Id": "request-1" },
          }),
      ),
    );

    expect(response?.headers.get("x-request-id")).toBe("request-1");
    await expect(response?.text()).resolves.toBe("event: ready\ndata: {}\n\n");
  });
});
