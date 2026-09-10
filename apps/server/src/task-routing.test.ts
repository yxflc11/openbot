import { describe, expect, it } from "vitest";
import { selectChannelAssignee, selectChannelAssignees } from "./task-routing.js";

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

describe("atomic recipient routing", () => {
  it("preserves exact recipient order and the default chief", () => {
    expect(selectChannelAssignees([ops, chief, coder], { botIds: [coder.id, ops.id] })).toEqual([
      coder,
      ops,
    ]);
    expect(selectChannelAssignees([ops, chief], {})).toEqual([chief]);
    expect(selectChannelAssignees([ops, chief], {}, ops.id)).toEqual([ops]);
  });
  it.each([
    { botIds: [] },
    { botIds: [ops.id, ops.id] },
    { botIds: [ops.id, "outside"] },
    { botIds: [ops.id], botId: chief.id },
    { botIds: Array.from({ length: 7 }, (_, i) => String(i)) },
  ])("rejects the entire invalid set %j", (input) => {
    expect(() => selectChannelAssignees([ops, chief, coder], input)).toThrow();
  });
  it("does not permit redirecting direct conversations", () => {
    expect(() =>
      selectChannelAssignees([ops, chief], { botIds: [ops.id, chief.id] }, ops.id),
    ).toThrow();
  });
});
