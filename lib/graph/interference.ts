// Interference-aware scheduling helpers. Pure + framework-free (unit-testable),
// like logic.ts. The gating authority still decides WHAT is unlocked; these only
// reorder/defer among already-unlocked candidates, so the gating invariant is
// never weakened — a deferred concept simply waits for a later session.

/** Visual components of a concept = its component prerequisites (comp:<char>). */
export function visualComponents(node: { prereq_ids: string[] }): string[] {
  return node.prereq_ids.filter((p) => p.startsWith("comp:")).map((p) => p.slice("comp:".length));
}

/**
 * Two characters are visually confusable when their component sets overlap
 * heavily — they share a component that makes up at least `threshold` of the
 * smaller set (overlap coefficient). This catches shared-phonetic look-alikes
 * (请/清/晴 share 青) and near-identical forms (是/时 share 日), without flagging
 * pairs that merely share nothing. Only meaningful for characters.
 */
export function confusable(a: string[], b: string[], threshold = 0.5): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const sb = new Set(b);
  let inter = 0;
  for (const x of new Set(a)) if (sb.has(x)) inter++;
  if (inter === 0) return false;
  return inter / Math.min(new Set(a).size, sb.size) >= threshold;
}

export interface Selection<T> {
  chosen: T[];
  deferred: T[];
}

/**
 * Greedily pick up to `limit` concepts (keeping input order) such that no two
 * chosen concepts are visually confusable; everything else is deferred. Input
 * MUST already be the gated/unlocked frontier — this only spreads confusable
 * items across sessions; it never introduces something ungated.
 */
export function selectNonInterfering<T extends { type: string; prereq_ids: string[] }>(
  candidates: T[],
  limit: number,
): Selection<T> {
  const chosen: T[] = [];
  const deferred: T[] = [];
  const chosenComps: string[][] = [];
  for (const c of candidates) {
    if (chosen.length >= limit) {
      deferred.push(c);
      continue;
    }
    const comps = c.type === "character" ? visualComponents(c) : [];
    const clashes = comps.length > 0 && chosenComps.some((pc) => confusable(comps, pc));
    if (clashes) {
      deferred.push(c);
      continue;
    }
    chosen.push(c);
    chosenComps.push(comps);
  }
  return { chosen, deferred };
}

/** All visually-confusable character pairs in a set (for contrast drills). */
export function confusionPairs<T extends { prereq_ids: string[] }>(items: T[]): [T, T][] {
  const comps = items.map(visualComponents);
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (confusable(comps[i], comps[j])) pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}
