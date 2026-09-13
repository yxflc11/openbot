import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export interface DarwinPostgresProcess {
  isAlive(): boolean;
  stop(): Promise<void>;
}

/** Keep shutdown authority in a native parent that survives Desktop main-process death. */
export async function startDarwinPostgres(
  runtimeRoot: string,
  dataRoot: string,
  port: number,
  onExit: () => void,
): Promise<DarwinPostgresProcess> {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid native database port.");
  const cluster = join(dataRoot, "postgres");
  // The previous parent may still be completing its bounded shutdown. Never remove its lock;
  // after this grace period PostgreSQL itself decides whether an existing lock is stale.
  const deadline = Date.now() + 15_000;
  while (existsSync(join(cluster, "postmaster.pid")) && Date.now() < deadline) await delay(100);
  const child = spawn(
    join(runtimeRoot, "postgres-supervisor"),
    [join(runtimeRoot, "postgres/bin/postgres"), cluster, String(port)],
    {
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      stdio: ["pipe", "ignore", "ignore"],
      shell: false,
    },
  );
  let alive = true;
  const exited = new Promise<void>((resolve) => {
    const done = () => {
      if (!alive) return;
      alive = false;
      resolve();
      onExit();
    };
    child.once("error", done);
    child.once("exit", done);
  });
  child.stdin.on("error", () => undefined);
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", () => reject(new Error("Native database supervisor failed to start.")));
  });
  let pendingStop: Promise<void> | undefined;
  return {
    isAlive: () => alive,
    stop() {
      if (pendingStop) return pendingStop;
      if (!alive) return Promise.resolve();
      pendingStop = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          // Killing the supervisor here could orphan its child. It retains sole stop authority.
          reject(new Error("Native database supervisor has not completed shutdown."));
        }, 16_000);
        void exited.then(() => {
          clearTimeout(timer);
          resolve();
        });
        child.stdin.end();
      });
      return pendingStop;
    },
  };
}
