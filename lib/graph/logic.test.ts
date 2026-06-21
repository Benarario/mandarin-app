import { describe, it, expect } from "vitest";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict";
import {
  isConceptUnlocked,
  pickNextConcepts,
  findUntaughtTokens,
  type ConceptNode,
} from "./logic";

describe("prerequisite gating", () => {
  it("unlocks only when ALL prerequisites are mastered", () => {
    const mastered = new Set(["comp:女", "comp:子"]);
    expect(isConceptUnlocked(["comp:女", "comp:子"], mastered)).toBe(true); // 好
    expect(isConceptUnlocked(["comp:女", "comp:子", "comp:口"], mastered)).toBe(false);
    expect(isConceptUnlocked([], mastered)).toBe(true); // atoms have no prereqs
  });

  it("picks the earliest unlocked, not-yet-introduced concepts in order", () => {
    const concepts: ConceptNode[] = [
      { id: "comp:女", type: "component", ref: "女", tier: 1, prereq_ids: [], teaching_order: 1 },
      { id: "comp:子", type: "component", ref: "子", tier: 1, prereq_ids: [], teaching_order: 2 },
      { id: "char:好", type: "character", ref: "好", tier: 2, prereq_ids: ["comp:女", "comp:子"], teaching_order: 3 },
      { id: "char:妈", type: "character", ref: "妈", tier: 2, prereq_ids: ["comp:女", "comp:马"], teaching_order: 4 },
    ];
    const mastered = new Set(["comp:女", "comp:子"]);
    const introduced = new Set(["comp:女"]);
    const next = pickNextConcepts(concepts, mastered, introduced, 10);
    // 女 already introduced → skipped; 好 unlocked; 妈 locked (马 not mastered).
    expect(next.map((c) => c.id)).toEqual(["comp:子", "char:好"]);
  });
});

describe("THE invariant: never surface an untaught token", () => {
  const j = Jieba.withDict(dict);
  const tokensOf = (text: string) =>
    j.cut(text, false).filter((t) => /\p{Script=Han}/u.test(t));

  it("rejects a sentence containing an untaught word", () => {
    const taught = new Set(["我", "喜欢", "学习"]); // but NOT 中文
    const tokens = tokensOf("我喜欢学习中文"); // ["我","喜欢","学习","中文"]
    const offending = findUntaughtTokens(tokens, taught);
    expect(offending).toContain("中文");
    expect(offending.length).toBeGreaterThan(0);
  });

  it("accepts a sentence only when every token is taught", () => {
    const taught = new Set(["我", "喜欢", "学习", "中文"]);
    const tokens = tokensOf("我喜欢学习中文");
    expect(findUntaughtTokens(tokens, taught)).toEqual([]);
  });

  it("reader (i+1) mode: a word is allowed when all its characters are taught", () => {
    const taught = new Set(["中", "文"]); // characters known, compound 中文 not yet a word
    const tokens = tokensOf("中文");
    expect(findUntaughtTokens(tokens, taught, {})).toEqual(["中文"]); // strict: flagged
    expect(findUntaughtTokens(tokens, taught, { allowCharsOfWord: true })).toEqual([]); // lenient: ok
  });

  it("flags a word even in lenient mode if one of its characters is untaught", () => {
    const taught = new Set(["中"]); // 文 NOT taught
    const tokens = tokensOf("中文");
    expect(findUntaughtTokens(tokens, taught, { allowCharsOfWord: true })).toEqual(["中文"]);
  });
});
