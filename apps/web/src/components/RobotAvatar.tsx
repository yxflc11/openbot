import type {
  Bot,
  BotAccessory,
  BotAppearance,
  BotBodyShape,
  BotHeadShape,
  BotMobility,
  BotStatus,
  RunStatus,
} from "@openbot/domain";

type RobotStatus = BotStatus | RunStatus;

export const defaultBotAppearance: BotAppearance = {
  head: "round",
  body: "classic",
  mobility: "feet",
  accessory: "none",
  accent: "green",
};

export function RobotAvatar({
  bot,
  compact = false,
  status = bot.status,
}: {
  bot: Bot;
  compact?: boolean;
  status?: RobotStatus;
}) {
  const appearance = bot.appearance ?? appearanceForBot(bot);
  const visualState = robotVisualState(status);

  return (
    <span
      className={[
        "robot-avatar",
        compact ? "compact" : undefined,
        `robot-accent-${appearance.accent}`,
        `robot-state-${visualState}`,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={`${bot.name}，${robotStatusLabel(status)}`}
      data-head={appearance.head}
      data-body={appearance.body}
      data-mobility={appearance.mobility}
      data-accessory={appearance.accessory}
    >
      <svg className="modular-robot" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <MobilityLayer mobility={appearance.mobility} body={appearance.body} />
        <BodyLayer body={appearance.body} />
        <AccessoryBackLayer accessory={appearance.accessory} />
        <HeadLayer head={appearance.head} />
        <FaceLayer state={visualState} />
        <AccessoryFrontLayer accessory={appearance.accessory} />
      </svg>
    </span>
  );
}

function HeadLayer({ head }: { head: BotHeadShape }) {
  return (
    <g className="robot-head">
      <line className="robot-antenna" x1="32" y1="15" x2="32" y2="8" />
      <circle className="robot-shell" cx="32" cy="6" r="3.2" />
      {head === "cat" ? (
        <path className="robot-shell" d="M19 29V15l6-6 4 5h8l4-5 5 6v14z" />
      ) : head === "square" ? (
        <rect className="robot-shell" x="18" y="14" width="28" height="18" rx="3" />
      ) : (
        <path className="robot-shell" d="M18 29v-3c0-9 5-14 14-14s14 5 14 14v3z" />
      )}
      <rect className="robot-accent-band" x="16" y="27" width="32" height="5" rx="1" />
    </g>
  );
}

function FaceLayer({ state }: { state: RobotVisualState }) {
  const failed = state === "failed" || state === "blocked";
  return (
    <g className="robot-face">
      <rect x="24" y={failed ? 20 : 19} width={failed ? 5 : 4} height={failed ? 3 : 7} rx="2" />
      <rect
        x={failed ? 35 : 36}
        y={failed ? 20 : 19}
        width={failed ? 5 : 4}
        height={failed ? 3 : 7}
        rx="2"
      />
    </g>
  );
}

function BodyLayer({ body }: { body: BotBodyShape }) {
  if (body === "quadruped") return <path className="robot-shell" d="M14 34h37v14H14z" />;
  if (body === "tall") return <path className="robot-shell" d="M20 31h24l3 27H17z" />;
  if (body === "cape") {
    return <path className="robot-shell" d="M19 31h26l8 25c-7 3-14 1-21 1s-14 2-21-1z" />;
  }
  if (body === "armor") {
    return (
      <g className="robot-shell">
        <path d="M18 33h28l3 23H15z" />
        <rect x="11" y="35" width="8" height="16" rx="3" />
        <rect x="45" y="35" width="8" height="16" rx="3" />
      </g>
    );
  }
  if (body === "storage") {
    return (
      <g>
        <path className="robot-shell" d="M20 31h24l6 25H14z" />
        <rect className="robot-pocket" x="22" y="42" width="20" height="13" rx="4" />
      </g>
    );
  }
  return <path className="robot-shell" d="M20 31h24l6 25H14z" />;
}

function MobilityLayer({ mobility, body }: { mobility: BotMobility; body: BotBodyShape }) {
  if (body === "quadruped" || mobility === "four-legs") {
    return (
      <g className="robot-shell">
        <rect x="16" y="46" width="5" height="13" rx="2" />
        <rect x="26" y="46" width="5" height="13" rx="2" />
        <rect x="38" y="46" width="5" height="13" rx="2" />
        <rect x="48" y="46" width="5" height="13" rx="2" />
        <path className="robot-stroke" d="M51 36l7-5 2 7" />
      </g>
    );
  }
  if (mobility === "single-wheel") return <circle className="robot-wheel" cx="32" cy="56" r="7" />;
  if (mobility === "dual-wheel") {
    return (
      <g className="robot-wheel">
        <circle cx="23" cy="56" r="6" />
        <circle cx="41" cy="56" r="6" />
      </g>
    );
  }
  if (mobility === "hover") {
    return (
      <g>
        <path className="robot-hover-base" d="M17 53h30l-4 5H21z" />
        <circle className="robot-accent-fill robot-signal" cx="23" cy="61" r="1.8" />
        <circle className="robot-accent-fill robot-signal" cx="32" cy="61" r="1.8" />
        <circle className="robot-accent-fill robot-signal" cx="41" cy="61" r="1.8" />
      </g>
    );
  }
  return (
    <g className="robot-shell">
      <rect x="20" y="52" width="10" height="8" rx="3" />
      <rect x="34" y="52" width="10" height="8" rx="3" />
    </g>
  );
}

function AccessoryBackLayer({ accessory }: { accessory: BotAccessory }) {
  if (accessory === "backpack") {
    return (
      <rect
        className="robot-shell robot-accessory-outline"
        x="43"
        y="34"
        width="12"
        height="18"
        rx="3"
      />
    );
  }
  if (accessory === "headphones") {
    return (
      <g>
        <path className="robot-stroke robot-accent-stroke" d="M17 25c0-12 30-12 30 0" />
        <circle className="robot-accent-fill" cx="17" cy="25" r="4" />
        <circle className="robot-accent-fill" cx="47" cy="25" r="4" />
      </g>
    );
  }
  return null;
}

function AccessoryFrontLayer({ accessory }: { accessory: BotAccessory }) {
  if (accessory === "trench") {
    return (
      <g className="robot-detail">
        <path d="M32 34v19" />
        <circle className="robot-accent-fill" cx="41" cy="38" r="2" />
      </g>
    );
  }
  if (accessory === "arm") {
    return (
      <g>
        <path className="robot-stroke" d="M45 39h9v8h5" />
        <path className="robot-stroke" d="M59 43l4-3m-4 3 4 3" />
      </g>
    );
  }
  if (accessory === "toolbox") {
    return (
      <g>
        <rect className="robot-toolbox" x="17" y="43" width="30" height="14" rx="3" />
        <path className="robot-detail robot-accent-stroke" d="M27 43v-4h10v4m-5 4v7m-4-4h8" />
      </g>
    );
  }
  return null;
}

function appearanceForBot(bot: Bot): BotAppearance {
  const seed = Array.from(`${bot.id}:${bot.name}`).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
  const heads: BotHeadShape[] = ["round", "square", "cat"];
  const bodies: BotBodyShape[] = ["classic", "tall", "cape", "armor", "storage"];
  const mobility: BotMobility[] = ["feet", "single-wheel", "dual-wheel", "hover"];
  const accessories: BotAccessory[] = [
    "none",
    "headphones",
    "backpack",
    "trench",
    "arm",
    "toolbox",
  ];
  const accents: BotAppearance["accent"][] = ["green", "yellow", "red", "blue"];
  return {
    head: heads[seed % heads.length] ?? defaultBotAppearance.head,
    body: bodies[(seed >>> 3) % bodies.length] ?? defaultBotAppearance.body,
    mobility: mobility[(seed >>> 6) % mobility.length] ?? defaultBotAppearance.mobility,
    accessory: accessories[(seed >>> 9) % accessories.length] ?? defaultBotAppearance.accessory,
    accent: accents[(seed >>> 12) % accents.length] ?? defaultBotAppearance.accent,
  };
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
