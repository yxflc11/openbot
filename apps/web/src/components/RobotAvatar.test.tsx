import type { Bot } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RobotAvatar, robotVisualState } from "./RobotAvatar";

const bot: Bot = {
  id: "bot-1",
  name: "Ops",
  role: "运营",
  status: "idle",
  computerProfile: "docker-linux",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("RobotAvatar", () => {
  it("renders a coarse rect-only pixel robot with an accessible state", () => {
    const html = renderToStaticMarkup(<RobotAvatar bot={bot} status="waiting_approval" />);

    expect(html).toContain('viewBox="0 0 16 16"');
    expect(html).toContain('class="robot-avatar green robot-state-approval"');
    expect(html).toContain('aria-label="Ops，待批准"');
    expect(html).toContain("<rect");
    expect(html).not.toMatch(/<(?:path|circle|linearGradient|image)\b/);
  });

  it("normalizes run and bot statuses into a small visual vocabulary", () => {
    expect(robotVisualState("assigned")).toBe("queued");
    expect(robotVisualState("running")).toBe("running");
    expect(robotVisualState("human_takeover")).toBe("takeover");
    expect(robotVisualState("cancelled")).toBe("failed");
  });
});
