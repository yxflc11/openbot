import type { Run } from "@openbot/domain";
import { useState } from "react";
import { ApiError, cancelNativeRun, createMessage } from "../api";

export function nativeRunFailure(run: Run): string {
  const messages: Record<string, string> = {
    model_credentials: "模型密钥被拒绝，请到设置核对提供方和密钥后重新提交。",
    model_rate_limit: "模型服务限流，请稍后重新提交。",
    model_unavailable: "模型服务暂时不可用，请检查模型配置与服务状态。",
    settings_changed: "执行期间模型设置发生变化，请确认当前配置后重新提交。",
    scope_revoked: "Bot 已失去当前频道访问权限，请检查成员关系。",
    task_limit: "任务超过执行上限，请拆成更小的任务。",
    tool_unavailable: "工具未能完成，请检查任务中的公开网址和所需能力。",
    task_timeout: "任务超时，请缩小任务范围或检查模型连接。",
    server_interrupted: "Server 中断了任务，服务恢复后可重新提交。",
    execution_failed: "任务未能完成，请检查模型配置、频道权限和任务范围。",
  };
  return messages[run.errorCode ?? ""] ?? run.errorMessage ?? "任务已结束。";
}

export function NativeRunControls({ run, onRun }: { run: Run; onRun(run: Run): void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  if (run.executionProfile !== "none" || run.nodeId !== undefined) return null;
  const canStop = run.status === "queued" || run.status === "running";
  const canResubmit = run.status === "failed" || run.status === "cancelled";
  if (!canStop && !canResubmit) return null;
  return (
    <section className="native-run-controls" aria-label="原生任务操作">
      <button
        type="button"
        className="secondary-button"
        disabled={pending}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setError(undefined);
          try {
            const next = canStop
              ? await cancelNativeRun(run.id)
              : (await createMessage(run.channelId, { content: run.instruction, botId: run.botId }))
                  .run;
            onRun(next);
          } catch (cause) {
            setError(
              cause instanceof ApiError && cause.status === 409
                ? "任务状态已变化，请刷新查看最新结果。"
                : "操作未确认，请先查看最新任务状态，避免重复提交。",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "正在处理…" : canStop ? "停止任务" : "重新提交任务"}
      </button>
      <p>
        {canStop
          ? "停止后不会继续发布此任务的回复或报告。"
          : "将从头创建一个新任务，原任务记录会保留。"}
      </p>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
