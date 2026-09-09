export interface ComposerAttachment {
  name: string;
  text: string;
}
export interface ComposerSkill {
  id: string;
  name: string;
  version: string;
}

export function composeTaskText(
  text: string,
  attachments: ComposerAttachment[] = [],
  skills: ComposerSkill[] = [],
): string {
  const parts = [text.trim()];
  if (skills.length)
    parts.push(
      `Requested reviewed skills (use only if still assigned and verified):\n${skills.map((skill) => `${skill.name} · v${skill.version} (${skill.id})`).join("\n")}`,
    );
  for (const file of attachments)
    parts.push(`User-provided attachment: ${file.name}\n${file.text}`);
  return parts.filter(Boolean).join("\n\n");
}

export async function readComposerAttachment(file: File): Promise<ComposerAttachment> {
  if (!/\.(txt|md|csv|json)$/i.test(file.name) || file.size > 6000)
    throw new Error("请选择不超过 6 KB 的 TXT、Markdown、CSV 或 JSON 文件。");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  if (text.includes("\0")) throw new Error("附件必须是 UTF-8 文本文件。");
  return {
    name: Array.from(file.name, (character) => (character.charCodeAt(0) < 32 ? " " : character))
      .join("")
      .slice(0, 160),
    text,
  };
}
