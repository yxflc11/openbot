import { NativeRunControls, nativeRunFailure } from "./NativeRunControls";
import type { Artifact, Bot, ExecutionNode, Run, RunFrame, RunProgress } from "@openbot/domain";
import { useEffect, useRef } from "react";
import { runStatusLabel } from "../run-state";
import { ArtifactCard } from "./ArtifactCard";
import { CloseIcon, NodeIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

export function RunInspector({
  artifacts,
  bot,
  liveFrame,
  node,
  progress,
  run,
  onClose,
  onRun,
}: {
  artifacts: Artifact[];
  bot: Bot | undefined;
  liveFrame: RunFrame | undefined;
  node: ExecutionNode | undefined;
  progress: RunProgress[];
  run: Run;
  onClose(): void;
  onRun(run: Run): void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    closeButton.current?.focus();
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [onClose]);

  const terminal =
    run.status === "completed" || run.status === "failed" || run.status === "cancelled";
  const native = run.executionProfile === "none" && !run.nodeId;

  return (
    <div className="inspector-backdrop">
      <aside className="run-inspector" role="dialog" aria-modal="true" aria-labelledby="run-title">
        <header className="inspector-header">
          <div>
            <span className={`run-status ${run.status}`}>{runStatusLabel(run.status)}</span>
            <h2 id="run-title">{run.title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭任务详情"
            ref={closeButton}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="inspector-body">
          {liveFrame ? (
            <section className="inspector-section live-frame-section">
              <header>
                <h3>执行画面</h3>
                <span className={run.status === "running" ? "live" : "recent"}>
                  <i />
                  {run.status === "running" ? "实时" : "最后画面"}
                </span>
              </header>
              <div className="live-frame">
                <img
                  src={`/api/v1/runs/${run.id}/frame?revision=${liveFrame.revision}`}
                  alt={`${run.title} 的执行画面`}
                />
              </div>
              <p className="frame-meta">
                {frameDimensions(liveFrame)} · {formatTime(liveFrame.capturedAt)} · 临时内存画面
              </p>
            </section>
          ) : null}

          <section className="inspector-section">
            <h3>任务</h3>
            <p className="instruction-copy">{run.instruction}</p>
          </section>

          <section className="inspector-assignment" aria-label="任务分配">
            <div>
              {bot ? (
                <RobotAvatar bot={bot} compact status={run.status} />
              ) : (
                <span className="assignment-placeholder">O</span>
              )}
              <span>
                <small>执行 Bot</small>
                <strong>{bot?.name ?? "未知 Bot"}</strong>
              </span>
            </div>
            <div>
              <span className="assignment-icon">
                <NodeIcon />
              </span>
              <span>
                <small>执行电脑</small>
                <strong>
                  {native
                    ? "由 Server 执行"
                    : (node?.name ?? (run.nodeId ? "节点已离线" : "等待分配"))}
                </strong>
              </span>
            </div>
          </section>

          <NativeRunControls key={run.id} run={run} onRun={onRun} />
          {run.modelUsage ? (
            <section className="inspector-section" aria-label="任务模型用量">
              <h3>模型用量</h3>
              <p>
                {run.modelUsage.provider} · {run.modelUsage.model} · {run.modelUsage.steps} 轮
              </p>
              <p>
                输入 {run.modelUsage.inputTokens?.toLocaleString() ?? "未知"} · 输出{" "}
                {run.modelUsage.outputTokens?.toLocaleString() ?? "未知"} Token
              </p>
              <p className="frame-meta">仅包含已收到用量的模型步骤，不代表账单或任务成本。</p>
            </section>
          ) : null}
          <section className="inspector-section">
            <h3>进度</h3>
            <ol className="progress-timeline">
              <ProgressItem
                label="任务已接收"
                message={
                  native
                    ? "任务已保存，等待 Server 的原生 Agent 执行。"
                    : "任务已写入频道并等待可用节点。"
                }
                time={run.createdAt}
                complete
              />
              {progress.map((item) => (
                <ProgressItem
                  label={stageLabel(item.stage)}
                  message={item.message}
                  time={item.createdAt}
                  complete
                  key={item.id}
                />
              ))}
              {terminal ? (
                <ProgressItem
                  label={
                    run.status === "completed"
                      ? "任务完成"
                      : run.status === "cancelled"
                        ? "任务已取消"
                        : "任务失败"
                  }
                  message={
                    run.status === "cancelled"
                      ? "Owner 已停止此任务。"
                      : run.errorMessage
                        ? nativeRunFailure(run)
                        : (run.resultSummary ?? "任务已结束。")
                  }
                  time={run.updatedAt}
                  complete
                  failed={run.status === "failed"}
                />
              ) : (
                <ProgressItem
                  label={runStatusLabel(run.status)}
                  message={currentStatusMessage(run.status, native)}
                  time={run.updatedAt}
                />
              )}
            </ol>
          </section>

          {artifacts.length > 0 ? (
            <section className="inspector-section">
              <h3>产物</h3>
              <div className="inspector-artifacts">
                {artifacts.map((artifact) => (
                  <ArtifactCard artifact={artifact} key={artifact.id} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ProgressItem({
  complete = false,
  failed = false,
  label,
  message,
  time,
}: {
  complete?: boolean;
  failed?: boolean;
  label: string;
  message: string;
  time: string;
}) {
  return (
    <li className={failed ? "failed" : complete ? "complete" : "current"}>
      <span className="progress-marker" />
      <div>
        <header>
          <strong>{label}</strong>
          <time dateTime={time}>{formatTime(time)}</time>
        </header>
        <p>{message}</p>
      </div>
    </li>
  );
}

function stageLabel(stage: string): string {
  return stageLabels[stage] ?? stage;
}

function currentStatusMessage(status: Run["status"], native = false): string {
  if (native && status === "queued") return "等待 Server 原生 Agent 接单；请确认模型设置已启用。";
  if (native && status === "running") return "Server 正在执行模型与工具循环，进度会自动更新。";
  const messages: Record<Run["status"], string> = {
    queued: "正在等待符合固定执行环境的节点。",
    assigned: "节点已接单，等待 Server 发放启动指令。",
    running: "节点正在执行，新的阶段会自动出现在这里。",
    waiting_approval: "敏感动作正在等待你的批准。",
    blocked: "任务遇到阻塞，需要人工处理。",
    completed: "任务已完成。",
    failed: "任务执行失败。",
    cancelled: "任务已取消。",
  };
  return messages[status];
}

function formatTime(value: string): string {
  return timeFormatter.format(new Date(value));
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
}

function frameDimensions(frame: RunFrame): string {
  return frame.width !== undefined && frame.height !== undefined
    ? `${frame.width} × ${frame.height}`
    : formatBytes(frame.sizeBytes);
}

const stageLabels: Record<string, string> = {
  context: "员工上下文",
  planning: "模型步骤",
  observation: "工具结果",
  navigate: "打开网页",
  screenshot: "截取画面",
};

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
