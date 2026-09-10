import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(site, "../..");
const content = resolve(site, "src/content/docs");
function pages(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pages(resolve(directory, entry.name), `${prefix}${entry.name}/`)
      : entry.name.endsWith(".md")
        ? [`${prefix}${entry.name}`]
        : [],
  );
}
test("every public manual has an English source and Chinese translation", () => {
  const all = pages(content);
  const english = all.filter((name) => !name.startsWith("zh-cn/"));
  assert.ok(english.length >= 14);
  assert.deepEqual(
    all
      .filter((name) => name.startsWith("zh-cn/"))
      .map((name) => name.slice(6))
      .sort(),
    english.sort(),
  );
  for (const name of all) {
    const body = readFileSync(resolve(content, name), "utf8");
    assert.match(body, /^---\ntitle: "[^"\n]+"/);
    assert.ok(Buffer.byteLength(body) > 500, `${name} must contain a usable guide`);
    assert.doesNotMatch(body, /\b(?:TODO|lorem ipsum|coming soon)\b/i);
    for (const [, path] of body.matchAll(
      /https:\/\/github\.com\/yxflc11\/openbot\/blob\/main\/([^\s)]+)/g,
    )) {
      assert.ok(existsSync(resolve(root, path)), `Broken canonical source: ${path}`);
    }
  }
});
test("catalog pins the reviewed source, not executable endpoint authority", () => {
  const catalog = JSON.parse(readFileSync(resolve(root, "plugins/catalog.json"), "utf8"));
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(new Set(catalog.plugins.map((entry) => entry.id)).size, catalog.plugins.length);
  for (const entry of catalog.plugins) {
    assert.match(entry.source.ref, /^(?:desktop-)?v\d+\.\d+\.\d+/);
    assert.equal(
      createHash("sha256")
        .update(readFileSync(resolve(root, entry.source.path)))
        .digest("hex"),
      entry.source.sha256,
    );
    assert.equal(entry.transport, "streamable-http");
    assert.ok(!("token" in entry) && !("endpoint" in entry));
  }
});
