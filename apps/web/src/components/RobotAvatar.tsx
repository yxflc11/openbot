import type { Bot, BotStatus, RunStatus } from "@openbot/domain";

type RobotStatus = BotStatus | RunStatus;

export function RobotAvatar({
  bot,
  compact = false,
  status = bot.status,
}: {
  bot: Bot;
  compact?: boolean;
  status?: RobotStatus;
}) {
  const identity = robotIdentity(bot);
  const visualState = robotVisualState(status);

  return (
    <span
      className={[
        "robot-avatar",
        compact ? "compact" : undefined,
        identity.tone,
        `robot-state-${visualState}`,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={`${bot.name}，${robotStatusLabel(status)}`}
    >
      <svg
        className="pixel-robot"
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        <g className="pixel-robot-outline">
          <rect x="2" y="1" width="12" height="8" />
          <rect x="1" y="3" width="1" height="4" />
          <rect x="14" y="3" width="1" height="4" />
          <rect x="7" y="9" width="2" height="1" />
          <rect x="4" y="10" width="8" height="4" />
          <rect x="2" y="10" width="2" height="3" />
          <rect x="12" y="10" width="2" height="3" />
          <rect x="4" y="14" width="3" height="2" />
          <rect x="9" y="14" width="3" height="2" />
        </g>
        <g className="pixel-robot-shell">
          <rect x="3" y="2" width="10" height="6" />
          <rect x="5" y="10" width="6" height="3" />
        </g>
        <rect className="pixel-robot-screen" x="4" y="3" width="8" height="4" />
        <g className="pixel-robot-accent">
          <RobotFace state={visualState} />
          <rect className="pixel-robot-chest" x="7" y="10" width="2" height="2" />
        </g>
      </svg>
    </span>
  );
}

function RobotFace({ state }: { state: RobotVisualState }) {
  if (state === "failed" || state === "blocked") {
    return (
      <>
        <rect x="5" y="4" width="2" height="1" />
        <rect x="9" y="4" width="2" height="1" />
        <rect x="7" y="6" width="2" height="1" />
      </>
    );
  }

  if (state === "completed") {
    return (
      <>
        <rect x="5" y="4" width="1" height="1" />
        <rect x="10" y="4" width="1" height="1" />
        <rect x="6" y="6" width="4" height="1" />
      </>
    );
  }

  return (
    <>
      <rect x="5" y="4" width="1" height="2" />
      <rect x="10" y="4" width="1" height="2" />
      <rect className="pixel-robot-scan" x="6" y="6" width="4" height="1" />
    </>
  );
}

type RobotVisualState =
  | "idle"
  | "queued"
  | "running"
  | "approval"
  | "blocked"
  | "takeover"
  | "offline"
  | "completed"
  | "failed";

export function robotVisualState(status: RobotStatus): RobotVisualState {
  const states: Record<RobotStatus, RobotVisualState> = {
    idle: "idle",
    queued: "queued",
    assigned: "queued",
    running: "running",
    waiting_approval: "approval",
    blocked: "blocked",
    human_takeover: "takeover",
    offline: "offline",
    completed: "completed",
    failed: "failed",
    cancelled: "failed",
  };
  return states[status];
}

function robotStatusLabel(status: RobotStatus): string {
  const labels: Record<RobotStatus, string> = {
    idle: "待命",
    queued: "已接单",
    assigned: "已分配",
    running: "执行中",
    waiting_approval: "待批准",
    blocked: "已阻塞",
    human_takeover: "人工接管中",
    offline: "离线",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status];
}

function robotIdentity(bot: Bot) {
  const text = `${bot.name} ${bot.role}`.toLowerCase();
  if (text.includes("ops") || text.includes("运营")) return { tone: "green" };
  if (text.includes("coder") || text.includes("开发") || text.includes("code")) {
    return { tone: "orange" };
  }
  return { tone: "blue" };
}
