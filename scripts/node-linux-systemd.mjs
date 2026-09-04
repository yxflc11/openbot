import { runBoundedCommand } from "./node-linux-provenance.mjs";

export const LINUX_SYSTEMD_SERVICE = Object.freeze({
  executable: "/usr/bin/systemctl",
  unit: "openbot-node.service",
  upstreamVersion: "255",
});

const maximumOutputBytes = 4 * 1024;
const commandTimeoutMs = 15_000;

/**
 * System-profile adapter only. User services require a separately reviewed login-session boundary
 * so a privileged installer cannot synthesize a D-Bus or Secret Service environment.
 */
export function createLinuxSystemdServiceAdapter(options = {}) {
  if (!isRecord(options)) throw new Error("Linux systemd adapter options are malformed.");
  const runner = options.commandRunner ?? runBoundedCommand;
  if (typeof runner !== "function") throw new Error("Linux systemd adapter requires a runner.");
  let versionVerified = false;

  const environment = {
    PATH: "/usr/bin:/bin",
    LANG: "C",
    LC_ALL: "C",
    SYSTEMD_COLORS: "0",
    SYSTEMD_PAGER: "cat",
  };

  const ensureVersion = async (signal) => {
    if (versionVerified) return;
    const result = await runChecked(runner, {
      executable: LINUX_SYSTEMD_SERVICE.executable,
      arguments: ["--version"],
      environment,
      maximumBytes: maximumOutputBytes,
      signal,
      timeoutMs: 5_000,
    });
    const firstLine = result.stdout.toString("utf8").split(/\r?\n/u)[0];
    if (!/^systemd 255 \(255\.4-1ubuntu8\.[0-9]+\)$/u.test(firstLine)) {
      throw new Error("Linux systemd version is outside the reviewed Ubuntu 24.04 line.");
    }
    versionVerified = true;
  };

  return {
    async isActive(signal) {
      await ensureVersion(signal);
      const result = await runChecked(runner, {
        executable: LINUX_SYSTEMD_SERVICE.executable,
        arguments: [
          "--no-pager",
          "show",
          "--property=LoadState",
          "--property=ActiveState",
          LINUX_SYSTEMD_SERVICE.unit,
        ],
        environment,
        maximumBytes: maximumOutputBytes,
        signal,
        timeoutMs: commandTimeoutMs,
      });
      return parseSystemdState(result.stdout);
    },

    async restartSelected(signal) {
      await ensureVersion(signal);
      await runChecked(
        runner,
        {
          executable: LINUX_SYSTEMD_SERVICE.executable,
          arguments: ["--no-pager", "restart", LINUX_SYSTEMD_SERVICE.unit],
          environment,
          maximumBytes: maximumOutputBytes,
          signal,
          timeoutMs: commandTimeoutMs,
        },
        true,
      );
    },
  };
}

export function parseSystemdState(output) {
  if (!Buffer.isBuffer(output) || output.length < 1 || !output.toString("utf8").endsWith("\n")) {
    throw new Error("Linux systemd state output is malformed.");
  }
  const properties = new Map();
  for (const line of output.toString("utf8").slice(0, -1).split("\n")) {
    const match = /^(LoadState|ActiveState)=([a-z-]{1,32})$/u.exec(line);
    if (match === null || properties.has(match[1])) {
      throw new Error("Linux systemd state output is malformed.");
    }
    properties.set(match[1], match[2]);
  }
  if (properties.size !== 2 || properties.get("LoadState") !== "loaded") {
    throw new Error("Linux systemd service is not loaded exactly once.");
  }
  const activeState = properties.get("ActiveState");
  if (activeState === "active") return true;
  if (activeState === "inactive") return false;
  throw new Error("Linux systemd service is failed or in a transitional state.");
}

async function runChecked(runner, request, requireEmptyOutput = false) {
  let result;
  try {
    result = await runner(request);
  } catch {
    throw new Error("Linux systemd command failed.");
  }
  if (
    !isRecord(result) ||
    result.exitCode !== 0 ||
    result.signal !== null ||
    !Buffer.isBuffer(result.stdout) ||
    !Buffer.isBuffer(result.stderr) ||
    result.stdout.length > request.maximumBytes ||
    result.stderr.length > request.maximumBytes ||
    result.stderr.length !== 0 ||
    (requireEmptyOutput && result.stdout.length !== 0)
  ) {
    throw new Error("Linux systemd command failed.");
  }
  return result;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
