import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const requiredFields = [
  "Research artifact",
  "Selected upstream/standard",
  "Version or commit",
  "License",
  "Decision",
  "OpenBot-specific gap",
  "Source copied or substantially adapted",
];

const placeholderPattern = /^(?:-|n\/?a|none|not sure|tbd|todo|<.*>|\.\.\.|no\s*\/\s*yes.*)$/iu;

export function validatePullRequestResearch(body) {
  const section = extractSection(body.replace(/<!--[\s\S]*?-->/gu, ""), "Open-source research");
  if (section === undefined) return ["missing the 'Open-source research' section"];

  const failures = [];
  for (const label of requiredFields) {
    const value = extractListField(section, label);
    if (value === undefined) {
      failures.push(`missing '- ${label}:'`);
      continue;
    }
    if (placeholderPattern.test(value)) failures.push(`'${label}' still contains a placeholder`);
  }
  return failures;
}

function extractSection(body, heading) {
  const escaped = escapeRegExp(heading);
  const match = body.match(
    new RegExp(`(?:^|\\n)## ${escaped}[^\\S\\r\\n]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`, "iu"),
  );
  return match?.[1]?.trim();
}

function extractListField(section, label) {
  const escaped = escapeRegExp(label);
  const match = section.match(new RegExp(`^- ${escaped}:[ \\t]*(.*?)[ \\t]*$`, "imu"));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function run() {
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") {
    console.info("Pull-request research check skipped outside a pull_request event.");
    return;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required for pull_request validation.");
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const body = event.pull_request?.body;
  if (typeof body !== "string") throw new Error("Pull request body is missing.");

  const failures = validatePullRequestResearch(body);
  if (failures.length > 0) {
    console.error(
      [
        "Pull-request research check failed:",
        ...failures.map((failure) => `- ${failure}`),
        "Complete the repository pull request template and link a durable research record.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  console.info("Pull-request research evidence is present.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
