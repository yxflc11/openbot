import { execFile } from "node:child_process";
import { channel } from "node:diagnostics_channel";
import { readFile } from "node:fs/promises";
import { join, win32 } from "node:path";
import { promisify } from "node:util";
import { windowsNativeEnvironment } from "./windows-native-security.js";

const execute = promisify(execFile);
const diagnostics = channel("openbot.desktop.native-startup");

interface Identity {
  pid: number;
  started: number;
}

/** Bind native stop authority to the private cluster and this specific start attempt. */
export function parseWindowsPostmasterIdentity(
  contents: string,
  cluster: string,
  port: number,
  earliestStart: number,
): Identity {
  const lines = contents.trim().split(/\r?\n/u);
  const pid = Number(lines[0]);
  const started = Number(lines[2]);
  if (
    !Number.isSafeInteger(pid) ||
    pid <= 0 ||
    pid > 2_147_483_647 ||
    !Number.isSafeInteger(started) ||
    started < earliestStart ||
    win32.resolve(lines[1] ?? "").toLowerCase() !== win32.resolve(cluster).toLowerCase() ||
    Number(lines[3]) !== port
  )
    throw new Error("Native database process identity is invalid.");
  return { pid, started };
}

export interface WindowsPostgresProcess {
  isAlive(): boolean;
  stop(): Promise<void>;
}

/** pg_ctl creates PostgreSQL's restricted Windows token; direct postgres.exe cannot do that. */
export async function startWindowsPostgres(
  runtimeRoot: string,
  dataRoot: string,
  port: number,
  onExit: () => void,
): Promise<WindowsPostgresProcess> {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid native database port.");
  const executable = join(runtimeRoot, "postgres/bin/pg_ctl.exe");
  const cluster = join(dataRoot, "postgres");
  const pidFile = join(cluster, "postmaster.pid");
  const environment = windowsNativeEnvironment();
  async function command(args: string[], timeout = 30_000): Promise<void> {
    const operation = execute(executable, args, {
      env: environment,
      windowsHide: true,
      shell: false,
      timeout,
      maxBuffer: 16_384,
    });
    operation.child.stdin?.end();
    await operation;
  }
  try {
    await command(["status", "-D", cluster]);
    throw new Error("The native cluster is already running outside this controller.");
  } catch (error) {
    // pg_ctl's documented code 3 means that no postmaster is running.
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== 3) throw error;
  }
  const earliestStart = Math.floor(Date.now() / 1000) - 1;
  const identity = async () =>
    parseWindowsPostmasterIdentity(await readFile(pidFile, "utf8"), cluster, port, earliestStart);
  let owned: Identity | undefined;
  const stopOwned = async () => {
    const current = await identity();
    if (!owned || current.pid !== owned.pid || current.started !== owned.started)
      throw new Error("Native database ownership changed; refusing to stop it.");
    try {
      await command(["stop", "-D", cluster, "-m", "fast", "-w", "-t", "8"], 12_000);
    } catch {
      const retained = await identity();
      if (retained.pid !== owned.pid || retained.started !== owned.started)
        throw new Error("Native database ownership changed during stop.");
      await command(["stop", "-D", cluster, "-m", "immediate", "-w", "-t", "4"], 8_000);
    }
  };
  try {
    // A dedicated log prevents the long-lived postmaster from retaining execFile's output pipes.
    await command([
      "start",
      "-D",
      cluster,
      "-l",
      join(dataRoot, "postgres.log"),
      "-w",
      "-t",
      "20",
      "-o",
      `-h 127.0.0.1 -p ${port} -c unix_socket_directories=`,
    ]);
    owned = await identity();
  } catch (error) {
    // A timed-out start may still have created this attempt's process; clean up only proven identity.
    owned = await identity().catch(() => undefined);
    if (owned) await stopOwned();
    throw error;
  }
  const ownedIdentity = owned;
  let alive = true;
  let monitoring = false;
  const isAlive = () => {
    if (!alive) return false;
    try {
      process.kill(ownedIdentity.pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const monitor = setInterval(() => {
    if (monitoring || !alive) return;
    monitoring = true;
    void identity()
      .then((current) => {
        if (
          current.pid !== ownedIdentity.pid ||
          current.started !== ownedIdentity.started ||
          !isAlive()
        )
          throw new Error("Native database process exited.");
      })
      .catch(() => {
        if (!alive) return;
        alive = false;
        clearInterval(monitor);
        onExit();
      })
      .finally(() => {
        monitoring = false;
      });
  }, 2000);
  monitor.unref();
  return {
    isAlive,
    async stop() {
      clearInterval(monitor);
      if (!alive) return;
      if (!isAlive()) {
        alive = false;
        return;
      }
      alive = false;
      try {
        await stopOwned();
      } catch (error) {
        if (diagnostics.hasSubscribers) diagnostics.publish({ operation: "pg_ctl stop", error });
        throw error;
      }
    },
  };
}
