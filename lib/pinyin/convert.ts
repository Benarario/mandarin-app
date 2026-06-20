/**
 * Convert numbered pinyin (CC-CEDICT style, e.g. "ni3 hao3", "lu:4")
 * into diacritic pinyin ("nǐ hǎo", "lǜ").
 *
 * This is a deterministic transformation of authoritative CC-CEDICT data, not
 * a guess — it never invents a reading, it only re-renders one we already have.
 */

const VOWELS: Record<string, string[]> = {
  // index 0..4 => tone 1..5 (5 = neutral, no mark)
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  // "ü" written as "u:" or "v" in numbered pinyin
  "ü": ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

/** Decide which vowel in a syllable carries the tone mark. */
function tonalVowelIndex(letters: string): number {
  const lower = letters.toLowerCase();
  // a and e always take the mark.
  const a = lower.indexOf("a");
  if (a !== -1) return a;
  const e = lower.indexOf("e");
  if (e !== -1) return e;
  // "ou" => the o takes it.
  const ou = lower.indexOf("ou");
  if (ou !== -1) return ou;
  // otherwise the last vowel takes it.
  for (let i = lower.length - 1; i >= 0; i--) {
    if ("aeiouü".includes(lower[i])) return i;
  }
  return -1;
}

/** Convert a single numbered syllable, e.g. "hao3" or "lu:3" or "lv3". */
export function syllableToDiacritic(syllable: string): string {
  // Normalise ü spellings to a single "ü" placeholder before tone logic.
  let s = syllable.replace(/u:/gi, "ü").replace(/v/gi, "ü");

  const m = s.match(/^([a-zü]+)([1-5])$/i);
  if (!m) return syllable; // not a standard numbered syllable; leave as-is
  const [, letters, toneStr] = m;
  const tone = parseInt(toneStr, 10);
  if (tone === 5) return letters; // neutral tone, no mark

  const idx = tonalVowelIndex(letters);
  if (idx === -1) return letters;

  const ch = letters[idx];
  const lower = ch.toLowerCase();
  const marked = VOWELS[lower]?.[tone - 1];
  if (!marked) return letters;
  // Preserve original case.
  const out = ch === lower ? marked : marked.toUpperCase();
  return letters.slice(0, idx) + out + letters.slice(idx + 1);
}

/** Convert a whole numbered-pinyin string ("ni3 hao3") to diacritics. */
export function numberedToDiacritic(numbered: string): string {
  return numbered
    .trim()
    .split(/\s+/)
    .map(syllableToDiacritic)
    .join(" ");
}
