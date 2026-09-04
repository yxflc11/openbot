import {
  createDesktopSetupPlan,
  type DesktopSetupPlan,
  type DesktopSetupPlanStore,
  toDesktopSetupPlanInput,
} from "./setup-plan.js";
import type { DesktopSetupPlanState, SaveDesktopSetupPlanResult } from "./runtime-contract.js";

export class DesktopSetupPlanController {
  readonly #store: DesktopSetupPlanStore;
  #state: DesktopSetupPlanState = unconfiguredState();

  constructor(store: DesktopSetupPlanStore) {
    this.#store = store;
  }

  async initialize(): Promise<DesktopSetupPlanState> {
    try {
      const plan = await this.#store.load();
      this.#state = plan === undefined ? unconfiguredState() : configuredState(plan);
    } catch {
      this.#state = invalidState();
    }
    return this.#state;
  }

  getState(): DesktopSetupPlanState {
    return this.#state;
  }

  async save(input: unknown): Promise<SaveDesktopSetupPlanResult> {
    let plan: DesktopSetupPlan;
    try {
      plan = createDesktopSetupPlan(input);
    } catch {
      return Object.freeze({ status: "failed", code: "invalid_plan" });
    }
    try {
      await this.#store.save(plan);
    } catch {
      return Object.freeze({ status: "failed", code: "storage_unavailable" });
    }
    this.#state = configuredState(plan);
    return this.#state;
  }
}

function unconfiguredState(): DesktopSetupPlanState {
  return Object.freeze({ status: "unconfigured" });
}

function invalidState(): DesktopSetupPlanState {
  return Object.freeze({ status: "invalid" });
}

function configuredState(
  plan: DesktopSetupPlan,
): Extract<DesktopSetupPlanState, { status: "configured" }> {
  return Object.freeze({ status: "configured", plan: toDesktopSetupPlanInput(plan) });
}
