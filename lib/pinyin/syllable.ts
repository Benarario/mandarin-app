// Parse a numbered-pinyin syllable (CC-CEDICT style, e.g. "hao3", "lu:e4",
// "yang2") into its initial (consonant) and final (rime), using the SAME
// spellings the phonology concepts use (see scripts/etl/phonemes.ts: refs like
// `initial_b`, `final_ang`, `final_ü`).
//
// This is a deterministic classification of an authoritative reading we already
// have — it never invents a sound. It only answers "which initial/final does
// this real syllable contain?" so we can pick a real example word for each.

// Kept in sync with scripts/etl/phonemes.ts INITIALS / FINALS.
export const INITIALS = "b p m f d t n l g k h j q x zh ch sh r z c s".split(" ");
export const FINALS =
  "a o e i u ü ai ei ao ou an en ang eng ong er ia ie iao iu ian in iang ing iong ua uo uai ui uan un uang ueng üe üan ün".split(
    " ",
  );

const INITIALS_SET = new Set(INITIALS);
const FINALS_SET = new Set(FINALS);
const TWO_LETTER_INITIALS = ["zh", "ch", "sh"];

// No-initial syllable spelling (y-/w-glides and bare vowels) → canonical final.
const STANDALONE: Record<string, string> = {
  // y- series (i / ü finals written with a y-glide)
  yi: "i", ya: "ia", ye: "ie", yao: "iao", you: "iu", yan: "ian", yin: "in",
  yang: "iang", ying: "ing", yong: "iong",
  yu: "ü", yue: "üe", yuan: "üan", yun: "ün",
  // w- series (u finals written with a w-glide)
  wu: "u", wa: "ua", wo: "uo", wai: "uai", wei: "ui", wan: "uan", wen: "un",
  wang: "uang", weng: "ueng",
  // bare vowel rimes
  a: "a", o: "o", e: "e", ai: "ai", ei: "ei", ao: "ao", ou: "ou",
  an: "an", en: "en", ang: "ang", eng: "eng", er: "er",
};

export interface ParsedSyllable {
  initial: string | null; // null when the syllable starts with a vowel/glide
  final: string;
}

/**
 * Parse one numbered-pinyin syllable. Returns null for anything that isn't a
 * standard syllable with a recognised final (so callers can skip it).
 */
export function parseSyllable(raw: string): ParsedSyllable | null {
  const m = raw.toLowerCase().match(/^([a-zü:]+)([1-5])?$/);
  if (!m) return null;
  // Normalise ü spellings ("u:" / "v") to a single "ü", as convert.ts does.
  const s = m[1].replace(/u:/g, "ü").replace(/v/g, "ü");

  // No initial: starts with a vowel or a y/w glide.
  if (/^[aeoüyw]/.test(s)) {
    const f = STANDALONE[s];
    if (f) return { initial: null, final: f };
    if (FINALS_SET.has(s)) return { initial: null, final: s };
    return null;
  }

  // Has an initial — match the two-letter initials (zh/ch/sh) first.
  let initial: string | null = null;
  if (TWO_LETTER_INITIALS.includes(s.slice(0, 2))) initial = s.slice(0, 2);
  else if (INITIALS_SET.has(s[0])) initial = s[0];
  else return null;

  let rime = s.slice(initial.length);
  // After j/q/x, a written "u" is actually "ü" (ju→jü, jue→jüe, juan→jüan, jun→jün).
  if ((initial === "j" || initial === "q" || initial === "x") && rime.startsWith("u")) {
    rime = "ü" + rime.slice(1);
  }
  if (!FINALS_SET.has(rime)) return null;
  return { initial, final: rime };
}
