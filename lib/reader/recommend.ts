// Comprehensible-input (i+1) passage selection. Given each passage's known-word
// coverage (computed from the gate's mastered vocabulary), pick the ones in the
// comprehensible band — high enough to follow, low enough to still learn from —
// ranked by closeness to the ideal. Pure logic, no data/fabrication: it only
// orders already-sourced passages by the learner's own coverage.

export interface Scored<T> {
  t: T;
  coverage: number; // 0–100, % of words the learner already knows (status ≥ 4)
}

export interface BandOptions {
  low?: number; // lower edge of the comprehensible band
  high?: number; // upper edge (above this is too easy to learn from)
  ideal?: number; // sweet spot to rank toward
  max?: number; // cap how many to surface
}

/**
 * The "For you" recommendations: passages with coverage in [low, high], ordered
 * by closeness to `ideal` (ties: higher coverage first). If none fall in the
 * band yet (e.g. a near-beginner whose coverage is still low everywhere), fall
 * back to the easiest few as an on-ramp.
 */
export function recommendForYou<T>(
  scored: Scored<T>[],
  { low = 60, high = 90, ideal = 78, max = 6 }: BandOptions = {},
): Scored<T>[] {
  const band = scored.filter((s) => s.coverage >= low && s.coverage <= high);
  const pool = band.length
    ? band
    : [...scored].sort((a, b) => b.coverage - a.coverage).slice(0, Math.min(3, scored.length));
  return [...pool]
    .sort((a, b) => Math.abs(a.coverage - ideal) - Math.abs(b.coverage - ideal) || b.coverage - a.coverage)
    .slice(0, max);
}
