import { describe, expect, it, vi } from "vitest";
import {
  DesktopEventStreamLifecycle,
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

  it.each([
    ["/api/v1/automations", "GET"],
    ["/api/v1/automations", "POST"],
    ["/api/v1/automations/scheduled-review", "PATCH"],
    ["/api/v1/automations/scheduled-review", "DELETE"],
  ])("keeps automation route %s %s on the configured Server", async (path, method) => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const response = await proxyDesktopServerRequest(
      new Request(`openbot://app${path}`, {
        method,
        headers: { "Content-Type": "application/json", "If-Match": '"revision-one"' },
        ...(method === "POST" || method === "PATCH" ? { body: "{}" } : {}),
      }),
      configured,
      fetcher,
    );
    expect(response?.status).toBe(200);
    const [target, init] = fetcher.mock.calls[0] ?? [];
    expect(target).toBe(`https://openbot.example${path}`);
    expect(init).toMatchObject({ method, credentials: "include", redirect: "manual" });
    const headers = new Headers(init?.headers);
    expect(headers.get("if-match")).toBe('"revision-one"');
    expect(headers.get("origin")).toBe(method === "GET" ? null : "https://openbot.example");
  });

  it("rejects renderer credentials on automation requests before network access", async () => {
    const fetcher = vi.fn();
    const response = await proxyDesktopServerRequest(
      new Request("openbot://app/api/v1/automations", {
        method: "POST",
        body: "{}",
        headers: { Authorization: "Bearer renderer-credential" },
      }),
      configured,
      fetcher,
    );
    expect(response?.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
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

describe("single-window event-stream lifecycle", () => {
  const request = (path: string) =>
    new Request(`openbot://app/api/v1/${path}`, {
      headers: { accept: "text/event-stream" },
    });
  it("bounds repeated channel subscriptions without cancelling workspace or ordinary requests", async () => {
    const lifecycle = new DesktopEventStreamLifecycle();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(async (_input: string, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return new Response(new ReadableStream(), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    await lifecycle.forward(request("workspace/events"), configured, fetcher);
    for (let index = 0; index < 12; index++)
      await lifecycle.forward(request(`channels/channel-${index}/events`), configured, fetcher);
    expect(signals[0]?.aborted).toBe(false);
    expect(signals.slice(1, -1).every((signal) => signal.aborted)).toBe(true);
    expect(signals.at(-1)?.aborted).toBe(false);
    await lifecycle.forward(new Request("openbot://app/api/v1/workspace"), configured, fetcher);
    lifecycle.clear();
    expect(signals.slice(0, -1).every((signal) => signal.aborted)).toBe(true);
    expect(signals.at(-1)?.aborted).toBe(false);
    lifecycle.clear();
  });

  it("does not let a late replaced-stream failure remove its successor", async () => {
    const lifecycle = new DesktopEventStreamLifecycle();
    let failFirst: ((response: Response) => void) | undefined;
    const first = lifecycle.forward(
      request("workspace/events"),
      configured,
      () =>
        new Promise((resolve) => {
          failFirst = resolve;
        }),
    );
    let currentSignal: AbortSignal | undefined;
    await lifecycle.forward(request("workspace/events"), configured, async (_input, init) => {
      currentSignal = init?.signal ?? undefined;
      return new Response(new ReadableStream(), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    failFirst?.(new Response(null, { status: 503 }));
    await first;
    expect(currentSignal?.aborted).toBe(false);
    lifecycle.clear();
    expect(currentSignal?.aborted).toBe(true);
  });
});
