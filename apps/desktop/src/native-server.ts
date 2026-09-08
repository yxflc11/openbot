import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import postgresClient from "postgres";
import { LocalSessionRecovery } from "./local-session-recovery.js";
import { RestrictedJsonFile } from "./restricted-json-file.js";
import type { NativeServerState } from "./runtime-contract.js";

interface BootstrapSecrets {
  databasePassword: string;
  ownerPassword: string;
  modelKey: string;
}
export interface ManagedServerProcess {
  stop(): Promise<void>;
  isAlive(): boolean;
}
export interface NativeServerOptions {
  runtimeRoot: string;
  dataRoot: string;
  platform: string;
  encrypt(value: string): string;
  decrypt(value: string): string;
  launchServer(env: Record<string, string>): Promise<ManagedServerProcess>;
  connect(serverUrl: string, ownerPassword: string): Promise<void>;
  authenticate(serverUrl: string, ownerPassword: string): Promise<void>;
}

/** Owns only this app's cluster and child process. Renderer input cannot name paths or commands. */
export class NativeServerController {
  readonly #options: NativeServerOptions;
  #state: NativeServerState = { status: "idle" };
  #pending: Promise<NativeServerState> | undefined;
  #postgres: ChildProcess | undefined;
  #server: ManagedServerProcess | undefined;
  #stopping = false;
  #ownedUrl: string | undefined;
  readonly #sessionRecovery = new LocalSessionRecovery();

  constructor(options: NativeServerOptions) {
    this.#options = options;
  }
  getState(): NativeServerState {
    if (this.#state.status === "ready" && !this.#server?.isAlive()) {
      this.#state = { status: "failed", code: "service_stopped" };
    }
    return Object.freeze({ ...this.#state });
  }
  owns(url: string): boolean {
    return this.#ownedUrl === url && this.#server?.isAlive() === true;
  }

  restoreSession(serverUrl: string) {
    return this.#sessionRecovery.restore(serverUrl);
  }

  start(): Promise<NativeServerState> {
    if (this.#stopping) return Promise.resolve({ status: "failed", code: "stopping" });
    if (this.#pending) return this.#pending;
    if (this.#state.status === "ready" && this.#server?.isAlive())
      return Promise.resolve(this.getState());
    this.#pending = this.#start()
      .catch(async () => {
        await this.#stopChildren();
        this.#state = { status: "failed", code: "installation_failed" };
        return this.getState();
      })
      .finally(() => {
        this.#pending = undefined;
      });
    return this.#pending;
  }

  async #start(): Promise<NativeServerState> {
    if (this.#options.platform !== "darwin") {
      this.#state = { status: "failed", code: "unsupported_platform" };
      return this.getState();
    }
    await this.#stopChildren();
    this.#state = { status: "installing", step: "checking" };
    const { runtimeRoot, dataRoot } = this.#options;
    const bin = join(runtimeRoot, "postgres/bin");
    for (const name of ["initdb", "postgres"]) {
      const file = await lstat(join(bin, name));
      if (!file.isFile() || file.isSymbolicLink()) throw new Error("Native executable missing.");
    }
    await privateDirectory(dataRoot);
    const secretFile = new RestrictedJsonFile<string>(join(dataRoot, "bootstrap.json"), {
      label: "Encrypted local bootstrap",
      maximumBytes: 8192,
      parse: (input) => {
        const value: unknown = JSON.parse(input);
        if (typeof value !== "string" || !/^[A-Za-z0-9+/=]{32,8000}$/u.test(value))
          throw new Error("Invalid encrypted bootstrap.");
        return value;
      },
    });
    const retained = await secretFile.load();
    const cluster = join(dataRoot, "postgres");
    const clusterExists = await exists(cluster);
    if (!retained && clusterExists) throw new Error("Existing cluster has no bootstrap identity.");
    const secrets = retained
      ? parseSecrets(this.#options.decrypt(retained))
      : {
          databasePassword: randomBytes(32).toString("hex"),
          ownerPassword: randomBytes(32).toString("hex"),
          modelKey: randomBytes(32).toString("hex"),
        };
    if (!retained) await secretFile.save(this.#options.encrypt(JSON.stringify(secrets)));
    this.#state = { status: "installing", step: "database" };
    if (!clusterExists) {
      const staging = await mkdtemp(join(dataRoot, ".initializing-"));
      try {
        await runBounded(
          join(bin, "initdb"),
          [
            "-D",
            join(staging, "postgres"),
            "-U",
            "openbot",
            "--auth=scram-sha-256",
            "--encoding=UTF8",
            "--locale=C",
            "--pwfile=/dev/stdin",
          ],
          `${secrets.databasePassword}\n`,
        );
        await rename(join(staging, "postgres"), cluster);
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    } else {
      await privateDirectory(cluster);
      if ((await readFile(join(cluster, "PG_VERSION"), "utf8")).trim() !== "17")
        throw new Error("Cluster requires an explicit upgrade.");
    }
    if (this.#stopping) throw new Error("Stopping.");
    const dbPort = await availablePort();
    this.#postgres = spawn(
      join(bin, "postgres"),
      ["-D", cluster, "-h", "127.0.0.1", "-p", String(dbPort), "-k", ""],
      {
        env: nativeEnvironment(),
        stdio: "ignore",
        shell: false,
      },
    );
    const postgres = this.#postgres;
    let pgFailed = false;
    postgres.on("error", () => {
      pgFailed = true;
    });
    postgres.on("exit", () => {
      if (!this.#stopping && this.#state.status === "ready") {
        this.#state = { status: "failed", code: "service_stopped" };
        void this.#stopChildren();
      }
    });
    const databaseUrl = `postgres://openbot:${secrets.databasePassword}@127.0.0.1:${dbPort}/postgres`;
    await waitUntil(async () => {
      if (pgFailed || postgres.exitCode !== null || postgres.signalCode !== null || this.#stopping)
        throw new Error("Postgres stopped.");
      const connection = postgresClient(databaseUrl, {
        max: 1,
        connect_timeout: 2,
        idle_timeout: 1,
      });
      try {
        await connection`select 1`;
        return true;
      } catch {
        return false;
      } finally {
        await connection.end({ timeout: 1 });
      }
    });
    this.#state = { status: "installing", step: "server" };
    const port = await availablePort();
    const url = `http://127.0.0.1:${port}`;
    this.#server = await this.#options.launchServer({
      ...nativeEnvironment(),
      OPENBOT_HOST: "127.0.0.1",
      OPENBOT_PORT: String(port),
      OPENBOT_DATABASE_URL: databaseUrl,
      OPENBOT_OWNER_PASSWORD: secrets.ownerPassword,
      OPENBOT_ALLOWED_ORIGINS: url,
      OPENBOT_OBJECT_STORE_PATH: join(dataRoot, "objects"),
      OPENBOT_MODEL_SETTINGS_PATH: join(dataRoot, "model-settings.json"),
      OPENBOT_MODEL_ENCRYPTION_KEY: secrets.modelKey,
      OPENBOT_LOG_LEVEL: "error",
    });
    this.#ownedUrl = url;
    this.#state = { status: "installing", step: "connecting" };
    await waitUntil(async () => {
      if (this.#stopping || !this.#server?.isAlive()) throw new Error("Server stopped.");
      try {
        await this.#options.connect(url, secrets.ownerPassword);
        return true;
      } catch {
        return false;
      }
    });
    const server = this.#server;
    this.#sessionRecovery.bind(
      url,
      () => this.#options.authenticate(url, secrets.ownerPassword),
      () => !this.#stopping && this.#server === server && this.owns(url),
    );
    this.#state = { status: "ready", serverUrl: url };
    return this.getState();
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    await this.#pending;
    await this.#stopChildren();
    this.#state = { status: "idle" };
    this.#stopping = false;
  }
  async #stopChildren(): Promise<void> {
    this.#sessionRecovery.clear();
    this.#ownedUrl = undefined;
    const server = this.#server;
    this.#server = undefined;
    await server?.stop().catch(() => undefined);
    const postgres = this.#postgres;
    this.#postgres = undefined;
    if (postgres) await stopPostgres(postgres);
  }
}

function parseSecrets(value: string): BootstrapSecrets {
  const parsed = JSON.parse(value) as BootstrapSecrets;
  if (
    Object.keys(parsed).sort().join() !== "databasePassword,modelKey,ownerPassword" ||
    !Object.values(parsed).every((item) => typeof item === "string" && /^[a-f0-9]{64}$/u.test(item))
  )
    throw new Error("Invalid local bootstrap.");
  return parsed;
}
async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const entry = await lstat(path);
  if (
    !entry.isDirectory() ||
    entry.isSymbolicLink() ||
    (entry.mode & 0o077) !== 0 ||
    entry.uid !== process.getuid?.()
  )
    throw new Error("Unsafe local data directory.");
}
async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
function nativeEnvironment(): Record<string, string> {
  return { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" };
}
export async function availablePort(): Promise<number> {
  const listener = createServer();
  return new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      if (!address || typeof address === "string") {
        listener.close();
        reject(new Error("No local port."));
        return;
      }
      listener.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}
export function runBounded(
  executable: string,
  args: string[],
  input?: string,
  timeout = 30_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: nativeEnvironment(),
      stdio: ["pipe", "ignore", "ignore"],
      shell: false,
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdin?.on("error", () => undefined);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Native operation failed."));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error("Native operation failed."));
    });
    child.stdin?.end(input);
  });
}
async function waitUntil(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(250);
  }
  throw new Error("Native startup timed out.");
}
async function stopPostgres(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const fast = setTimeout(() => child.kill("SIGQUIT"), 8000);
    const forced = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 12000);
    child.once("exit", () => {
      clearTimeout(fast);
      clearTimeout(forced);
      resolve();
    });
    child.kill("SIGINT");
  });
}
