import assert from "node:assert/strict";
import { channel } from "node:diagnostics_channel";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { app, safeStorage, utilityProcess } from "electron";
import postgres from "postgres";
import { NativeServerController } from "../dist/native-server.js";

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("This smoke gate requires native Windows x64.");
}
const runtimeRoot = resolve(process.argv[2] ?? "native-runtime");
if (!process.argv[3]) throw new Error("A fresh native smoke result path is required.");
const resultPath = resolve(process.argv[3]);
async function runSmoke() {
  let succeeded = false;
  console.info("Windows native smoke: Electron ready.");
  const dataRoot = await mkdtemp(join(tmpdir(), "openbot-windows-native-"));
  // mkdtemp starts with the user's inherited ACL, so let the controller create and protect its child.
  const clusterRoot = join(dataRoot, "local-server");
  let databaseUrl;
  let loginCount = 0;
  let cooperativeShutdownFailed = false;
  let database;
  const diagnostics = channel("openbot.desktop.native-startup");
  const reportDiagnostic = (message) => {
    const text = JSON.stringify(message, (_key, value) =>
      value instanceof Error
        ? { name: value.name, message: value.message, code: value.code }
        : value,
    );
    // This process owns disposable fixtures only; never publish generated bootstrap secrets.
    console.error(
      "Windows native diagnostic:",
      text
        .replace(/postgres(?:ql)?:\/\/[^\s"\\]+/gu, "[database URL]")
        .replace(/[a-f0-9]{64}/giu, "[generated secret]")
        .slice(0, 18_000),
    );
  };
  diagnostics.subscribe(reportDiagnostic);
  const controller = new NativeServerController({
    runtimeRoot,
    dataRoot: clusterRoot,
    platform: process.platform,
    encrypt(value) {
      assert.equal(safeStorage.isEncryptionAvailable(), true, "DPAPI must be available");
      return safeStorage.encryptString(value).toString("base64");
    },
    decrypt(value) {
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    },
    async launchServer(env) {
      databaseUrl = env.OPENBOT_DATABASE_URL;
      const fixtureEnvironment = { ...env };
      delete fixtureEnvironment.TAVILY_API_KEY;
      delete fixtureEnvironment.OPENBOT_PLUGIN_LOCAL_ENDPOINTS;
      const child = utilityProcess.fork(join(runtimeRoot, "apps/server/dist/index.js"), [], {
        env: fixtureEnvironment,
        cwd: runtimeRoot,
        stdio: ["ignore", "ignore", "pipe"],
        serviceName: "OpenBot Windows CI Server",
      });
      let alive = true;
      let serverReady = false;
      let errorTail = "";
      child.stderr?.on("data", (chunk) => {
        errorTail = (errorTail + chunk.toString()).slice(-4096);
      });
      child.once("exit", (code) => {
        if (code !== 0 || !serverReady)
          reportDiagnostic({ operation: "Server exit", code, stderr: errorTail });
        alive = false;
      });
      await new Promise((resolveReady, reject) => {
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("Server readiness timed out"));
        }, 30_000);
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("Server exited before readiness"));
        });
        child.on("message", (message) => {
          if (
            message?.type === "openbot-server-ready" &&
            message.port === Number(env.OPENBOT_PORT)
          ) {
            clearTimeout(timer);
            serverReady = true;
            resolveReady();
          }
        });
      });
      return {
        isAlive: () => alive,
        async stop() {
          if (!alive) return;
          await new Promise((resolveStopped, reject) => {
            const timer = setTimeout(() => {
              child.kill();
              cooperativeShutdownFailed = true;
              reject(new Error("Cooperative Server shutdown timed out"));
            }, 12_000);
            child.once("exit", () => {
              clearTimeout(timer);
              resolveStopped();
            });
            child.postMessage({ type: "openbot-server-shutdown" });
          });
        },
      };
    },
    async connect(url, password) {
      const health = await fetch(`${url}/health`);
      assert.equal(health.ok, true);
      assert.equal((await health.json()).service, "openbot-server");
      const login = await fetch(`${url}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: url },
        body: JSON.stringify({ password }),
      });
      assert.equal(login.ok, true);
      const cookie = login.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie);
      const channels = await fetch(`${url}/api/v1/channels`, { headers: { Cookie: cookie } });
      assert.equal(channels.ok, true, "authenticated migrated API must respond");
      loginCount += 1;
    },
    async authenticate() {},
  });
  try {
    console.info("Windows native smoke: starting local Server.");
    const first = await controller.start();
    assert.equal(first.status, "ready", JSON.stringify(first));
    database = postgres(databaseUrl, { max: 1 });
    await database`create table openbot_windows_smoke (value text not null)`;
    await database`insert into openbot_windows_smoke values ('retained across restart')`;
    await database.end();
    database = undefined;
    const encryptedBefore = await readFile(join(clusterRoot, "bootstrap.json"), "utf8");
    assert.equal(encryptedBefore.includes("databasePassword"), false);
    await controller.stop();
    assert.equal(cooperativeShutdownFailed, false);
    await assert.rejects(fetch(`${first.serverUrl}/health`));
    assert.equal(controller.getState().status, "idle");
    console.info("Windows native smoke: restarting retained cluster.");
    const second = await controller.start();
    assert.equal(second.status, "ready", JSON.stringify(second));
    assert.equal(await readFile(join(clusterRoot, "bootstrap.json"), "utf8"), encryptedBefore);
    database = postgres(databaseUrl, { max: 1 });
    const rows = await database`select value from openbot_windows_smoke`;
    assert.equal(rows[0].value, "retained across restart");
    assert.equal(loginCount, 2);
    succeeded = true;
  } finally {
    await database?.end();
    await controller.stop();
    await rm(dataRoot, { recursive: true, force: true });
    diagnostics.unsubscribe(reportDiagnostic);
    if (succeeded) {
      await writeFile(
        resultPath,
        JSON.stringify({
          schemaVersion: 1,
          platform: process.platform,
          arch: process.arch,
          checks: [
            "postgresql",
            "migrations",
            "dpapi",
            "owner-login",
            "retained-data",
            "stop",
            "restart",
            "cleanup",
          ],
        }),
        { flag: "wx" },
      );
      console.info(
        "Windows native smoke passed: PostgreSQL, migrations, DPAPI, Owner login, retained data, stop, restart and cleanup.",
      );
    }
    app.quit();
  }
}

// Electron emits ready after ESM evaluation; awaiting it at module scope deadlocks.
void app
  .whenReady()
  .then(runSmoke)
  .catch((error) => {
    console.error("Windows native smoke failed:", error);
    app.exit(1);
  });
