import type { Bot } from "@openbot/domain";

export function RobotAvatar({ bot, compact = false }: { bot: Bot; compact?: boolean }) {
  const identity = robotIdentity(bot);
  return (
    <span className={`robot-avatar ${compact ? "compact" : ""} ${identity.tone}`}>
      <img src={identity.src} alt="" />
    </span>
  );
}

function robotIdentity(bot: Bot) {
  const text = `${bot.name} ${bot.role}`.toLowerCase();
  if (text.includes("ops") || text.includes("运营")) {
    return { src: "/robots/pixel-bot.svg", tone: "green" };
  }
  if (text.includes("coder") || text.includes("开发") || text.includes("code")) {
    return { src: "/robots/pixel-bot.svg", tone: "orange" };
  }
  return { src: "/robots/pixel-bot.svg", tone: "blue" };
}
