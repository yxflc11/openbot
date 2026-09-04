import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDesktopSetupPlan,
  deriveDesktopSetupChecklist,
  DESKTOP_SETUP_PLAN_FORMAT,
  FileDesktopSetupPlanStore,
  MAXIMUM_DESKTOP_SETUP_PLAN_BYTES,
  parseDesktopSetupPlan,
} from "./setup-plan.js";

describe("Desktop setup plan schema", () => {
  it.each([
    { mode: "client", plannedWorkerCount: 0, localWorker: false },
    { mode: "client-worker", plannedWorkerCount: 5, localWorker: true },
    { mode: "host", plannedWorkerCount: 0, localWorker: false },
    { mode: "host", plannedWorkerCount: 5, localWorker: true },
    { mode: "advanced", plannedWorkerCount: 5, localWorker: false },
  ] as const)("accepts the canonical $mode composition", (input) => {
    const plan = createDesktopSetupPlan(input);
    expect(plan).toEqual({ format: DESKTOP_SETUP_PLAN_FORMAT, ...input });
    expect(parseDesktopSetupPlan(JSON.stringify(plan))).toEqual(plan);
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it.each([
    { mode: "client", plannedWorkerCount: 1, localWorker: false },
    { mode: "client", plannedWorkerCount: 0, localWorker: true },
    { mode: "client-worker", plannedWorkerCount: 0, localWorker: true },
    { mode: "client-worker", plannedWorkerCount: 2, localWorker: false },
    { mode: "advanced", plannedWorkerCount: 1, localWorker: true },
    { mode: "host", plannedWorkerCount: 0, localWorker: true },
    { mode: "host", plannedWorkerCount: 101, localWorker: false },
    { mode: "host", plannedWorkerCount: 1.5, localWorker: false },
  ])("rejects contradictory or unbounded input %#", (input) => {
    expect(() => createDesktopSetupPlan(input)).toThrow();
  });

  it("rejects unknown fields, formats, modes, and oversized bytes", () => {
    expect(() => createDesktopSetupPlan({ mode: "client", plannedWorkerCount: 0 })).toThrow(
      /unknown/u,
    );
    expect(() =>
      createDesktopSetupPlan({
        mode: "client",
        plannedWorkerCount: 0,
        localWorker: false,
        installed: true,
      }),
    ).toThrow(/unknown/u);
    expect(() =>
      parseDesktopSetupPlan(
        JSON.stringify({
          format: "openbot.desktop-setup-plan/v2",
          mode: "client",
          plannedWorkerCount: 0,
          localWorker: false,
        }),
      ),
    ).toThrow(/version/u);
    expect(() =>
      parseDesktopSetupPlan(
        JSON.stringify({
          format: DESKTOP_SETUP_PLAN_FORMAT,
          mode: "automatic",
          plannedWorkerCount: 0,
          localWorker: false,
        }),
      ),
    ).toThrow(/mode/u);
    expect(() => parseDesktopSetupPlan("x".repeat(MAXIMUM_DESKTOP_SETUP_PLAN_BYTES + 1))).toThrow(
      /4 KiB/u,
    );
  });

  it("derives a stable five-computer checklist without claiming completion", () => {
    const checklist = deriveDesktopSetupChecklist({
      mode: "client-worker",
      plannedWorkerCount: 5,
      localWorker: true,
    });
    expect(checklist).toEqual([
      { id: "desktop-client", kind: "desktop-client" },
      { id: "server-connect", kind: "server-connect" },
      { id: "local-worker", kind: "local-worker", workerNumber: 1 },
      { id: "remote-worker-2", kind: "remote-worker", workerNumber: 2 },
      { id: "remote-worker-3", kind: "remote-worker", workerNumber: 3 },
      { id: "remote-worker-4", kind: "remote-worker", workerNumber: 4 },
      { id: "remote-worker-5", kind: "remote-worker", workerNumber: 5 },
    ]);
    expect(checklist.every((item) => !("installed" in item) && !("authorized" in item))).toBe(true);
    expect(Object.isFrozen(checklist)).toBe(true);
  });

  it("distinguishes host and advanced Server work", () => {
    expect(
      deriveDesktopSetupChecklist({ mode: "host", plannedWorkerCount: 0, localWorker: false }).map(
        ({ kind }) => kind,
      ),
    ).toEqual(["desktop-client", "server-install", "server-connect"]);
    expect(
      deriveDesktopSetupChecklist({
        mode: "advanced",
        plannedWorkerCount: 1,
        localWorker: false,
      }).map(({ kind }) => kind),
    ).toEqual(["desktop-client", "manual-deployment", "server-connect", "remote-worker"]);
  });
});

describe("Desktop setup plan file", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it("atomically persists and reloads only the canonical public plan", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "openbot", "setup-plan.json");
    const store = new FileDesktopSetupPlanStore(path);
    const plan = createDesktopSetupPlan({
      mode: "client-worker",
      plannedWorkerCount: 5,
      localWorker: true,
    });
    expect(await store.load()).toBeUndefined();
    await store.save(plan);
    await expect(store.load()).resolves.toEqual(plan);
    expect(await readFile(path, "utf8")).toBe(`${JSON.stringify(plan)}\n`);
  });

  it("rejects linked and exposed plan files", async () => {
    if (process.platform === "win32") return;
    const directory = await temporaryDirectory();
    const target = join(directory, "target.json");
    const path = join(directory, "setup-plan.json");
    const plan = createDesktopSetupPlan({
      mode: "client",
      plannedWorkerCount: 0,
      localWorker: false,
    });
    await writeFile(target, `${JSON.stringify(plan)}\n`, { mode: 0o600 });
    await symlink(target, path);
    const store = new FileDesktopSetupPlanStore(path);
    await expect(store.load()).rejects.toThrow(/regular file/u);
    await expect(store.save(plan)).rejects.toThrow(/regular file/u);
    await rm(path);
    await chmod(target, 0o644);
    await expect(new FileDesktopSetupPlanStore(target).load()).rejects.toThrow(/permissions/u);
  });

  async function temporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "openbot-desktop-plan-"));
    directories.push(directory);
    return directory;
  }
});
