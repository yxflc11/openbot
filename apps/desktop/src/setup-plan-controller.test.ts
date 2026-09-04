import { describe, expect, it, vi } from "vitest";
import { createDesktopSetupPlan, type DesktopSetupPlanStore } from "./setup-plan.js";
import { DesktopSetupPlanController } from "./setup-plan-controller.js";

const clientPlan = createDesktopSetupPlan({
  mode: "client",
  plannedWorkerCount: 0,
  localWorker: false,
});

describe("DesktopSetupPlanController", () => {
  it("initializes as unconfigured, configured, or invalid without guessing a role", async () => {
    await expect(new DesktopSetupPlanController(store()).initialize()).resolves.toEqual({
      status: "unconfigured",
    });
    await expect(new DesktopSetupPlanController(store(clientPlan)).initialize()).resolves.toEqual({
      status: "configured",
      plan: { mode: "client", plannedWorkerCount: 0, localWorker: false },
    });
    await expect(
      new DesktopSetupPlanController({
        load: vi.fn(async () => Promise.reject(new Error("private path"))),
        save: vi.fn(),
      }).initialize(),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("persists a valid plan without performing any other action", async () => {
    const save = vi.fn();
    const controller = new DesktopSetupPlanController({ load: vi.fn(), save });
    const input = { mode: "client-worker" as const, plannedWorkerCount: 5, localWorker: true };
    await expect(controller.save(input)).resolves.toEqual({ status: "configured", plan: input });
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(createDesktopSetupPlan(input));
    expect(controller.getState()).toEqual({ status: "configured", plan: input });
  });

  it("returns bounded failures and preserves the previous state", async () => {
    const save = vi.fn(async () => Promise.reject(new Error("private storage detail")));
    const controller = new DesktopSetupPlanController({
      load: vi.fn(async () => clientPlan),
      save,
    });
    await controller.initialize();
    await expect(controller.save({ mode: "host" })).resolves.toEqual({
      status: "failed",
      code: "invalid_plan",
    });
    await expect(
      controller.save({ mode: "host", plannedWorkerCount: 2, localWorker: false }),
    ).resolves.toEqual({ status: "failed", code: "storage_unavailable" });
    expect(controller.getState()).toEqual({
      status: "configured",
      plan: { mode: "client", plannedWorkerCount: 0, localWorker: false },
    });
  });
});

function store(plan?: ReturnType<typeof createDesktopSetupPlan>): DesktopSetupPlanStore {
  return { load: vi.fn(async () => plan), save: vi.fn() };
}
