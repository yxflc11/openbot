import { describe, expect, it, vi } from "vitest";
import { DesktopLocalWorkerController, toNodeWebSocketUrl } from "./local-worker-controller.js";
import type {
  MacOSWorkerCompanionInvoker,
  MacOSWorkerCompanionRequest,
} from "./macos-worker-companion.js";
import type { DesktopSetupPlanState } from "./runtime-contract.js";

const workerPlan = {
  status: "configured" as const,
  plan: { mode: "client-worker" as const, plannedWorkerCount: 5, localWorker: true },
};
const connection = { status: "configured" as const, serverUrl: "https://openbot.example" };
const token = `obenr_${"t".repeat(43)}`;

describe("DesktopLocalWorkerController", () => {
  it("projects honest plan and platform prerequisites before invoking native code", async () => {
    const workerCompanion = companion();
    await expect(
      controller({
        companion: workerCompanion,
        plan: { status: "configured", plan: { ...workerPlan.plan, localWorker: false } },
      }).getState(),
    ).resolves.toEqual({ status: "not-selected" });
    await expect(
      controller({ companion: workerCompanion, platform: "win32" }).getState(),
    ).resolves.toEqual({
      status: "unavailable",
    });
    expect(workerCompanion.invoke).not.toHaveBeenCalled();
  });

  it("preflights native state before issuing and privately forwarding a token", async () => {
    const invoke = vi
      .fn<MacOSWorkerCompanionInvoker["invoke"]>()
      .mockResolvedValueOnce({ status: "not-configured" })
      .mockResolvedValueOnce({ status: "requires-approval" });
    const issueEnrollmentToken = vi.fn(async () => ({ status: "issued" as const, token }));
    const subject = controller({ companion: { invoke }, issueEnrollmentToken });

    await expect(subject.setup("mac-studio-1")).resolves.toEqual({
      status: "succeeded",
      state: { status: "requires-approval" },
    });
    expect(issueEnrollmentToken).toHaveBeenCalledWith("mac-studio-1", connection);
    expect(invoke).toHaveBeenNthCalledWith(1, {
      action: "status",
      format: "openbot.macos-desktop-control/v1",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, {
      action: "enroll",
      enrollmentToken: token,
      format: "openbot.macos-desktop-control/v1",
      nodeId: "mac-studio-1",
      serverUrl: "wss://openbot.example/ws/nodes",
    });
  });

  it("does not consume a token when the companion is unavailable, invalid, or already configured", async () => {
    for (const status of ["unavailable", "invalid", "disabled"] as const) {
      const issueEnrollmentToken = vi.fn();
      const subject = controller({
        companion: companion({ status }),
        issueEnrollmentToken,
      });
      await expect(subject.setup("mac-node")).resolves.toEqual({
        status: "failed",
        code:
          status === "unavailable"
            ? "unavailable"
            : status === "invalid"
              ? "native_failed"
              : "already_configured",
      });
      expect(issueEnrollmentToken).not.toHaveBeenCalled();
    }
  });

  it("abandons setup when local-Worker intent changes during native preflight", async () => {
    let plan: DesktopSetupPlanState = workerPlan;
    const invoke = vi.fn(async () => {
      plan = {
        status: "configured",
        plan: { mode: "client", plannedWorkerCount: 0, localWorker: false },
      };
      return { status: "not-configured" as const };
    });
    const issueEnrollmentToken = vi.fn();
    const subject = new DesktopLocalWorkerController({
      companion: { invoke },
      getConnectionState: () => connection,
      getSetupPlanState: () => plan,
      isAuthenticated: vi.fn(async () => true),
      issueEnrollmentToken,
      platform: "darwin",
    });

    await expect(subject.setup("mac-node")).resolves.toEqual({
      status: "failed",
      code: "not_selected",
    });
    expect(issueEnrollmentToken).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledOnce();
  });

  it("requires an authenticated session for enable and settings side effects", async () => {
    const native = companion({ status: "disabled" });
    const unauthenticated = controller({ companion: native, authenticated: false });
    await expect(unauthenticated.enable()).resolves.toEqual({
      status: "failed",
      code: "authentication_required",
    });
    await expect(unauthenticated.openSettings()).resolves.toEqual({
      status: "failed",
      code: "authentication_required",
    });
    expect(native.invoke).not.toHaveBeenCalled();
  });

  it("validates Node ids and serializes overlapping mutations", async () => {
    await expect(controller({}).setup("bad node")).resolves.toEqual({
      status: "failed",
      code: "invalid_node_id",
    });
    let release: ((value: { status: "not-configured" }) => void) | undefined;
    const pending = new Promise<{ status: "not-configured" }>((resolve) => {
      release = resolve;
    });
    const subject = controller({ companion: { invoke: vi.fn(async () => pending) } });
    const first = subject.setup("mac-node");
    await expect(subject.setup("mac-node-2")).resolves.toEqual({ status: "failed", code: "busy" });
    release?.({ status: "not-configured" });
    await first;
  });
});

describe("Desktop Server origin projection", () => {
  it.each([
    ["https://openbot.example", "wss://openbot.example/ws/nodes"],
    ["http://localhost:3000", "ws://localhost:3000/ws/nodes"],
  ])("maps %s to the exact Node WebSocket endpoint", (input, expected) => {
    expect(toNodeWebSocketUrl(input)).toBe(expected);
  });

  it("rejects a non-HTTP origin", () => {
    expect(() => toNodeWebSocketUrl("file:///tmp/server")).toThrow();
  });
});

function companion(
  state: { status: "not-configured" | "disabled" | "unavailable" | "invalid" } = {
    status: "not-configured",
  },
): MacOSWorkerCompanionInvoker & { invoke: ReturnType<typeof vi.fn> } {
  return { invoke: vi.fn(async (_request: MacOSWorkerCompanionRequest) => state) };
}

function controller({
  authenticated = true,
  companion: workerCompanion = companion(),
  issueEnrollmentToken = vi.fn(async () => ({ status: "issued" as const, token })),
  plan = workerPlan,
  platform = "darwin",
}: {
  authenticated?: boolean;
  companion?: MacOSWorkerCompanionInvoker;
  issueEnrollmentToken?: ReturnType<typeof vi.fn>;
  plan?: typeof workerPlan;
  platform?: string;
} = {}) {
  return new DesktopLocalWorkerController({
    companion: workerCompanion,
    getConnectionState: () => connection,
    getSetupPlanState: () => plan,
    isAuthenticated: vi.fn(async () => authenticated),
    issueEnrollmentToken,
    platform,
  });
}
