import type { DesktopConnectionState } from "./connection-controller.js";
import {
  macOSWorkerEnableRequest,
  macOSWorkerEnrollRequest,
  macOSWorkerOpenSettingsRequest,
  macOSWorkerStatusRequest,
  type MacOSWorkerCompanionInvoker,
} from "./macos-worker-companion.js";
import type {
  DesktopLocalWorkerFailureCode,
  DesktopLocalWorkerOperationResult,
  DesktopLocalWorkerState,
  DesktopSetupPlanState,
} from "./runtime-contract.js";
import type { DesktopEnrollmentTokenResult } from "./desktop-server-actions.js";

const nodeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

export interface DesktopLocalWorkerControllerOptions {
  companion: MacOSWorkerCompanionInvoker;
  getConnectionState(): DesktopConnectionState;
  getSetupPlanState(): DesktopSetupPlanState;
  isAuthenticated(): Promise<boolean>;
  issueEnrollmentToken(
    nodeId: string,
    connection: Extract<DesktopConnectionState, { status: "configured" }>,
  ): Promise<DesktopEnrollmentTokenResult>;
  platform: string;
}

export class DesktopLocalWorkerController {
  readonly #options: DesktopLocalWorkerControllerOptions;
  #busy = false;

  constructor(options: DesktopLocalWorkerControllerOptions) {
    this.#options = options;
  }

  async getState(): Promise<DesktopLocalWorkerState> {
    const prerequisite = this.#prerequisiteState();
    if (prerequisite !== undefined) return prerequisite;
    try {
      return await this.#options.companion.invoke(macOSWorkerStatusRequest());
    } catch {
      return state("invalid");
    }
  }

  async setup(input: unknown): Promise<DesktopLocalWorkerOperationResult> {
    if (typeof input !== "string" || !isValidNodeId(input)) {
      return failed("invalid_node_id");
    }
    return this.#exclusive(async () => {
      const prerequisite = this.#prerequisiteFailure();
      if (prerequisite !== undefined) return failed(prerequisite);
      const connection = this.#options.getConnectionState();
      if (connection.status !== "configured") {
        return failed("server_unavailable");
      }
      let serverUrl: string;
      try {
        serverUrl = toNodeWebSocketUrl(connection.serverUrl);
      } catch {
        return failed("server_unavailable");
      }
      const current = await this.#invoke(macOSWorkerStatusRequest());
      if (current.status === "unavailable") return failed("unavailable");
      if (current.status === "invalid") return failed("native_failed");
      if (current.status !== "not-configured") return failed("already_configured");
      const changedPrerequisite = this.#prerequisiteFailure();
      if (changedPrerequisite !== undefined) return failed(changedPrerequisite);
      if (!sameConfiguredConnection(connection, this.#options.getConnectionState())) {
        return failed("server_unavailable");
      }

      const token = await this.#options.issueEnrollmentToken(input, connection);
      if (token.status === "authentication-required") return failed("authentication_required");
      if (token.status !== "issued") return failed("server_unavailable");
      const changedAfterIssue = this.#prerequisiteFailure();
      if (changedAfterIssue !== undefined) return failed(changedAfterIssue);
      if (!sameConfiguredConnection(connection, this.#options.getConnectionState())) {
        return failed("server_unavailable");
      }
      const next = await this.#invoke(
        macOSWorkerEnrollRequest({
          enrollmentToken: token.token,
          nodeId: input,
          serverUrl,
        }),
      );
      return next.status === "invalid" ? failed("native_failed") : succeeded(next);
    });
  }

  async enable(): Promise<DesktopLocalWorkerOperationResult> {
    return this.#exclusive(async () => {
      const prerequisite = this.#prerequisiteFailure();
      if (prerequisite !== undefined) return failed(prerequisite);
      if (!(await this.#options.isAuthenticated())) return failed("authentication_required");
      const current = await this.#invoke(macOSWorkerStatusRequest());
      if (current.status === "unavailable") return failed("unavailable");
      if (current.status === "invalid") return failed("native_failed");
      if (current.status !== "disabled" && current.status !== "requires-approval") {
        return succeeded(current);
      }
      const next = await this.#invoke(macOSWorkerEnableRequest());
      return next.status === "invalid" ? failed("native_failed") : succeeded(next);
    });
  }

  async openSettings(): Promise<DesktopLocalWorkerOperationResult> {
    return this.#exclusive(async () => {
      const prerequisite = this.#prerequisiteFailure();
      if (prerequisite !== undefined) return failed(prerequisite);
      if (!(await this.#options.isAuthenticated())) return failed("authentication_required");
      const next = await this.#invoke(macOSWorkerOpenSettingsRequest());
      if (next.status === "unavailable") return failed("unavailable");
      return next.status === "invalid" ? failed("native_failed") : succeeded(next);
    });
  }

  #prerequisiteState(): DesktopLocalWorkerState | undefined {
    const plan = this.#options.getSetupPlanState();
    if (plan.status !== "configured" || !plan.plan.localWorker) return state("not-selected");
    if (this.#options.platform !== "darwin") return state("unavailable");
    return undefined;
  }

  #prerequisiteFailure(): DesktopLocalWorkerFailureCode | undefined {
    const state = this.#prerequisiteState();
    if (state?.status === "not-selected") return "not_selected";
    if (state?.status === "unavailable") return "unavailable";
    return undefined;
  }

  async #invoke(
    request: Parameters<MacOSWorkerCompanionInvoker["invoke"]>[0],
  ): Promise<DesktopLocalWorkerState> {
    try {
      return await this.#options.companion.invoke(request);
    } catch {
      return state("invalid");
    }
  }

  async #exclusive(
    operation: () => Promise<DesktopLocalWorkerOperationResult>,
  ): Promise<DesktopLocalWorkerOperationResult> {
    if (this.#busy) return failed("busy");
    this.#busy = true;
    try {
      return await operation();
    } finally {
      this.#busy = false;
    }
  }
}

export function toNodeWebSocketUrl(serverUrl: string): string {
  const url = new URL(serverUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Desktop Server origin is invalid.");
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/nodes";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function isValidNodeId(value: string): boolean {
  return value.length >= 1 && value.length <= 128 && nodeIdPattern.test(value);
}

function sameConfiguredConnection(
  expected: Extract<DesktopConnectionState, { status: "configured" }>,
  actual: DesktopConnectionState,
): boolean {
  return actual.status === "configured" && actual.serverUrl === expected.serverUrl;
}

function state(status: DesktopLocalWorkerState["status"]): DesktopLocalWorkerState {
  return Object.freeze({ status });
}

function succeeded(stateValue: DesktopLocalWorkerState): DesktopLocalWorkerOperationResult {
  return Object.freeze({ status: "succeeded", state: stateValue });
}

function failed(code: DesktopLocalWorkerFailureCode): DesktopLocalWorkerOperationResult {
  return Object.freeze({ status: "failed", code });
}
