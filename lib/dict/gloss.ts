// Picks a clean, learner-friendly primary gloss from CC-CEDICT entries.
// Pure (no DB / server-only) so both the ETL and the runtime can use it.
// It only *reorders/filters* authoritative glosses — it never invents one.

const JUNK = [
  /^old variant of/i,
  /^variant of/i,
  /^see\b/i,
  /^CL:/,
  /^surname\b/i,
  /^abbr\b/i,
  /^used in\b/i,
  /^\(onom\.?\)/i,
  /^also written/i,
  /^same as\b/i,
];

export function isJunkGloss(g: string): boolean {
  const s = g.trim();
  return s.length === 0 || JUNK.some((re) => re.test(s));
}

/** Real definitions first, junk (variants/classifiers/cross-refs) last. */
export function cleanGlosses(glosses: string[]): string[] {
  const good = glosses.filter((g) => !isJunkGloss(g));
  const junk = glosses.filter((g) => isJunkGloss(g));
  return [...good, ...junk];
}

/** The single best gloss to teach for a word/character. */
export function primaryGloss(glosses: string[]): string {
  return cleanGlosses(glosses)[0] ?? glosses[0] ?? "";
}

/**
 * Choose the best CC-CEDICT entry for a headword among several readings:
 * prefer an entry with a real (non-junk) primary gloss and a common (lowercase)
 * reading over proper nouns / surnames.
 */
export function chooseBestEntry<T extends { pinyin: string; glosses: string[] }>(
  entries: T[],
): T | undefined {
  if (entries.length <= 1) return entries[0];
  const score = (e: T): number => {
    let s = 0;
    if (!isJunkGloss(e.glosses[0] ?? "")) s += 4; // first gloss is a real definition
    if (e.glosses.some((g) => !isJunkGloss(g))) s += 2; // has any real gloss
    if (e.pinyin && e.pinyin[0] === e.pinyin[0]?.toLowerCase()) s += 1; // common word, not a name
    return s;
  };
  return [...entries].sort((a, b) => score(b) - score(a))[0];
}
