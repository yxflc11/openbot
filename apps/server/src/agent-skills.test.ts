import { describe, expect, it } from "vitest";
import { parseSkillDocument } from "./agent-skills.js";

const document =
  "---\nname: evidence-report\ndescription: Prepare a source-backed report\nlicense: MIT\nmetadata:\n  author: Owner\nallowed-tools: read_public_page write_report\n---\nRead the supplied sources and identify uncertainty.\n";
describe("single-file Agent Skills adapter", () => {
  it("preserves the complete file, normalizes CRLF and binds the digest to exact content", () => {
    const parsed = parseSkillDocument(document);
    expect(parsed.name).toBe("evidence-report");
    expect(parsed.markdown).toBe(document);
    expect(parseSkillDocument(document.replaceAll("\n", "\r\n"))).toEqual(parsed);
    expect(parseSkillDocument(`${document}Changed.`).sha256).not.toBe(parsed.sha256);
  });
  it.each([
    "name: &anchor evidence-report\ndescription: *anchor",
    "name: evidence-report\nname: duplicate\ndescription: Test",
    "name: !!str evidence-report\ndescription: Test",
    "name: evidence-report\ndescription: Test\nunknown: value",
    "name: evidence-report\ndescription: Test\nmetadata:\n  number: 12",
    "name: Bad--Name\ndescription: Test",
    "%YAML 1.2\nname: evidence-report\ndescription: Test",
    "name: evidence-report\ndescription: [not, text]",
    "name: evidence-report\ndescription: Test\nallowed-tools: [Bash]",
  ])("rejects ambiguous or unsupported frontmatter: %s", (header) => {
    expect(() => parseSkillDocument(`---\n${header}\n---\nBody`)).toThrow(/Invalid SKILL/);
  });
  it.each(["\r", "\u2028", "\u2029", "\u0001", "\0"])(
    "rejects parser control characters %j before parsing",
    (character) => {
      expect(() => parseSkillDocument(document.replace("name:", `${character}name:`))).toThrow();
    },
  );
  it("rejects empty bodies, oversized headers, UTF-8 overflow and JSON expansion", () => {
    for (const source of [
      "---\nname: test\ndescription: Test\n---\n ",
      document.replace("Prepare", "x".repeat(4096)),
      `${document}${"界".repeat(4096)}`,
      `${document}${'"'.repeat(8000)}`,
    ])
      expect(() => parseSkillDocument(source)).toThrow();
  });
});
