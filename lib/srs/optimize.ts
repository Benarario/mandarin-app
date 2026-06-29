// FSRS personalization — pure, testable pieces used by the batch optimizer
// (scripts/fsrs/optimize.ts). ts-fsrs ships no parameter optimizer, so the
// actual weight-fitting is an isolated seam (`optimizeWeights`) that a real
// optimizer (fsrs-rs / py-fsrs, or a future ts-fsrs optimizer) plugs into.
// We never invent weights — an unfittable history yields null (keep defaults).

// FSRS-6 uses 21 weights. Accept the known historical lengths too (17/19) so a
// migrated parameter set still validates.
const VALID_WEIGHT_LENGTHS = new Set([17, 19, 21]);

// FSRS recommends ~1000+ reviews for a stable fit; configurable for testing.
export const MIN_REVIEWS_FOR_OPTIMIZE = 1000;

export interface RevlogRow {
  rating: number; // 1=again 2=hard 3=good 4=easy
  state_before: string; // new | learning | review | relearning
}

export interface ReviewSummary {
  reviewed: number; // total reviews logged
  mature: number; // reviews of cards already in the "review" state
  retention: number | null; // measured pass-rate on mature reviews (rating ≥ good)
  ratingCounts: Record<number, number>;
}

/** Aggregate a user's revlog into diagnostics (no scheduling decisions here). */
export function summarizeReviews(rows: RevlogRow[]): ReviewSummary {
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let mature = 0;
  let maturePass = 0;
  for (const r of rows) {
    ratingCounts[r.rating] = (ratingCounts[r.rating] ?? 0) + 1;
    if (r.state_before === "review") {
      mature++;
      if (r.rating >= 3) maturePass++;
    }
  }
  return {
    reviewed: rows.length,
    mature,
    retention: mature > 0 ? maturePass / mature : null,
    ratingCounts,
  };
}

/** Is there enough history to attempt a parameter fit? */
export function shouldOptimize(reviewed: number, min = MIN_REVIEWS_FOR_OPTIMIZE): boolean {
  return reviewed >= min;
}

/** A weight vector is usable only if it's the right shape. */
export function isValidWeights(w: unknown): w is number[] {
  return Array.isArray(w) && VALID_WEIGHT_LENGTHS.has(w.length) && w.every((n) => typeof n === "number" && Number.isFinite(n));
}

/**
 * THE SEAM: fit FSRS weights from review history. ts-fsrs has no optimizer, so
 * this returns null today (→ keep the safe defaults; never store invented
 * weights). Drop a real optimizer in here — convert `rows` to its training
 * format and return the fitted, validated weight vector.
 */
export function optimizeWeights(_rows: RevlogRow[]): number[] | null {
  return null;
}
