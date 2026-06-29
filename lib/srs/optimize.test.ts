import { describe, it, expect } from "vitest";
import { summarizeReviews, shouldOptimize, isValidWeights, optimizeWeights } from "./optimize";

const r = (rating: number, state_before = "review") => ({ rating, state_before });

describe("summarizeReviews", () => {
  it("measures retention as the pass-rate on mature (review-state) reviews", () => {
    const s = summarizeReviews([r(3), r(4), r(1), r(3, "learning"), r(1, "new")]);
    expect(s.reviewed).toBe(5);
    expect(s.mature).toBe(3); // three with state_before === "review"
    expect(s.retention).toBeCloseTo(2 / 3); // good,easy pass; again fails
    expect(s.ratingCounts).toEqual({ 1: 2, 2: 0, 3: 2, 4: 1 });
  });

  it("returns null retention when there are no mature reviews", () => {
    expect(summarizeReviews([r(3, "learning"), r(1, "new")]).retention).toBeNull();
  });
});

describe("shouldOptimize", () => {
  it("gates on the review count", () => {
    expect(shouldOptimize(999, 1000)).toBe(false);
    expect(shouldOptimize(1000, 1000)).toBe(true);
  });
});

describe("isValidWeights", () => {
  it("accepts 17/19/21-length numeric vectors", () => {
    expect(isValidWeights(Array(21).fill(0.5))).toBe(true);
    expect(isValidWeights(Array(19).fill(0.5))).toBe(true);
  });
  it("rejects wrong shapes / non-finite values", () => {
    expect(isValidWeights(Array(5).fill(1))).toBe(false);
    expect(isValidWeights("nope")).toBe(false);
    expect(isValidWeights([...Array(20).fill(1), NaN])).toBe(false);
  });
});

describe("optimizeWeights (seam)", () => {
  it("returns null until a real optimizer is wired (never invents weights)", () => {
    expect(optimizeWeights([r(3), r(4), r(1)])).toBeNull();
  });
});
