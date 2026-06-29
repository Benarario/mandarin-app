"use server";

import { requireUser } from "@/lib/require-user";
import { primaryGloss } from "@/lib/dict/gloss";
import { allowedVocabulary } from "@/lib/graph/gate";
import { parseSyllable } from "@/lib/pinyin/syllable";

const HAN = /\p{Script=Han}/u;

export interface TonePairExample {
  word: string;
  pinyin: string;
  english: string;
  tones: [number, number];
}

const toneOf = (syllable: string): number => {
  const m = syllable.match(/([1-5])$/);
  return m ? parseInt(m[1], 10) : 5;
};

/**
 * One real, common two-syllable example word per tone pair, taken from CC-CEDICT
 * (so the tones shown are always sourced, never invented). Keyed "t1_t2".
 */
export async function getTonePairExamples(): Promise<Record<string, TonePairExample>> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("dictionary")
    .select("simplified, pinyin, pinyin_numbered, glosses, hsk_30_band, freq_rank")
    .not("hsk_30_band", "is", null)
    .order("freq_rank", { ascending: true, nullsFirst: false })
    .limit(4000);

  const byPair: Record<string, TonePairExample> = {};
  for (const d of (data ?? []) as {
    simplified: string;
    pinyin: string;
    pinyin_numbered: string;
    glosses: string[];
  }[]) {
    if ([...d.simplified].length !== 2) continue;
    const syl = d.pinyin_numbered.trim().split(/\s+/);
    if (syl.length !== 2) continue;
    const t1 = toneOf(syl[0]);
    const t2 = toneOf(syl[1]);
    if (t1 < 1 || t1 > 4) continue; // grid covers tones 1–4 on the first syllable
    const key = `${t1}_${t2}`;
    if (!byPair[key]) {
      byPair[key] = { word: d.simplified, pinyin: d.pinyin, english: primaryGloss(d.glosses), tones: [t1, t2] };
    }
  }
  return byPair;
}

// ── Tone perception (HVPT-style) drills ────────────────────────────────────
export interface ToneWord {
  char: string;
  pinyin: string;
  tone: number; // 1–4
  gloss: string;
}
export interface ToneFamily {
  base: string; // toneless syllable, e.g. "ma"
  options: ToneWord[]; // same base, different tones (a minimal pair set)
}

// Canonical Stage-0 tone-contrast families (the standard mā/má/mǎ/mà demo and
// bā/bá/bǎ/bà). Real CC-CEDICT words used as phonology illustration — the same
// kind of non-gated tone example /tones already shows; tones come from the data.
const SEED_CHARS = ["妈", "麻", "马", "骂", "八", "拔", "把", "爸"];

/**
 * Build "which tone did you hear?" items and minimal-pair families from real
 * single-syllable words. Drawn from the learner's TAUGHT vocabulary (gate), plus
 * the canonical Stage-0 tone families so the drill works from day one. Every
 * tone/pinyin/gloss is from CC-CEDICT — nothing invented.
 */
export async function getToneDrills(): Promise<{ whichTone: ToneWord[]; pairs: ToneFamily[] }> {
  const { supabase, user } = await requireUser();
  const allowed = await allowedVocabulary(user.id);
  const taughtSingles = [...allowed].filter((w) => [...w].length === 1 && HAN.test(w));
  const candidates = [...new Set([...taughtSingles, ...SEED_CHARS])];

  const { data } = await supabase
    .from("dictionary")
    .select("simplified, pinyin, pinyin_numbered, glosses, freq_rank")
    .in("simplified", candidates);

  // Best (most common) reading per character, parsed into base + tone.
  const best = new Map<string, { word: ToneWord; base: string; rank: number }>();
  for (const d of (data ?? []) as {
    simplified: string;
    pinyin: string;
    pinyin_numbered: string;
    glosses: string[];
    freq_rank: number | null;
  }[]) {
    if (d.pinyin && d.pinyin[0] !== d.pinyin[0].toLowerCase()) continue; // skip proper-noun readings (e.g. "Mǎ")
    const syl = d.pinyin_numbered.trim().split(/\s+/);
    if (syl.length !== 1) continue; // single-syllable only — unambiguous tone
    const tone = toneOf(syl[0]);
    if (tone < 1 || tone > 4) continue; // skip neutral/unmarked
    const parsed = parseSyllable(syl[0]);
    if (!parsed) continue;
    const rank = d.freq_rank ?? Number.MAX_SAFE_INTEGER;
    const existing = best.get(d.simplified);
    if (existing && existing.rank <= rank) continue;
    best.set(d.simplified, {
      word: { char: d.simplified, pinyin: d.pinyin, tone, gloss: primaryGloss(d.glosses) },
      base: (parsed.initial ?? "") + parsed.final,
      rank,
    });
  }

  const whichTone = [...best.values()].map((b) => b.word).slice(0, 16);

  // Group by toneless base; keep families that contrast ≥2 tones.
  const families = new Map<string, Map<number, ToneWord>>();
  for (const b of best.values()) {
    if (!families.has(b.base)) families.set(b.base, new Map());
    families.get(b.base)!.set(b.word.tone, b.word); // one word per tone
  }
  const pairs: ToneFamily[] = [];
  for (const [base, byTone] of families) {
    if (byTone.size < 2) continue;
    pairs.push({ base, options: [...byTone.values()].sort((a, b) => a.tone - b.tone) });
  }

  return { whichTone, pairs };
}
