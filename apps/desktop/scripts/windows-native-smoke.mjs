import assert from "node:assert/strict";
import { channel } from "node:diagnostics_channel";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { app, safeStorage, utilityProcess } from "electron";
import postgres from "postgres";
import { NativeServerController } from "../dist/native-server.js";
import {
  COLD_START_ROUNDS,
  SMOKE_ROW_VALUE,
  STATE_FILE_NAME,
  assertNewProcessIdentity,
  assertPreviousChildrenEnded,
  buildFinalSmokeReceipt,
  createColdStartState,
  isColdStartState,
  readPostmasterPid,
} from "./windows-native-smoke-harness.mjs";

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("This smoke gate requires native Windows x64.");
}
const runtimeRoot = resolve(process.argv[2] ?? "native-runtime");
if (!process.argv[3]) throw new Error("A fresh native smoke result path is required.");
const resultPath = resolve(process.argv[3]);
const mode = process.argv[4] ?? "bootstrap";
if (mode !== "bootstrap" && mode !== "cold-start") {
  throw new Error('Smoke mode must be "bootstrap" or "cold-start".');
}
if (!process.argv[5]) throw new Error("A self-made harness root is required.");
const harnessRoot = resolve(process.argv[5]);
const clusterRoot = join(harnessRoot, "local-server");
const statePath = join(harnessRoot, STATE_FILE_NAME);
const electronUserData = join(harnessRoot, "electron-user-data");
const electronSessionData = join(harnessRoot, "electron-session-data");

// Keep Electron profile paths inside the disposable harness; never touch the user's real data dirs.
app.setPath("userData", electronUserData);
app.setPath("sessionData", electronSessionData);

async function readState() {
  const raw = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(isColdStartState(raw), true, "cold-start state is incomplete");
  return raw;
}

async function writeState(state) {
  assert.equal(isColdStartState(state), true, "refusing to persist incomplete state");
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function readPostgresPid() {
  try {
    return readPostmasterPid(await readFile(join(clusterRoot, "postgres", "postmaster.pid"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   requirePreviousEnded: boolean,
 *   previous: {
 *     electronPid: number | null,
 *     postgresPid: number | null,
 *     serverPid: number | null,
 *     encryptedBootstrap: string | null,
 *   },
 *   createRow: boolean,
 *   expectRow: boolean,
 *   sameProcessRestart: boolean,
 * }} options
 */
async function runControllerCycle(options) {
  let databaseUrl;
  let loginCount = 0;
  let cooperativeShutdownFailed = false;
  let database;
  let serverPid = null;
  const diagnostics = channel("openbot.desktop.native-startup");
  const reportDiagnostic = (message) => {
    const text = JSON.stringify(message, (_key, value) =>
      value instanceof Error
        ? { name: value.name, message: value.message, code: value.code }
        : value,
    );
    console.error(
      "Windows native diagnostic:",
      text
        .replace(/postgres(?:ql)?:\/\/[^\s"\\]+/gu, "[database URL]")
        .replace(/[a-f0-9]{64}/giu, "[generated secret]")
        .slice(0, 18_000),
    );
  };
  diagnostics.subscribe(reportDiagnostic);
  assert.equal(
    await safeStorage.isAsyncEncryptionAvailable(),
    true,
    "Async DPAPI must be available",
  );
  const legacyCiphertext = safeStorage.encryptString("openbot-legacy-storage-fixture");
  assert.equal(
    (await safeStorage.decryptStringAsync(legacyCiphertext)).result,
    "openbot-legacy-storage-fixture",
    "The async startup path must read credentials saved by the previous synchronous version",
  );

  if (options.requirePreviousEnded) {
    assertPreviousChildrenEnded(options.previous);
  }

  const controller = new NativeServerController({
    runtimeRoot,
    dataRoot: clusterRoot,
    platform: process.platform,
    async encrypt(value) {
      assert.equal(await safeStorage.isAsyncEncryptionAvailable(), true, "DPAPI must be available");
      return (await safeStorage.encryptStringAsync(value)).toString("base64");
    },
    async decrypt(value) {
      return (await safeStorage.decryptStringAsync(Buffer.from(value, "base64"))).result;
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
      serverPid = child.pid ?? null;
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

  let encryptedBootstrap = options.previous.encryptedBootstrap;
  let postgresPid = null;
  let stoppedPostgresPid = null;
  let stoppedServerPid = null;
  try {
    console.info(`Windows native smoke (${mode}): starting local Server.`);
    const first = await controller.start();
    assert.equal(first.status, "ready", JSON.stringify(first));
    assertNewProcessIdentity(options.previous.electronPid, process.pid);
    postgresPid = await readPostgresPid();
    assert.ok(postgresPid, "postmaster pid must be recorded");
    assertNewProcessIdentity(options.previous.postgresPid, postgresPid);
    if (serverPid != null) assertNewProcessIdentity(options.previous.serverPid, serverPid);

    database = postgres(databaseUrl, { max: 1 });
    if (options.createRow) {
      await database`create table openbot_windows_smoke (value text not null)`;
      await database`insert into openbot_windows_smoke values (${SMOKE_ROW_VALUE})`;
    }
    if (options.expectRow) {
      const rows = await database`select value from openbot_windows_smoke`;
      assert.equal(rows[0].value, SMOKE_ROW_VALUE);
    }
    await database.end();
    database = undefined;

    const encryptedBefore = await readFile(join(clusterRoot, "bootstrap.json"), "utf8");
    assert.equal(encryptedBefore.includes("databasePassword"), false);
    if (encryptedBootstrap != null) {
      assert.equal(encryptedBefore, encryptedBootstrap, "DPAPI bootstrap ciphertext must persist");
    }
    encryptedBootstrap = encryptedBefore;

    stoppedPostgresPid = postgresPid;
    stoppedServerPid = serverPid;
    await controller.stop();
    assert.equal(cooperativeShutdownFailed, false);
    await assert.rejects(fetch(`${first.serverUrl}/health`));
    assert.equal(controller.getState().status, "idle");
    assertPreviousChildrenEnded({
      electronPid: null,
      postgresPid: stoppedPostgresPid,
      serverPid: stoppedServerPid,
    });
    assert.equal(await readPostgresPid(), null, "postmaster.pid must clear after stop");

    if (options.sameProcessRestart) {
      console.info("Windows native smoke: same-process retained restart.");
      const second = await controller.start();
      assert.equal(second.status, "ready", JSON.stringify(second));
      assert.equal(await readFile(join(clusterRoot, "bootstrap.json"), "utf8"), encryptedBefore);
      postgresPid = await readPostgresPid();
      assert.ok(postgresPid, "restarted postmaster pid must be recorded");
      database = postgres(databaseUrl, { max: 1 });
      const rows = await database`select value from openbot_windows_smoke`;
      assert.equal(rows[0].value, SMOKE_ROW_VALUE);
      await database.end();
      database = undefined;
      assert.equal(loginCount, 2);
      stoppedPostgresPid = postgresPid;
      stoppedServerPid = serverPid;
      await controller.stop();
      assert.equal(cooperativeShutdownFailed, false);
      assertPreviousChildrenEnded({
        electronPid: null,
        postgresPid: stoppedPostgresPid,
        serverPid: stoppedServerPid,
      });
      assert.equal(await readPostgresPid(), null, "postmaster.pid must clear after restart stop");
    } else {
      assert.equal(loginCount, 1);
    }

    return {
      encryptedBootstrap,
      electronPid: process.pid,
      postgresPid: stoppedPostgresPid,
      serverPid: stoppedServerPid,
      loginCount,
    };
  } finally {
    await database?.end().catch(() => undefined);
    await controller.stop().catch(() => undefined);
    diagnostics.unsubscribe(reportDiagnostic);
  }
}

async function runSmoke() {
  let succeeded = false;
  console.info(`Windows native smoke: Electron ready (mode=${mode}, pid=${process.pid}).`);
  await mkdir(electronUserData, { recursive: true });
  await mkdir(electronSessionData, { recursive: true });

  try {
    if (mode === "bootstrap") {
      const cycle = await runControllerCycle({
        requirePreviousEnded: false,
        previous: {
          electronPid: null,
          postgresPid: null,
          serverPid: null,
          encryptedBootstrap: null,
        },
        createRow: true,
        expectRow: false,
        sameProcessRestart: true,
      });
      await writeState(
        createColdStartState({
          encryptedBootstrap: cycle.encryptedBootstrap,
          electronPid: cycle.electronPid,
          postgresPid: cycle.postgresPid,
          serverPid: cycle.serverPid,
          coldStartsCompleted: 0,
          bootstrapComplete: true,
        }),
      );
      await writeFile(
        resultPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            platform: process.platform,
            arch: process.arch,
            mode: "bootstrap",
            electronPid: process.pid,
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
          },
          null,
          2,
        ),
        { flag: "wx" },
      );
      console.info(
        "Windows native smoke bootstrap passed: PostgreSQL, migrations, DPAPI, Owner login, retained data, stop, restart and cleanup.",
      );
    } else {
      const previous = await readState();
      assert.equal(previous.bootstrapComplete, true, "cold-start requires bootstrap state");
      assert.ok(
        previous.coldStartsCompleted < COLD_START_ROUNDS,
        `cold-start round overflow (${previous.coldStartsCompleted})`,
      );
      const cycle = await runControllerCycle({
        requirePreviousEnded: true,
        previous: {
          electronPid: previous.electronPid,
          postgresPid: previous.postgresPid,
          serverPid: previous.serverPid,
          encryptedBootstrap: previous.encryptedBootstrap,
        },
        createRow: false,
        expectRow: true,
        sameProcessRestart: false,
      });
      const coldStartsCompleted = previous.coldStartsCompleted + 1;
      await writeState(
        createColdStartState({
          encryptedBootstrap: cycle.encryptedBootstrap,
          electronPid: cycle.electronPid,
          postgresPid: cycle.postgresPid,
          serverPid: cycle.serverPid,
          coldStartsCompleted,
          bootstrapComplete: true,
        }),
      );
      const receipt =
        coldStartsCompleted === COLD_START_ROUNDS
          ? buildFinalSmokeReceipt({
              coldStarts: coldStartsCompleted,
              platform: process.platform,
              arch: process.arch,
            })
          : {
              schemaVersion: 1,
              platform: process.platform,
              arch: process.arch,
              mode: "cold-start",
              coldStartsCompleted,
              electronPid: process.pid,
              checks: [
                "postgresql",
                "dpapi",
                "owner-login",
                "retained-data",
                "stop",
                "cleanup",
                `cold-start-${coldStartsCompleted}`,
              ],
            };
      await writeFile(resultPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
      console.info(
        `Windows native smoke cold-start ${coldStartsCompleted}/${COLD_START_ROUNDS} passed (pid=${process.pid}).`,
      );
    }
    succeeded = true;
  } finally {
    if (!succeeded) {
      console.error(
        JSON.stringify({
          summary: "Windows native smoke failed; harness processes should be cleaned by the orchestrator.",
          mode,
          electronPid: process.pid,
          harnessRoot,
        }),
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
