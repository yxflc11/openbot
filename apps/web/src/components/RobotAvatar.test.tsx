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
  it("renders the composable Bot identity with an accessible state", () => {
    const html = renderToStaticMarkup(<RobotAvatar bot={bot} status="waiting_approval" />);

    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain("robot-state-approval");
    expect(html).toContain('aria-label="Ops，待批准"');
    expect(html).toContain('data-head="');
    expect(html).toContain('data-mobility="');
    expect(html).toContain("<rect");
    expect(html).not.toMatch(/<(?:linearGradient|image)\b/);
  });

  it("uses explicitly selected NFT-like layers", () => {
    const html = renderToStaticMarkup(
      <RobotAvatar
        bot={{
          ...bot,
          appearance: {
            head: "cat",
            body: "cape",
            mobility: "hover",
            accessory: "headphones",
            accent: "red",
          },
        }}
      />,
    );

    expect(html).toContain("robot-accent-red");
    expect(html).toContain('data-head="cat"');
    expect(html).toContain('data-body="cape"');
    expect(html).toContain('data-mobility="hover"');
    expect(html).toContain('data-accessory="headphones"');
  });

  it("normalizes run and bot statuses into a small visual vocabulary", () => {
    expect(robotVisualState("assigned")).toBe("queued");
    expect(robotVisualState("running")).toBe("running");
    expect(robotVisualState("human_takeover")).toBe("takeover");
    expect(robotVisualState("cancelled")).toBe("failed");
  });
});
