import { describe, expect, it } from "vitest";
import {
  addRecipient,
  removeRecipient,
  selectEveryone,
  selectedRecipientIds,
} from "./recipient-utils";

describe("channel recipient selection", () => {
  it("reads legacy single recipients and respects an explicit empty channel selection", () => {
    expect(selectedRecipientIds({ targetBotId: "a" })).toEqual(["a"]);
    expect(selectedRecipientIds({ targetBotId: "a", targetBotIds: [] })).toEqual([]);
  });
  it("adds exact channel IDs once and removes without mutating the previous selection", () => {
    const initial = { targetBotId: "a" };
    const pair = addRecipient(initial, "b", ["a", "b"]);
    expect(pair).toEqual({ targetBotId: "a", targetBotIds: ["a", "b"] });
    expect(addRecipient(pair, "b", ["a", "b"])).toEqual(pair);
    expect(removeRecipient(pair, "a")).toEqual({ targetBotId: "b", targetBotIds: ["b"] });
    expect(removeRecipient(removeRecipient(pair, "a"), "b")).toEqual({
      targetBotId: "",
      targetBotIds: [],
    });
    expect(initial).toEqual({ targetBotId: "a" });
    expect(pair.targetBotIds).toEqual(["a", "b"]);
  });
  it("rejects a non-member and stale selection without silently changing its scope", () => {
    expect(() => addRecipient({ targetBotId: "a" }, "c", ["a", "b"])).toThrow("当前频道");
    expect(() => addRecipient({ targetBotId: "removed" }, "b", ["a", "b"])).toThrow("当前频道");
  });
  it("selects all exact members and rejects a seventh or duplicate instead of truncating", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    expect(selectEveryone(ids).targetBotIds).toEqual(ids);
    expect(() => selectEveryone([...ids, "g"])).toThrow("6");
    expect(() => addRecipient(selectEveryone(ids), "g", [...ids, "g"])).toThrow("6");
    expect(() => selectEveryone(["a", "a"])).toThrow("重复");
    expect(() => selectEveryone([""])).toThrow("不能为空");
  });
});
