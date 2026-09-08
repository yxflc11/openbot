import { type FormEvent, useState } from "react";
import { importEmployeeSkill } from "../api";

export function EmployeeSkillImport({
  employeeId,
  onProfileChanged,
}: {
  employeeId: string;
  onProfileChanged(): Promise<void>;
}) {
  const [markdown, setMarkdown] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      await importEmployeeSkill(employeeId, {
        markdown,
        version,
        reason: "Owner imported a single SKILL.md for review.",
      });
      setMarkdown("");
      setSaved(true);
      await onProfileChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法导入技能。");
    } finally {
      setSaving(false);
    }
  }
  return (
    <details className="employee-skill-import">
      <summary>导入 SKILL.md</summary>
      <form className="employee-skill-review-form" onSubmit={(event) => void submit(event)}>
        <p>
          导入后先作为候选技能。展开全文并审核后，Agent
          才能使用。每个版本的正文固定，修改内容请导入新版本。
        </p>
        <label>
          <span>选择文件（最多 12 KiB）</span>
          <input
            type="file"
            accept=".md,text/markdown"
            disabled={saving}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              setError(undefined);
              setSaved(false);
              if (!file) return;
              if (file.name !== "SKILL.md" || file.size > 12 * 1024) {
                setError("请选择不超过 12 KiB 的 SKILL.md。");
                return;
              }
              try {
                setMarkdown(await file.text());
              } catch {
                setError("无法读取所选文件。");
              }
            }}
          />
        </label>
        <label>
          <span>版本</span>
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            required
            maxLength={64}
            disabled={saving}
          />
        </label>
        <label>
          <span>SKILL.md 全文</span>
          <textarea
            rows={12}
            value={markdown}
            onChange={(event) => {
              setMarkdown(event.target.value);
              setSaved(false);
            }}
            required
            maxLength={12 * 1024}
            disabled={saving}
            placeholder={
              "---\nname: evidence-report\ndescription: 整理已提供的来源并撰写报告\n---\n先读取任务中明确提供的来源，再整理事实与结论。"
            }
          />
        </label>
        <p>
          当前支持单文件指令流程，使用任务已有工具；不加载附属文件或运行脚本。员工包导出不包含技能正文。
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? <p role="status">已导入候选技能，请在下方展开全文并审核。</p> : null}
        <button type="submit" className="primary-button" disabled={saving || !markdown.trim()}>
          {saving ? "导入中…" : "导入为候选技能"}
        </button>
      </form>
    </details>
  );
}
