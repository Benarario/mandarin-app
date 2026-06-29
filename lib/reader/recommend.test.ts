import { describe, it, expect } from "vitest";
import { recommendForYou } from "./recommend";

const score = (id: string, coverage: number) => ({ t: id, coverage });

describe("recommendForYou", () => {
  it("picks passages in the comprehensible band, ranked toward the ideal", () => {
    const scored = [
      score("too-easy", 98),
      score("ideal", 78),
      score("ok-low", 64),
      score("ok-high", 88),
      score("too-hard", 20),
    ];
    const out = recommendForYou(scored, { low: 60, high: 90, ideal: 78 }).map((s) => s.t);
    expect(out).toEqual(["ideal", "ok-high", "ok-low"]); // 78 closest, then |88-78|=10 vs |64-78|=14
    expect(out).not.toContain("too-easy");
    expect(out).not.toContain("too-hard");
  });

  it("falls back to the easiest few when nothing is in band (near-beginner)", () => {
    const scored = [score("a", 5), score("b", 30), score("c", 12), score("d", 0)];
    const out = recommendForYou(scored, { low: 60, high: 90 }).map((s) => s.t);
    expect(out).toEqual(["b", "c", "a"]); // top-3 by coverage as an on-ramp
  });

  it("respects the max cap", () => {
    const scored = Array.from({ length: 10 }, (_, i) => score(`p${i}`, 70 + i));
    expect(recommendForYou(scored, { max: 4 })).toHaveLength(4);
  });

  it("returns nothing for an empty library", () => {
    expect(recommendForYou([])).toEqual([]);
  });
});
