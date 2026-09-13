/**
 * Portable helpers for the Windows native smoke / cold-start gate.
 * No Electron or Windows runtime required for the pure helpers under test.
 */

export const COLD_START_ROUNDS = 10;

/** Historical install-gate checks that must remain present on the final receipt. */
export const BASE_SMOKE_CHECKS = Object.freeze([
  "postgresql",
  "migrations",
  "dpapi",
  "owner-login",
  "retained-data",
  "stop",
  "restart",
  "cleanup",
]);

export const STATE_FILE_NAME = "cold-start-state.json";
export const STATE_SCHEMA_VERSION = 1;
export const SMOKE_ROW_VALUE = "retained across cold start";

/**
 * @param {unknown} pid
 * @returns {boolean}
 */
export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid > 2_147_483_647) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {number | null | undefined} previousPid
 * @param {number} currentPid
 */
export function assertNewProcessIdentity(previousPid, currentPid) {
  if (!Number.isInteger(currentPid) || currentPid <= 0) {
    throw new Error("Current process identity is missing.");
  }
  if (previousPid == null) return;
  if (!Number.isInteger(previousPid) || previousPid <= 0) {
    throw new Error("Previous process identity is invalid.");
  }
  if (previousPid === currentPid) {
    throw new Error(`Expected a new process identity, reused PID ${currentPid}.`);
  }
}

/**
 * @param {{ electronPid?: number | null, postgresPid?: number | null, serverPid?: number | null }} previous
 */
export function assertPreviousChildrenEnded(previous) {
  const lingering = [];
  for (const [label, pid] of [
    ["electron", previous.electronPid],
    ["postgres", previous.postgresPid],
    ["server", previous.serverPid],
  ]) {
    if (pid == null) continue;
    if (isProcessAlive(pid)) lingering.push(`${label}:${pid}`);
  }
  if (lingering.length > 0) {
    throw new Error(`Previous harness children still alive: ${lingering.join(", ")}`);
  }
}

/**
 * @param {string} contents
 * @returns {number | null}
 */
export function readPostmasterPid(contents) {
  const first = contents.trim().split(/\r?\n/u)[0];
  const pid = Number(first);
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2_147_483_647) return null;
  return pid;
}

/**
 * @param {number} completedRounds
 */
export function coldStartCheckName(completedRounds) {
  if (!Number.isInteger(completedRounds) || completedRounds < 0) {
    throw new Error("cold-start round count is invalid.");
  }
  return `cold-start-${completedRounds}`;
}

/**
 * @param {{ coldStarts: number, extraChecks?: string[] }} input
 */
export function buildFinalSmokeChecks(input) {
  const coldStarts = input.coldStarts;
  if (!Number.isInteger(coldStarts) || coldStarts < 0) {
    throw new Error("coldStarts must be a non-negative integer.");
  }
  const checks = [...BASE_SMOKE_CHECKS];
  if (coldStarts > 0) checks.push(coldStartCheckName(coldStarts));
  for (const check of input.extraChecks ?? []) {
    if (!checks.includes(check)) checks.push(check);
  }
  return checks;
}

/**
 * @param {{ coldStarts: number, platform?: string, arch?: string }} input
 */
export function buildFinalSmokeReceipt(input) {
  const coldStarts = input.coldStarts;
  if (coldStarts !== COLD_START_ROUNDS) {
    throw new Error(`Final receipt requires exactly ${COLD_START_ROUNDS} cold starts.`);
  }
  return {
    schemaVersion: 1,
    platform: input.platform ?? "win32",
    arch: input.arch ?? "x64",
    coldStarts,
    checks: buildFinalSmokeChecks({ coldStarts }),
  };
}

/**
 * @param {unknown} value
 * @returns {value is {
 *   schemaVersion: number,
 *   smokeMarker: string,
 *   encryptedBootstrap: string,
 *   electronPid: number | null,
 *   postgresPid: number | null,
 *   serverPid: number | null,
 *   coldStartsCompleted: number,
 *   bootstrapComplete: boolean,
 * }}
 */
export function isColdStartState(value) {
  if (!value || typeof value !== "object") return false;
  const state = /** @type {Record<string, unknown>} */ (value);
  return (
    state.schemaVersion === STATE_SCHEMA_VERSION &&
    typeof state.smokeMarker === "string" &&
    typeof state.encryptedBootstrap === "string" &&
    state.encryptedBootstrap.length > 0 &&
    (state.electronPid === null || Number.isInteger(state.electronPid)) &&
    (state.postgresPid === null || Number.isInteger(state.postgresPid)) &&
    (state.serverPid === null || Number.isInteger(state.serverPid)) &&
    Number.isInteger(state.coldStartsCompleted) &&
    typeof state.bootstrapComplete === "boolean"
  );
}

/**
 * @param {Partial<{
 *   smokeMarker: string,
 *   encryptedBootstrap: string,
 *   electronPid: number | null,
 *   postgresPid: number | null,
 *   serverPid: number | null,
 *   coldStartsCompleted: number,
 *   bootstrapComplete: boolean,
 * }>} fields
 */
export function createColdStartState(fields) {
  const state = {
    schemaVersion: STATE_SCHEMA_VERSION,
    smokeMarker: fields.smokeMarker ?? SMOKE_ROW_VALUE,
    encryptedBootstrap: fields.encryptedBootstrap ?? "",
    electronPid: fields.electronPid ?? null,
    postgresPid: fields.postgresPid ?? null,
    serverPid: fields.serverPid ?? null,
    coldStartsCompleted: fields.coldStartsCompleted ?? 0,
    bootstrapComplete: fields.bootstrapComplete ?? false,
  };
  if (!isColdStartState(state) || state.encryptedBootstrap.length === 0) {
    throw new Error("Refusing to create an incomplete cold-start state.");
  }
  return state;
}

export const EXPECTED_FINAL_CHECKS_JOINED = buildFinalSmokeChecks({
  coldStarts: COLD_START_ROUNDS,
}).join(",");
