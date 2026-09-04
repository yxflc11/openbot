import { type FormEvent, useMemo, useState } from "react";
import {
  createDesktopSetupPlanInput,
  deriveDesktopSetupChecklist,
  type DesktopSetupChecklistRow,
  desktopSetupModes,
  MAXIMUM_PLANNED_WORKER_COMPUTERS,
} from "../desktop-setup";
import type {
  DesktopSetupMode,
  DesktopSetupPlanInput,
  DesktopSetupPlanState,
  SaveDesktopSetupPlanResult,
} from "../desktop-runtime";

export function DesktopSetupScreen({
  state,
  onSave,
}: {
  state: DesktopSetupPlanState;
  onSave(plan: DesktopSetupPlanInput): Promise<SaveDesktopSetupPlanResult>;
}) {
  const initial = state.status === "configured" ? state.plan : undefined;
  const [mode, setMode] = useState<DesktopSetupMode | undefined>(initial?.mode);
  const [plannedWorkerCount, setPlannedWorkerCount] = useState(initial?.plannedWorkerCount ?? 0);
  const [localWorker, setLocalWorker] = useState(initial?.localWorker ?? false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const plan = useMemo(() => {
    if (mode === undefined) return undefined;
    try {
      return createDesktopSetupPlanInput({ localWorker, mode, plannedWorkerCount });
    } catch {
      return undefined;
    }
  }, [localWorker, mode, plannedWorkerCount]);

  function selectMode(nextMode: DesktopSetupMode) {
    setMode(nextMode);
    setError(undefined);
    if (nextMode === "client") {
      setLocalWorker(false);
      setPlannedWorkerCount(0);
    } else if (nextMode === "client-worker") {
      setLocalWorker(true);
      setPlannedWorkerCount((count) => Math.max(1, count));
    } else {
      setLocalWorker(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (plan === undefined || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await onSave(plan);
      if (result.status === "failed") {
        setError(
          result.code === "invalid_plan"
            ? "安装计划无效，请重新选择。"
            : "无法安全保存安装计划，请检查应用数据目录后重试。",
        );
        setSubmitting(false);
      }
    } catch {
      setError("Desktop 暂时无法保存安装计划，请重试。");
      setSubmitting(false);
    }
  }

  const checklist = plan === undefined ? [] : deriveDesktopSetupChecklist(plan);
  return (
    <main className="login-screen desktop-setup-screen">
      <section className="login-card desktop-setup-card" aria-labelledby="desktop-setup-title">
        <div className="connection-mark" aria-hidden="true">
          O
        </div>
        <p className="login-eyebrow">OPENBOT DESKTOP</p>
        <h1 id="desktop-setup-title">选择安装方式</h1>
        <p className="login-copy">
          所有选项都是同一个 OpenBot；区别只是这台电脑是否还承担 Server 或工作任务。
        </p>
        {state.status === "invalid" ? (
          <p className="connection-warning" role="alert">
            已保存的安装计划无效，没有服务被启动；请重新选择。
          </p>
        ) : null}
        <form className="desktop-setup-form" onSubmit={handleSubmit}>
          <fieldset>
            <legend>这台电脑要怎么使用？</legend>
            <div className="setup-mode-grid">
              {desktopSetupModes.map((option) => (
                <label
                  className={`setup-mode ${mode === option.mode ? "selected" : ""}`}
                  key={option.mode}
                >
                  <input
                    id={`desktop-mode-${option.mode}`}
                    type="radio"
                    name="desktop-mode"
                    value={option.mode}
                    checked={mode === option.mode}
                    onChange={() => selectMode(option.mode)}
                  />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode !== undefined && mode !== "client" ? (
            <div className="setup-worker-fields">
              <label htmlFor="planned-worker-count">计划配置多少台工作电脑？</label>
              <input
                id="planned-worker-count"
                type="number"
                inputMode="numeric"
                min={mode === "client-worker" ? 1 : 0}
                max={MAXIMUM_PLANNED_WORKER_COMPUTERS}
                step={1}
                value={plannedWorkerCount}
                onChange={(event) => setPlannedWorkerCount(Number(event.target.value))}
              />
              <p className="connection-hint">
                这是进度清单，不是授权或许可限制；每台工作电脑仍可直接使用 Desktop。
              </p>
              {mode === "host" ? (
                <label className="setup-local-worker">
                  <input
                    type="checkbox"
                    checked={localWorker}
                    onChange={(event) => {
                      setLocalWorker(event.target.checked);
                      if (event.target.checked)
                        setPlannedWorkerCount((count) => Math.max(1, count));
                    }}
                  />
                  <span>这台托管电脑也参与工作，并计入上面的数量</span>
                </label>
              ) : null}
            </div>
          ) : null}

          {checklist.length > 0 ? <DesktopSetupChecklist rows={checklist} /> : null}
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={plan === undefined || submitting}
          >
            {submitting ? "正在保存…" : "保存计划并继续"}
          </button>
        </form>
        <p className="login-note">保存计划不会安装服务、连接设备或授予电脑权限。</p>
      </section>
    </main>
  );
}

export function DesktopSetupChecklist({ rows }: { rows: readonly DesktopSetupChecklistRow[] }) {
  return (
    <section className="setup-checklist" aria-labelledby="setup-checklist-title">
      <h2 id="setup-checklist-title">你的配置清单</h2>
      <ol>
        {rows.map((row) => (
          <li key={row.id}>
            <span className="setup-step-state">{row.state}</span>
            <span>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
