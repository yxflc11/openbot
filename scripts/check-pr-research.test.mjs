import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validatePullRequestResearch } from "./check-pr-research.mjs";

const validSection = `
## Open-source research

- Research artifact: docs/research/example.md
- Selected upstream/standard: example/project
- Version or commit: v1.2.3
- License: Apache-2.0
- Decision: thin adapter
- OpenBot-specific gap: Server-owned approval binding
- Source copied or substantially adapted: no

## Verification
`;

test("accepts completed research evidence", () => {
  assert.deepEqual(validatePullRequestResearch(validSection), []);
});

test("rejects a missing research section", () => {
  assert.deepEqual(validatePullRequestResearch("## Verification\n\n- Tests: pass"), [
    "missing the 'Open-source research' section",
  ]);
});

test("rejects missing and placeholder fields", () => {
  const failures = validatePullRequestResearch(`
## Open-source research

- Research artifact: TODO
- Selected upstream/standard: example/project
- Version or commit: v1.2.3
- License: MIT
- Decision: adapter
- Source copied or substantially adapted: no
`);

  assert.deepEqual(failures, [
    "'Research artifact' still contains a placeholder",
    "missing '- OpenBot-specific gap:'",
  ]);
});

test("rejects the unchanged repository pull request template", () => {
  const template = readFileSync(".github/pull_request_template.md", "utf8");
  assert.equal(validatePullRequestResearch(template).length, 7);
});
