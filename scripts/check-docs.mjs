import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".turbo", "build", "coverage", "dist", "node_modules"]);
const markdownFiles = collectMarkdownFiles(repositoryRoot);
const failures = [];

for (const file of markdownFiles) {
  const source = readFileSync(file, "utf8");
  validateLocalLinks(file, source);
}

for (const name of ["README.md", "README.zh-CN.md"]) {
  const file = resolve(repositoryRoot, name);
  const source = readFileSync(file, "utf8");
  if (/```mermaid\b/u.test(source)) {
    failures.push(
      `${name}: root READMEs must link to architecture docs instead of embedding Mermaid.`,
    );
  }
  const imageCount = Array.from(source.matchAll(/!\[[^\]]*\]\([^)]+\)/gu)).length;
  if (imageCount > 5) {
    failures.push(`${name}: contains ${imageCount} images; keep the root README lightweight.`);
  }
}

if (failures.length > 0) {
  console.error(
    ["Documentation checks failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.info(`Documentation checks passed for ${markdownFiles.length} Markdown files.`);
}

function collectMarkdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectMarkdownFiles(resolve(directory, entry.name)));
      }
      continue;
    }
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(resolve(directory, entry.name));
    }
  }
  return files;
}

function validateLocalLinks(file, source) {
  for (const match of source.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu)) {
    const rawTarget = match[1];
    if (rawTarget === undefined || isExternalTarget(rawTarget)) continue;
    const pathPart = rawTarget.replace(/^<|>$/gu, "").split("#", 1)[0]?.split("?", 1)[0];
    if (!pathPart) continue;
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathPart);
    } catch {
      failures.push(`${relativePath(file)}: link has invalid percent encoding: ${rawTarget}`);
      continue;
    }
    const target = resolve(dirname(file), decodedPath);
    if (!existsSync(target)) {
      failures.push(`${relativePath(file)}: local link does not exist: ${rawTarget}`);
    }
  }
}

function isExternalTarget(target) {
  return /^(?:https?:|mailto:|tel:|#)/u.test(target);
}

function relativePath(file) {
  return file.slice(repositoryRoot.length + 1);
}
