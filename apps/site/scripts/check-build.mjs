import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const html = [];
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.name.endsWith(".html")) html.push(path);
  }
}
collect(dist);
const failures = [];
for (const file of html) {
  const text = readFileSync(file, "utf8");
  for (const [, href] of text.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    if (!href.startsWith("/openbot/") || href.includes("#")) continue;
    const target = resolve(dist, decodeURIComponent(href.slice(9).split("?")[0]));
    if (
      !existsSync(target) ||
      (statSync(target).isDirectory() && !existsSync(resolve(target, "index.html")))
    )
      failures.push(`${file}: ${href}`);
  }
}
if (html.length < 30) failures.push("Bilingual public pages are missing.");
if (failures.length)
  throw new Error(`Website contains broken local routes:\n${failures.join("\n")}`);
console.info(`Website local links and assets passed across ${html.length} pages.`);
