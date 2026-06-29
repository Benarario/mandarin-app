import { describe, it, expect } from "vitest";
import { visualComponents, confusable, selectNonInterfering, confusionPairs } from "./interference";

const ch = (ref: string, comps: string[]) => ({
  id: `char:${ref}`,
  ref,
  type: "character" as const,
  prereq_ids: comps.map((c) => `comp:${c}`),
});

describe("visualComponents", () => {
  it("extracts comp: prereqs only", () => {
    expect(visualComponents({ prereq_ids: ["comp:青", "phon:q", "comp:讠"] })).toEqual(["青", "讠"]);
  });
});

describe("confusable", () => {
  it("flags shared-phonetic look-alikes (请/清 share 青)", () => {
    expect(confusable(["讠", "青"], ["氵", "青"])).toBe(true); // overlap 1/2 = 0.5
  });
  it("flags near-identical forms (是/时 share 日)", () => {
    expect(confusable(["日"], ["日", "寸"])).toBe(true); // 1/1 = 1.0
  });
  it("does not flag disjoint characters", () => {
    expect(confusable(["女", "子"], ["戈"])).toBe(false);
  });
  it("does not flag a single shared component in large sets (low overlap)", () => {
    expect(confusable(["亻", "尔"], ["亻", "也"], 0.75)).toBe(false); // 1/2 = 0.5 < 0.75
  });
  it("treats empty component sets as not confusable", () => {
    expect(confusable([], ["日"])).toBe(false);
  });
});

describe("selectNonInterfering", () => {
  it("defers a candidate confusable with one already chosen", () => {
    const cands = [ch("请", ["讠", "青"]), ch("清", ["氵", "青"]), ch("我", ["戈"])];
    const { chosen, deferred } = selectNonInterfering(cands, 10);
    expect(chosen.map((c) => c.ref)).toEqual(["请", "我"]);
    expect(deferred.map((c) => c.ref)).toEqual(["清"]);
  });

  it("respects the limit and defers the overflow", () => {
    const cands = [ch("a", ["x"]), ch("b", ["y"]), ch("c", ["z"])];
    const { chosen, deferred } = selectNonInterfering(cands, 2);
    expect(chosen.map((c) => c.ref)).toEqual(["a", "b"]);
    expect(deferred.map((c) => c.ref)).toEqual(["c"]);
  });

  it("never drops non-character concepts (no components to clash on)", () => {
    const phon = (ref: string) => ({ id: `phon:${ref}`, ref, type: "phoneme", prereq_ids: [] });
    const { chosen } = selectNonInterfering([phon("t1"), phon("t2"), phon("t3")], 10);
    expect(chosen).toHaveLength(3);
  });
});

describe("confusionPairs", () => {
  it("returns every confusable pair in a set", () => {
    const items = [ch("请", ["讠", "青"]), ch("清", ["氵", "青"]), ch("晴", ["日", "青"]), ch("我", ["戈"])];
    const pairs = confusionPairs(items).map(([a, b]) => [a.ref, b.ref]);
    expect(pairs).toEqual([
      ["请", "清"],
      ["请", "晴"],
      ["清", "晴"],
    ]);
  });
});
