import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const astro = resolve(dirname(require.resolve("astro/package.json")), "bin/astro.mjs");
function run(args, cwd = site) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const action = process.argv[2];
if (action === "build") {
  const vite = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  run([vite, "build", "--config", "vite.demo.config.ts"], resolve(site, "../web"));
}
run([astro, ...process.argv.slice(2)]);
if (action === "build") {
  const demo = resolve(site, "../web/dist-demo");
  if (!existsSync(resolve(demo, "index.html")))
    throw new Error("The real-component product demo is missing.");
  mkdirSync(resolve(site, "dist/demo"), { recursive: true });
  cpSync(demo, resolve(site, "dist/demo"), { recursive: true });
  run([resolve(site, "scripts/check-build.mjs")]);
}
