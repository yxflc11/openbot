import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseRichMessage, RichMessage } from "./RichMessage";

describe("RichMessage", () => {
  it("parses paragraphs, lists and markdown tables without HTML injection", () => {
    const content = [
      "**结论：** 已完成分析。",
      "",
      "| 标的 | 判断 |",
      "| --- | --- |",
      "| OpenBot | 继续 |",
      "",
      "- 已保存结果",
      "- 等待下一步",
    ].join("\n");

    expect(parseRichMessage(content).map((block) => block.type)).toEqual([
      "paragraph",
      "table",
      "list",
    ]);
    const html = renderToStaticMarkup(
      <RichMessage content={`${content}\n<script>alert(1)</script>`} />,
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>结论：</strong>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
