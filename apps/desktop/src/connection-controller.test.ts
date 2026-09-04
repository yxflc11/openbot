import { describe, expect, it, vi } from "vitest";
import {
  type DesktopConnectionConfig,
  type DesktopConnectionStore,
  DESKTOP_CONNECTION_CONFIG_FORMAT,
} from "./connection-config.js";
import {
  DesktopConnectionController,
  MAXIMUM_DESKTOP_HEALTH_RESPONSE_BYTES,
  verifyDesktopServer,
} from "./connection-controller.js";

function validConfig(serverUrl = "https://openbot.example"): DesktopConnectionConfig {
  return { format: DESKTOP_CONNECTION_CONFIG_FORMAT, serverUrl };
}

function validHealthResponse(): Response {
  return Response.json({ ok: true, service: "openbot-server" });
}

function createStore(config?: DesktopConnectionConfig): DesktopConnectionStore {
  return {
    load: vi.fn(async () => config),
    save: vi.fn(async () => undefined),
  };
}

describe("Desktop connection initialization", () => {
  it("distinguishes missing, retained, and invalid configuration", async () => {
    const missing = new DesktopConnectionController({
      clearSessionData: vi.fn(),
      confirmServer: vi.fn(),
      fetch: vi.fn(),
      store: createStore(),
    });
    expect(await missing.initialize()).toEqual({ status: "unconfigured" });

    const retained = new DesktopConnectionController({
      clearSessionData: vi.fn(),
      confirmServer: vi.fn(),
      fetch: vi.fn(),
      store: createStore(validConfig()),
    });
    expect(await retained.initialize()).toEqual({
      status: "configured",
      serverUrl: "https://openbot.example",
    });

    const invalid = new DesktopConnectionController({
      clearSessionData: vi.fn(),
      confirmServer: vi.fn(),
      fetch: vi.fn(),
      store: { load: vi.fn(async () => Promise.reject(new Error("unsafe bytes"))), save: vi.fn() },
    });
    expect(await invalid.initialize()).toEqual({ status: "invalid" });
  });
});

describe("Desktop Server verification", () => {
  it("accepts only the bounded OpenBot health identity without redirects", async () => {
    const fetcher = vi.fn(async () => validHealthResponse());

    await expect(verifyDesktopServer(fetcher, "https://openbot.example")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      "https://openbot.example/health",
      expect.objectContaining({ credentials: "omit", method: "GET", redirect: "manual" }),
    );
  });

  it.each([
    [
      new Response(null, { headers: { Location: "https://other.example" }, status: 302 }),
      "server_redirected",
    ],
    [new Response("missing", { status: 404 }), "not_openbot_server"],
    [new Response("{}", { headers: { "Content-Type": "application/json" } }), "not_openbot_server"],
    [Response.json({ ok: true, service: "other" }), "not_openbot_server"],
    [
      new Response("x".repeat(MAXIMUM_DESKTOP_HEALTH_RESPONSE_BYTES + 1), {
        headers: { "Content-Type": "application/json" },
      }),
      "not_openbot_server",
    ],
  ])("rejects a response outside the health contract", async (response, expected) => {
    await expect(
      verifyDesktopServer(
        vi.fn(async () => response),
        "https://openbot.example",
      ),
    ).resolves.toBe(expected);
  });

  it("maps transport failure to a stable renderer-safe code", async () => {
    await expect(
      verifyDesktopServer(
        vi.fn(async () => Promise.reject(new Error("private detail"))),
        "https://openbot.example",
      ),
    ).resolves.toBe("server_unreachable");
  });
});

describe("Desktop connection changes", () => {
  it("validates, confirms, clears retained browser state, and atomically saves", async () => {
    const actions: string[] = [];
    const store = createStore();
    vi.mocked(store.save).mockImplementation(async () => {
      actions.push("save");
    });
    const controller = new DesktopConnectionController({
      clearSessionData: vi.fn(async () => {
        actions.push("clear");
      }),
      confirmServer: vi.fn(async () => {
        actions.push("confirm");
        return true;
      }),
      fetch: vi.fn(async () => {
        actions.push("health");
        return validHealthResponse();
      }),
      store,
    });

    await controller.initialize();
    await expect(controller.configure(" https://openbot.example/ ")).resolves.toEqual({
      status: "configured",
      serverUrl: "https://openbot.example",
    });
    expect(actions).toEqual(["health", "confirm", "clear", "save"]);
    expect(store.save).toHaveBeenCalledWith(validConfig());
    expect(controller.getState()).toEqual({
      status: "configured",
      serverUrl: "https://openbot.example",
    });
  });

  it("does not invoke network or storage for malformed input", async () => {
    const fetcher = vi.fn();
    const store = createStore();
    const controller = new DesktopConnectionController({
      clearSessionData: vi.fn(),
      confirmServer: vi.fn(),
      fetch: fetcher,
      store,
    });

    await expect(controller.configure("http://remote.example")).resolves.toEqual({
      status: "failed",
      code: "invalid_url",
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("preserves state when native confirmation is cancelled", async () => {
    const store = createStore(validConfig("https://old.example"));
    const clearSessionData = vi.fn();
    const controller = new DesktopConnectionController({
      clearSessionData,
      confirmServer: vi.fn(async () => false),
      fetch: vi.fn(async () => validHealthResponse()),
      store,
    });
    await controller.initialize();

    await expect(controller.configure("https://new.example")).resolves.toEqual({
      status: "cancelled",
    });
    expect(clearSessionData).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
    expect(controller.getServerUrl()).toBe("https://old.example");
  });

  it("fails closed when confirmation, session clearing, or persistence fails", async () => {
    const base = {
      fetch: vi.fn(async () => validHealthResponse()),
      store: createStore(),
    };
    const confirmationFailure = new DesktopConnectionController({
      ...base,
      clearSessionData: vi.fn(),
      confirmServer: vi.fn(async () => Promise.reject(new Error("dialog"))),
    });
    await expect(confirmationFailure.configure("https://openbot.example")).resolves.toEqual({
      status: "failed",
      code: "confirmation_unavailable",
    });

    const clearFailure = new DesktopConnectionController({
      ...base,
      clearSessionData: vi.fn(async () => Promise.reject(new Error("clear"))),
      confirmServer: vi.fn(async () => true),
    });
    await expect(clearFailure.configure("https://openbot.example")).resolves.toEqual({
      status: "failed",
      code: "storage_unavailable",
    });
    expect(base.store.save).not.toHaveBeenCalled();

    const failingStore = createStore();
    vi.mocked(failingStore.save).mockRejectedValue(new Error("disk"));
    const saveFailure = new DesktopConnectionController({
      clearSessionData: vi.fn(),
      confirmServer: vi.fn(async () => true),
      fetch: vi.fn(async () => validHealthResponse()),
      store: failingStore,
    });
    await expect(saveFailure.configure("https://openbot.example")).resolves.toEqual({
      status: "failed",
      code: "storage_unavailable",
    });
    expect(saveFailure.getState()).toEqual({ status: "unconfigured" });
  });

  it("does not clear or rewrite an already selected canonical Server", async () => {
    const store = createStore(validConfig());
    const clearSessionData = vi.fn();
    const controller = new DesktopConnectionController({
      clearSessionData,
      confirmServer: vi.fn(async () => true),
      fetch: vi.fn(async () => validHealthResponse()),
      store,
    });
    await controller.initialize();

    await expect(controller.configure("https://openbot.example")).resolves.toEqual({
      status: "configured",
      serverUrl: "https://openbot.example",
    });
    expect(clearSessionData).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });
});
