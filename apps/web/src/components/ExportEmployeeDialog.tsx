import type { Bot, EmployeeExportExclusion, EmployeeExportPreview } from "@openbot/domain";
import { useEffect, useState } from "react";
import {
  type ApiError,
  downloadEmployeeTemplate,
  getEmployeeExportPreview,
} from "../api";
import { CloseIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

export function ExportEmployeeDialog({
  employee,
  onClose,
  onDownloaded,
}: {
  employee: Bot;
  onClose(): void;
  onDownloaded(fileName: string): void;
}) {
  const [preview, setPreview] = useState<EmployeeExportPreview>();
  const [error, setError] = useState<string>();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    void getEmployeeExportPreview(employee.id, controller.signal)
      .then(setPreview)
      .catch((cause: ApiError | DOMException) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause.message ?? "无法生成导出预览。");
      });
    return () => controller.abort();
  }, [employee.id]);

  async function download() {
    if (preview === undefined || preview.blocked) return;
    setDownloading(true);
    setError(undefined);
    try {
      await downloadEmployeeTemplate(employee.id, preview.fileName);
      onDownloaded(preview.fileName);
    } catch (cause) {
      setError((cause as ApiError).message ?? "下载员工模板失败。");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <dialog className="create-dialog export-employee-dialog" open aria-labelledby="export-title">
        <header className="dialog-header">
          <div>
            <h2 id="export-title">导出员工模板</h2>
            <p>先确认会带走什么，也确认绝不会带走什么。</p>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <section className="export-employee-identity">
          <RobotAvatar bot={employee} status={employee.status} />
          <div>
            <strong>{employee.name}</strong>
            <span>{employee.role}</span>
          </div>
        </section>

        {preview === undefined && error === undefined ? (
          <section className="export-preview-loading" aria-live="polite">
            <span className="loading-mark">O</span>
            <p>正在生成脱敏预览…</p>
          </section>
        ) : null}

        {preview ? <ExportPreviewDetails preview={preview} /> : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="export-dialog-footer">
          <div>
            <strong>导入后会创建新员工</strong>
            <span>模板不携带任何工作主机权限。</span>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={preview === undefined || preview.blocked || downloading}
            onClick={() => void download()}
          >
            {downloading ? "下载中…" : preview?.blocked ? "导出已阻止" : "下载模板"}
          </button>
        </footer>
      </dialog>
    </div>
  );
}

function ExportPreviewDetails({ preview }: { preview: EmployeeExportPreview }) {
  return (
    <div className="export-preview-body">
      <section className={`export-safety-summary ${preview.blocked ? "blocked" : "safe"}`}>
        <strong>{preview.blocked ? "发现需要处理的敏感内容" : "默认脱敏检查已通过"}</strong>
        <span>
          {preview.blocked
            ? "OpenBot 已阻止下载，请先修正下列字段。"
            : "可下载内容只包含角色、外观、执行偏好与已验证技能。"}
        </span>
      </section>

      <div className="export-preview-columns">
        <section>
          <h3>将包含</h3>
          <dl className="export-included-list">
            <div>
              <dt>员工模板</dt>
              <dd>职责与外观</dd>
            </div>
            <div>
              <dt>已验证技能</dt>
              <dd>{preview.verifiedSkillCount}</dd>
            </div>
            <div>
              <dt>记忆</dt>
              <dd>{preview.includedMemoryCount}</dd>
            </div>
            <div>
              <dt>请求能力</dt>
              <dd>
                {preview.requestedCapabilities.length > 0
                  ? preview.requestedCapabilities.join("、")
                  : "无"}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3>明确排除</h3>
          <ul className="export-exclusion-list">
            {preview.exclusions.map((exclusion) => (
              <li key={exclusion.category}>
                <strong>{exclusionLabel(exclusion)}</strong>
                <span>{exclusionReason(exclusion.category)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {preview.findings.length > 0 ? (
        <section className="export-findings">
          <h3>阻止原因</h3>
          <ul>
            {preview.findings.map((finding) => (
              <li key={`${finding.code}:${finding.location}`}>
                <code>{finding.location}</code>
                <span>{finding.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="export-integrity">
        <div>
          <span>完整性</span>
          <strong>SHA-256 校验</strong>
        </div>
        <code title={preview.checksum}>{preview.checksum}</code>
        <p>当前 v1 模板尚未签名；导入端必须隔离检查，并保持技能禁用直到本地审核完成。</p>
      </section>
    </div>
  );
}

function exclusionLabel(exclusion: EmployeeExportExclusion): string {
  const labels: Record<EmployeeExportExclusion["category"], string> = {
    identity: "来源身份",
    authority: "电脑权限与授权",
    memory: "全部记忆",
    "work-history": "工作与审计历史",
  };
  return `${labels[exclusion.category]} · ${exclusion.count}`;
}

function exclusionReason(category: EmployeeExportExclusion["category"]): string {
  const reasons: Record<EmployeeExportExclusion["category"], string> = {
    identity: "来源员工 ID 与所有权不会进入模板。",
    authority: "不包含主机绑定、审批、凭证、会话或能力授权。",
    memory: "v1 默认模板不导出任何记忆。",
    "work-history": "Run、决策、产物、审批和进化历史留在来源 Server。",
  };
  return reasons[category];
}
