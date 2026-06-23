import { describe, it, expect } from "vitest";
import { parseSyllable } from "./syllable";

describe("parseSyllable", () => {
  it("parses simple initial + final", () => {
    expect(parseSyllable("hao3")).toEqual({ initial: "h", final: "ao" });
    expect(parseSyllable("ma1")).toEqual({ initial: "m", final: "a" });
    expect(parseSyllable("bang1")).toEqual({ initial: "b", final: "ang" });
  });

  it("matches two-letter initials before single ones", () => {
    expect(parseSyllable("zhong1")).toEqual({ initial: "zh", final: "ong" });
    expect(parseSyllable("shang4")).toEqual({ initial: "sh", final: "ang" });
    expect(parseSyllable("chuan2")).toEqual({ initial: "ch", final: "uan" });
    expect(parseSyllable("zang1")).toEqual({ initial: "z", final: "ang" });
  });

  it("resolves the contracted finals iu / ui / un after an initial", () => {
    expect(parseSyllable("liu2")).toEqual({ initial: "l", final: "iu" });
    expect(parseSyllable("dui4")).toEqual({ initial: "d", final: "ui" });
    expect(parseSyllable("lun2")).toEqual({ initial: "l", final: "un" });
  });

  it("treats written u after j/q/x as ü", () => {
    expect(parseSyllable("ju4")).toEqual({ initial: "j", final: "ü" });
    expect(parseSyllable("que4")).toEqual({ initial: "q", final: "üe" });
    expect(parseSyllable("juan3")).toEqual({ initial: "j", final: "üan" });
    expect(parseSyllable("jun1")).toEqual({ initial: "j", final: "ün" });
  });

  it("normalises ü written as u: or v (after l/n)", () => {
    expect(parseSyllable("nu:3")).toEqual({ initial: "n", final: "ü" });
    expect(parseSyllable("lv4")).toEqual({ initial: "l", final: "ü" });
    expect(parseSyllable("lu:e4")).toEqual({ initial: "l", final: "üe" });
    // genuine u (not ü) stays u
    expect(parseSyllable("lu4")).toEqual({ initial: "l", final: "u" });
  });

  it("decodes y-/w-glide standalone syllables to their canonical final", () => {
    expect(parseSyllable("yi1")).toEqual({ initial: null, final: "i" });
    expect(parseSyllable("ya1")).toEqual({ initial: null, final: "ia" });
    expect(parseSyllable("you3")).toEqual({ initial: null, final: "iu" });
    expect(parseSyllable("yong4")).toEqual({ initial: null, final: "iong" });
    expect(parseSyllable("wo3")).toEqual({ initial: null, final: "uo" });
    expect(parseSyllable("wang2")).toEqual({ initial: null, final: "uang" });
    expect(parseSyllable("wei4")).toEqual({ initial: null, final: "ui" });
    expect(parseSyllable("yuan2")).toEqual({ initial: null, final: "üan" });
    expect(parseSyllable("yue4")).toEqual({ initial: null, final: "üe" });
  });

  it("parses bare-vowel syllables", () => {
    expect(parseSyllable("a1")).toEqual({ initial: null, final: "a" });
    expect(parseSyllable("er2")).toEqual({ initial: null, final: "er" });
    expect(parseSyllable("ai4")).toEqual({ initial: null, final: "ai" });
  });

  it("returns null for non-syllables and erhua particles", () => {
    expect(parseSyllable("r5")).toBeNull();
    expect(parseSyllable("ng")).toBeNull();
    expect(parseSyllable("xyz")).toBeNull();
    expect(parseSyllable("")).toBeNull();
  });
});
