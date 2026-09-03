import type {
  Bot,
  EmployeeImportActivationResult,
  EmployeeImportIssue,
  EmployeeImportPreview,
} from "@openbot/domain";
import { useEffect, useRef, useState } from "react";
import { activateEmployeeImport, type ApiError, previewEmployeeImport } from "../api";
import { CloseIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";
import { useModalDialog } from "./useModalDialog";

const employeePackageAccept =
  ".json,application/json,application/vnd.openbot.employee+json,application/vnd.openbot.employee.dsse+json";

export function ImportEmployeeDialog({
  onClose,
  onActivated,
}: {
  onClose(): void;
  onActivated(result: EmployeeImportActivationResult): void;
}) {
  const [preview, setPreview] = useState<EmployeeImportPreview>();
  const [file, setFile] = useState<File>();
  const [fileName, setFileName] = useState<string>();
  const [employeeName, setEmployeeName] = useState("");
  const [ownerReviewed, setOwnerReviewed] = useState(false);
  const [allowUnsigned, setAllowUnsigned] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const requestController = useRef<AbortController | undefined>(undefined);
  const { dialogRef, closeDialog } = useModalDialog(onClose);

  useEffect(() => () => requestController.current?.abort(), []);

  async function inspect(selectedFile: File) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setFileName(selectedFile.name);
    setFile(selectedFile);
    setPreview(undefined);
    setOwnerReviewed(false);
    setAllowUnsigned(false);
    setError(undefined);
    setLoading(true);
    idempotencyKey.current = crypto.randomUUID();
    try {
      const result = await previewEmployeeImport(selectedFile, controller.signal);
      setPreview(result);
      setEmployeeName(result.employee.name);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(importErrorMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function activate() {
    if (
      file === undefined ||
      preview === undefined ||
      preview.blocked ||
      !ownerReviewed ||
      (preview.signature.status === "unsigned" && !allowUnsigned)
    ) {
      return;
    }
    setActivating(true);
    setError(undefined);
    try {
      const result = await activateEmployeeImport(file, preview, {
        employeeName,
        allowUnsigned,
        idempotencyKey: idempotencyKey.current,
      });
      onActivated(result);
    } catch (cause) {
      setError(importErrorMessage(cause));
    } finally {
      setActivating(false);
    }
  }

  const activationReady =
    preview !== undefined &&
    !preview.blocked &&
    preview.quarantine.canActivate &&
    ownerReviewed &&
    employeeName.trim().length > 0 &&
    (preview.signature.status === "dsse" || allowUnsigned);

  return (
    <div className="dialog-backdrop">
      <dialog
        ref={dialogRef}
        className="create-dialog import-employee-dialog"
        aria-labelledby="import-title"
      >
        <header className="dialog-header">
          <div>
            <h2 id="import-title">检查并激活员工</h2>
            <p>先在隔离区检查，再由你确认创建一个没有电脑权限的新员工。</p>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={closeDialog}>
            <CloseIcon />
          </button>
        </header>

        {preview ? (
          <ImportPreviewDetails
            preview={preview}
            fileName={fileName ?? "员工模板"}
            employeeName={employeeName}
            ownerReviewed={ownerReviewed}
            allowUnsigned={allowUnsigned}
            onEmployeeNameChange={setEmployeeName}
            onOwnerReviewedChange={setOwnerReviewed}
            onAllowUnsignedChange={setAllowUnsigned}
          />
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
            <strong>新身份，零权限</strong>
            <span>技能先禁用；不导入记忆、记录、主机绑定或凭证。</span>
          </div>
          {preview || error ? (
            <label className="secondary-button import-file-button">
              选择其他文件
              <input
                type="file"
                accept={employeePackageAccept}
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];
                  if (selectedFile) void inspect(selectedFile);
                }}
              />
            </label>
          ) : null}
          <button className="secondary-button" type="button" onClick={closeDialog}>
            取消
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!activationReady || activating}
            onClick={() => void activate()}
          >
            {activating ? "正在激活…" : preview?.blocked ? "激活已阻止" : "激活员工"}
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
          ? `正在验证 ${fileName ?? "文件"} 的结构、签名、校验和与兼容性…`
          : "支持不超过 2 MiB 的 openbot.employee/v1 或 DSSE JSON。未知字段会直接拒绝。"}
      </p>
      {!loading ? (
        <label className="primary-button import-file-button">
          选择文件
          <input
            type="file"
            accept={employeePackageAccept}
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              if (selectedFile) void onInspect(selectedFile);
            }}
          />
        </label>
      ) : (
        <span className="loading-mark">O</span>
      )}
    </section>
  );
}

export function ImportPreviewDetails({
  preview,
  fileName,
  employeeName,
  ownerReviewed,
  allowUnsigned,
  onEmployeeNameChange,
  onOwnerReviewedChange,
  onAllowUnsignedChange,
}: {
  preview: EmployeeImportPreview;
  fileName: string;
  employeeName: string;
  ownerReviewed: boolean;
  allowUnsigned: boolean;
  onEmployeeNameChange(value: string): void;
  onOwnerReviewedChange(value: boolean): void;
  onAllowUnsignedChange(value: boolean): void;
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
          {preview.blocked ? "需要处理" : "隔离检查通过"}
        </strong>
      </section>

      <section className="import-profile-summary" aria-labelledby="import-profile-summary-title">
        <h3 id="import-profile-summary-title">员工资料</h3>
        <dl>
          <div>
            <dt>职责</dt>
            <dd>{preview.employee.role}</dd>
          </div>
          <div>
            <dt>简介</dt>
            <dd>{preview.employee.description || "模板未提供简介。"}</dd>
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
        <p>这些内容只用于说明员工，不会授予技能、电脑或账号权限。</p>
      </section>

      <section className="import-quarantine-grid">
        <ImportBoundary label="完整性" value={preview.integrity.valid ? "校验通过" : "校验失败"} />
        <ImportBoundary
          label="签名"
          value={
            preview.signature.status === "dsse"
              ? `已信任 · ${preview.signature.keyid}`
              : "未签名 / 不受信任"
          }
        />
        <ImportBoundary label="导入身份" value="生成新 ID" />
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
              {preview.compatibility.hostRequired
                ? "没有满足全部要求的在线主机。"
                : "无需工作主机。"}
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
          <strong>可以由 Owner 激活</strong>
          <span>激活只创建新身份和候选技能，不授予任何电脑或账号权限。</span>
        </section>
      )}

      {!preview.blocked ? (
        <section className="import-activation-review" aria-labelledby="activation-review-title">
          <div>
            <h3 id="activation-review-title">人工确认</h3>
            <p>
              摘要 {preview.integrity.digest.slice(0, 12)}… 将写入收据；文件改变后必须重新检查。
            </p>
          </div>
          <label className="import-name-field">
            <span>新员工名称</span>
            <input
              value={employeeName}
              maxLength={64}
              onChange={(event) => onEmployeeNameChange(event.target.value)}
            />
          </label>
          <label className="import-review-check">
            <input
              type="checkbox"
              checked={ownerReviewed}
              onChange={(event) => onOwnerReviewedChange(event.target.checked)}
            />
            <span>我已核对员工资料、技能、兼容主机和零权限边界。</span>
          </label>
          {preview.signature.status === "unsigned" ? (
            <label className="import-review-check import-unsigned-check">
              <input
                type="checkbox"
                checked={allowUnsigned}
                onChange={(event) => onAllowUnsignedChange(event.target.checked)}
              />
              <span>我理解发布者身份无法验证，仍要激活这个未签名模板。</span>
            </label>
          ) : null}
        </section>
      ) : null}
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
    "Employee package must not exceed 2 MiB.": "员工模板不能超过 2 MiB。",
    "Employee package must be valid JSON.": "员工模板必须是有效的 JSON 文件。",
    "Employee package does not match a supported format.":
      "模板格式不受支持，或文件包含未声明字段。",
    "Employee activation is blocked until every preview issue is resolved.":
      "模板仍有阻止项，不能激活。",
    "Unsigned Employee activation requires explicit Owner risk acceptance.":
      "请先确认你愿意承担未签名模板的来源风险。",
    "The Employee package changed after preview. Review the current package before activating it.":
      "文件在预览后发生了变化，请重新检查。",
    "This Employee package was already activated.": "这个员工包已经激活过。",
  };
  return translations[error.message] ?? error.message ?? "无法检查或激活员工模板。";
}
