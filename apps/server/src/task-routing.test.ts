import { describe, expect, it } from "vitest";
import { selectChannelAssignee } from "./task-routing.js";

const ops = { id: "ops", name: "Ops", role: "浏览器操作" };
const chief = { id: "chief", name: "Chief", role: "任务协调" };
const coder = { id: "coder", name: "Coder", role: "代码开发" };

describe("channel task routing", () => {
  it("honors an explicit member assignment", () => {
    expect(selectChannelAssignee([ops, chief], ops.id)).toEqual(ops);
    expect(selectChannelAssignee([ops, chief], "outside-channel")).toBeUndefined();
  });

  it("prefers Chief and otherwise keeps roster order", () => {
    expect(selectChannelAssignee([ops, chief, coder])).toEqual(chief);
    expect(selectChannelAssignee([ops, coder])).toEqual(ops);
    expect(selectChannelAssignee([])).toBeUndefined();
  });
});
