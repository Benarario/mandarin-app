import { describe, it, expect } from "vitest";
import { numberedToDiacritic, syllableToDiacritic } from "./convert";

describe("numbered pinyin → diacritics (faithful re-rendering of CC-CEDICT)", () => {
  it("places tone marks on the correct vowel", () => {
    expect(numberedToDiacritic("ni3 hao3")).toBe("nǐ hǎo");
    expect(numberedToDiacritic("Zhong1 guo2")).toBe("Zhōng guó");
    expect(numberedToDiacritic("xie4 xie5")).toBe("xiè xie"); // neutral tone = no mark
    expect(numberedToDiacritic("peng2 you5")).toBe("péng you");
  });

  it("handles the a/e/ou priority rule", () => {
    expect(syllableToDiacritic("hao3")).toBe("hǎo"); // a wins
    expect(syllableToDiacritic("gei3")).toBe("gěi"); // e wins
    expect(syllableToDiacritic("dou1")).toBe("dōu"); // ou -> o
    expect(syllableToDiacritic("hui4")).toBe("huì"); // last vowel
  });

  it("handles ü spellings (u: and v)", () => {
    expect(syllableToDiacritic("lu:4")).toBe("lǜ");
    expect(syllableToDiacritic("lv4")).toBe("lǜ");
    expect(syllableToDiacritic("nu:3")).toBe("nǚ");
  });
});
