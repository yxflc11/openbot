import type { Bot, EmployeeImportIssue, EmployeeImportPreview } from "@openbot/domain";
import { useEffect, useRef, useState } from "react";
import { type ApiError, previewEmployeeImport } from "../api";
import { CloseIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";
import { useModalDialog } from "./useModalDialog";

export function ImportEmployeeDialog({ onClose }: { onClose(): void }) {
  const [preview, setPreview] = useState<EmployeeImportPreview>();
  const [fileName, setFileName] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const requestController = useRef<AbortController | undefined>(undefined);
  const { dialogRef, closeDialog } = useModalDialog(onClose);

  useEffect(() => () => requestController.current?.abort(), []);

  async function inspect(file: File) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setFileName(file.name);
    setPreview(undefined);
    setError(undefined);
    setLoading(true);
    try {
      setPreview(await previewEmployeeImport(file, controller.signal));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(importErrorMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <dialog
        ref={dialogRef}
        className="create-dialog import-employee-dialog"
        aria-labelledby="import-title"
      >
        <header className="dialog-header">
          <div>
            <h2 id="import-title">检查员工模板</h2>
            <p>文件只在隔离预览中解析；本阶段不会创建或激活员工。</p>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={closeDialog}>
            <CloseIcon />
          </button>
        </header>

        {preview ? (
          <ImportPreviewDetails preview={preview} fileName={fileName ?? "员工模板"} />
        ) : (
          <ImportDropZone fileName={fileName} loading={loading} onInspect={inspect} />
        )}

        {error ? (
          <p className="form-error import-error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="import-dialog-footer">
          <div>
            <strong>只读隔离预览</strong>
            <span>不写入 Bot、技能、记忆、主机绑定或权限。</span>
          </div>
          {preview || error ? (
            <label className="secondary-button import-file-button">
              选择其他文件
              <input
                type="file"
                accept=".json,application/json,application/vnd.openbot.employee+json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void inspect(file);
                }}
              />
            </label>
          ) : null}
          <button className="primary-button" type="button" onClick={closeDialog}>
            完成检查
          </button>
        </footer>
      </dialog>
    </div>
  );
}

function ImportDropZone({
  fileName,
  loading,
  onInspect,
}: {
  fileName: string | undefined;
  loading: boolean;
  onInspect(file: File): Promise<void>;
}) {
  return (
    <section className="import-drop-zone">
      <span className="import-file-mark" aria-hidden="true">
        ↓
      </span>
      <h3>{loading ? "正在检查模板" : "选择员工模板"}</h3>
      <p>
        {loading
          ? `正在验证 ${fileName ?? "文件"} 的 schema、校验和与兼容性…`
          : "支持不超过 1 MiB 的 openbot.employee/v1 JSON。未知字段会直接拒绝。"}
      </p>
      {!loading ? (
        <label className="primary-button import-file-button">
          选择文件
          <input
            type="file"
            accept=".json,application/json,application/vnd.openbot.employee+json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onInspect(file);
            }}
          />
        </label>
      ) : (
        <span className="loading-mark">O</span>
      )}
    </section>
  );
}

function ImportPreviewDetails({
  preview,
  fileName,
}: {
  preview: EmployeeImportPreview;
  fileName: string;
}) {
  const employee: Bot = {
    id: `preview:${preview.packageId}`,
    name: preview.employee.name,
    role: preview.employee.role,
    status: "offline",
    computerProfile: preview.recommendedExecutionProfile,
    ...(preview.employee.appearance ? { appearance: preview.employee.appearance } : {}),
    createdAt: preview.generatedAt,
  };
  return (
    <div className="import-preview-body">
      <section className="import-preview-identity">
        <RobotAvatar bot={employee} status="offline" />
        <div>
          <span>{fileName}</span>
          <h3>{employee.name}</h3>
          <p>{employee.role}</p>
        </div>
        <strong className={preview.blocked ? "blocked" : "ready"}>
          {preview.blocked ? "需要处理" : "结构检查通过"}
        </strong>
      </section>

      <section className="import-quarantine-grid">
        <ImportBoundary label="完整性" value={preview.integrity.valid ? "校验通过" : "校验失败"} />
        <ImportBoundary label="签名" value="未签名 / 不受信任" />
        <ImportBoundary label="导入身份" value="必须生成新 ID" />
        <ImportBoundary label="电脑权限" value="无" />
        <ImportBoundary label="技能初始状态" value="禁用，等待审核" />
        <ImportBoundary label="记忆" value="0" />
      </section>

      <div className="import-preview-columns">
        <section>
          <h3>技能与能力</h3>
          {preview.skills.length > 0 ? (
            <ul className="import-skill-list">
              {preview.skills.map((skill) => (
                <li key={skill.slug}>
                  <div>
                    <strong>{skill.name}</strong>
                    <span>
                      {skill.slug} · {skill.version}
                    </span>
                  </div>
                  <small>
                    {skill.requiredCapabilities.length > 0
                      ? skill.requiredCapabilities.join("、")
                      : "不请求能力"}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="import-empty">模板没有技能。</p>
          )}
        </section>

        <section>
          <h3>当前主机兼容性</h3>
          {preview.compatibility.compatibleHosts.length > 0 ? (
            <ul className="import-host-list">
              {preview.compatibility.compatibleHosts.map((host) => (
                <li key={host.id}>
                  <strong>{host.name}</strong>
                  <span>
                    {host.platform} · {host.architecture} · {host.deviceClass}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="import-empty">
              {preview.compatibility.hostRequired ? "没有满足全部要求的在线主机。" : "无需工作主机。"}
            </p>
          )}
          {preview.compatibility.missingCapabilities.length > 0 ? (
            <p className="import-missing">
              缺少：{preview.compatibility.missingCapabilities.join("、")}
            </p>
          ) : null}
        </section>
      </div>

      {preview.issues.length > 0 ? (
        <section className="import-issues">
          <h3>阻止项</h3>
          <ul>
            {preview.issues.map((issue) => (
              <li key={`${issue.code}:${issue.locations.join(",")}`}>
                <strong>{issueLabel(issue)}</strong>
                <span>{issue.locations.join("、")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="import-review-note">
          <strong>可以进入人工审核，但还不能激活</strong>
          <span>激活命令、签名信任和本地权限授予将在后续阶段独立实现。</span>
        </section>
      )}
    </div>
  );
}

function ImportBoundary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function issueLabel(issue: EmployeeImportIssue): string {
  const labels: Record<EmployeeImportIssue["code"], string> = {
    "checksum-mismatch": "校验和不匹配",
    "capability-set-mismatch": "能力声明与技能不一致",
    "duplicate-skill": "技能标识重复",
    "missing-skill-dependency": "缺少技能依赖",
    "sensitive-content": "包含疑似敏感内容",
    "missing-capability": "当前缺少所需能力",
    "no-compatible-host": "没有兼容工作主机",
  };
  return labels[issue.code];
}

function importErrorMessage(cause: unknown): string {
  const error = cause as ApiError;
  const translations: Record<string, string> = {
    "Employee package must not exceed 1 MiB.": "员工模板不能超过 1 MiB。",
    "Employee package must be valid JSON.": "员工模板必须是有效的 JSON 文件。",
    "Employee package does not match a supported format.":
      "模板格式不受支持，或文件包含未声明字段。",
  };
  return translations[error.message] ?? error.message ?? "无法检查员工模板。";
}
