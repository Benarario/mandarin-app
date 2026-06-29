import { describe, it, expect } from "vitest";
import { isHeading, splitSentences, splitChapters } from "./chunk";

describe("isHeading", () => {
  it("recognizes Chinese and English chapter headings", () => {
    expect(isHeading("第一章 开始")).toBe(true);
    expect(isHeading("第 12 回")).toBe(true);
    expect(isHeading("楔子")).toBe(true);
    expect(isHeading("Chapter 3")).toBe(true);
  });
  it("rejects ordinary prose and over-long lines", () => {
    expect(isHeading("他说第一章很有意思，于是继续读下去并且想了很多事情啊啊啊啊啊")).toBe(false);
    expect(isHeading("我喜欢学习中文。")).toBe(false);
    expect(isHeading("")).toBe(false);
  });
});

describe("splitSentences", () => {
  it("splits on Chinese terminal punctuation, keeping it", () => {
    expect(splitSentences("你好。我叫小明！你呢？")).toEqual(["你好。", "我叫小明！", "你呢？"]);
  });
  it("keeps trailing closing quotes with the sentence", () => {
    expect(splitSentences("他说：“走吧。”然后离开了。")).toEqual(["他说：“走吧。”", "然后离开了。"]);
  });
  it("treats newlines as breaks and drops blanks", () => {
    expect(splitSentences("第一句\n\n第二句")).toEqual(["第一句", "第二句"]);
  });
});

describe("splitChapters", () => {
  it("splits a multi-chapter text and titles each chapter", () => {
    const raw = "第一章 相遇\n你好。我们见面了。\n第二章 离别\n再见了。";
    const ch = splitChapters(raw);
    expect(ch.map((c) => c.title)).toEqual(["第一章 相遇", "第二章 离别"]);
    expect(ch[0].lines).toEqual(["你好。", "我们见面了。"]);
    expect(ch[1].lines).toEqual(["再见了。"]);
  });

  it("makes a single chapter (titled from first sentence) when there are no headings", () => {
    const ch = splitChapters("今天天气很好。我去公园了。");
    expect(ch).toHaveLength(1);
    expect(ch[0].title).toBe("今天天气很好。");
    expect(ch[0].lines).toEqual(["今天天气很好。", "我去公园了。"]);
  });

  it("drops headings that have no body", () => {
    expect(splitChapters("第一章\n第二章\n有内容。")).toEqual([
      { title: "第二章", lines: ["有内容。"] },
    ]);
  });

  it("returns [] for empty input", () => {
    expect(splitChapters("   \n  ")).toEqual([]);
  });
});
