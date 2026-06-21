import { describe, it, expect } from "vitest";
import { decidePinyin, STATUS_MASTERED } from "./fading";

describe("pinyin fades only once a character is mastered (status ≥ 4)", () => {
  it("adaptive: shows pinyin while unfamiliar, hides once familiar", () => {
    expect(decidePinyin("adaptive", 0).show).toBe(true); // never seen
    expect(decidePinyin("adaptive", 2).show).toBe(true); // learning
    expect(decidePinyin("adaptive", 3).show).toBe(true); // still not familiar
    expect(decidePinyin("adaptive", STATUS_MASTERED).show).toBe(false); // familiar → fade
    expect(decidePinyin("adaptive", 5).show).toBe(false); // strong
  });

  it("re-shows pinyin if mastery drops back below 4 (the safety valve)", () => {
    expect(decidePinyin("adaptive", 4).show).toBe(false);
    expect(decidePinyin("adaptive", 3).show).toBe(true); // lapsed → pinyin returns
  });

  it("always keeps pinyin revealable on tap (never truly impossible)", () => {
    for (const s of [0, 2, 4, 5]) expect(decidePinyin("adaptive", s).tappable).toBe(true);
  });

  it("explicit modes override mastery", () => {
    expect(decidePinyin("full", 5).show).toBe(true);
    expect(decidePinyin("none", 0).show).toBe(false);
    expect(decidePinyin("on_tap", 0).show).toBe(false);
  });
});
